// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Background Scheduled Market Scanner API Route
// Executes scheduled market scans independently of user browser sessions.
// Updates Opportunity FSM, enforces 2-hour cooldowns, and dispatches Telegram alerts.
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import {
  fetchBinanceKlines,
  checkBtcDumpGuard,
  generateSyntheticGoldKlines,
} from "@/lib/smc";
import { computeQuantMatrix } from "@/lib/quantEngine";
import { evaluateOpportunity } from "@/lib/opportunityRanker";
import { isGoldMarketWeekendClosed, formatPrice } from "@/lib/utils";
import {
  RVOL_MIN_THRESHOLD,
  validateRvol,
  validateTradeRecommendation,
  computeDeterministicScore,
  DATA_SOURCE_REAL,
  DATA_SOURCE_SYNTHETIC,
} from "@/lib/tradePolicy";
import {
  MarketOpportunity,
  AiTradeRecommendation,
  CandleData,
  QuantMatrix,
} from "@/lib/types";
import {
  evalOpportunityTransition,
  checkAlertCooldown,
  upsertOpportunityInDb,
  getActiveOpportunitiesFromDb,
  logAlertDispatch,
  updateAlertStatus,
  recordMonitorRun,
  generateAlertIdempotencyKey,
  isGoldSymbol,
  OPPORTUNITY_TTL_MS,
} from "@/lib/opportunityManager";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // Max execution duration in seconds for serverless

/** Validate CRON_SECRET authorization */
function authorizeRequest(req: Request): boolean {
  const expectedSecret = process.env.CRON_SECRET;
  // If CRON_SECRET is not configured in local environment, allow for testing
  if (!expectedSecret) return true;

  const authHeader = req.headers.get("authorization");
  const xCronSecret = req.headers.get("x-cron-secret");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token === expectedSecret) return true;
  }

  if (xCronSecret && xCronSecret.trim() === expectedSecret) {
    return true;
  }

  return false;
}

/** Format Telegram Alert message HTML */
function formatTelegramAlert(rec: AiTradeRecommendation, triggerNote?: string): string {
  const score = rec.confluence_score ?? rec.confidence_score ?? 80;
  const directionArabic =
    rec.status === "LONG"
      ? "شراء (LONG) 🟢"
      : rec.status === "SHORT"
      ? "بيع (SHORT) 🔴"
      : "شراء فوري (SPOT BUY) 🔵";

  return `🚨 <b>[NEXUS ALPHA - المراقبة المجدولة]</b>
────────────────────────
🪙 <b>الرمز:</b> <code>${rec.symbol}</code>
🎯 <b>نوع التوصية:</b> ${directionArabic}
📊 <b>نسبة التوافق:</b> ${score}%
💵 <b>سعر الدخول:</b> $${formatPrice(rec.entry_price)}
🛑 <b>وقف الخسارة (SL):</b> $${formatPrice(rec.stop_loss)}
🎯 <b>الهدف الأول (TP1):</b> $${formatPrice(rec.take_profit_1)}
🎯 <b>الهدف الثاني (TP2):</b> $${formatPrice(rec.take_profit_2)}
⚖️ <b>العائد للمخاطرة (R:R):</b> ${rec.risk_reward_ratio || "N/A"}

${triggerNote ? `⚡ <b>حالة الزناد:</b> ${triggerNote}\n` : ""}
💡 <b>التحليل الفني:</b>
${rec.reasoning_arabic || "توافق مؤشرات كمية مؤسساتية مكتملة."}
────────────────────────
🤖 <i>نظام المراقبة الخادمي الآلي — NEXUS ALPHA Engine</i>`;
}

/** Execute a full scan cycle */
async function executeMarketScanCycle(triggeredBy: "cron_scheduler" | "manual_ui" | "webhook") {
  const startTime = Date.now();
  let symbolsScanned = 0;
  let opportunitiesFound = 0;
  let alertsDispatched = 0;
  const errors: string[] = [];

  try {
    // 1. Check BTC Dump Guard first
    let btcDumpRisk = false;
    try {
      btcDumpRisk = await checkBtcDumpGuard();
    } catch (btcErr) {
      console.warn("[MarketScan] BTC Dump Guard check error:", btcErr);
    }

    // 2. Re-evaluate Active Opportunities from DB (CANDIDATE / WATCHING)
    const activeOpps = await getActiveOpportunitiesFromDb();
    for (const opp of activeOpps) {
      try {
        let currentPrice = 0;
        let candleClose: number | undefined;

        if (isGoldSymbol(opp.symbol)) {
          // Fetch spot gold rate
          try {
            const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT", {
              cache: "no-store",
            });
            if (res.ok) {
              const d = await res.json();
              currentPrice = parseFloat(d.price);
            }
          } catch {}
        } else {
          // Fetch crypto latest 15m candle
          try {
            const klines = await fetchBinanceKlines(opp.symbol, "15m", 2, opp.trade_mode);
            if (klines && klines.length > 0) {
              const latest = klines[klines.length - 1];
              currentPrice = latest.close;
              candleClose = latest.close;
            }
          } catch (kErr) {
            console.warn(`[MarketScan] Kline fetch failed for active opp ${opp.symbol}:`, kErr);
          }
        }

        if (currentPrice > 0) {
          const transition = evalOpportunityTransition(opp, currentPrice, candleClose, btcDumpRisk);
          if (transition.nextState !== opp.state) {
            opp.state = transition.nextState;
            opp.current_price = currentPrice;
            opp.invalidated_reason = transition.reason || null;
            await upsertOpportunityInDb(opp);

            // If it became TRIGGERED, proceed to alert processing
            if (transition.nextState === "TRIGGERED") {
              const alertSent = await processTriggeredAlert(opp, currentPrice, transition.reason);
              if (alertSent) alertsDispatched++;
            }
          }
        }
      } catch (oppErr) {
        errors.push(`Opp ${opp.symbol}: ${String(oppErr)}`);
      }
    }

    // 3. Scan Top Crypto Candidates from Binance Futures
    const candidatesToScan: Array<{ symbol: string; market: "crypto" | "gold"; price: number }> = [];

    try {
      // Bulk fetch 24hr tickers to avoid multiple parallel API calls
      const binanceRes = await fetch("https://fapi.binance.com/fapi/v1/ticker/24hr", {
        cache: "no-store",
      });

      if (binanceRes.ok) {
        const allTickers = (await binanceRes.json()) as Array<{
          symbol: string;
          quoteVolume: string;
          lastPrice: string;
        }>;

        // Pick top 5 USDT futures pairs by volume (excluding stablecoin pairs)
        const top5 = allTickers
          .filter((t) => t.symbol.endsWith("USDT") && !t.symbol.startsWith("USDC") && !t.symbol.startsWith("FDUSD"))
          .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
          .slice(0, 5);

        for (const t of top5) {
          candidatesToScan.push({
            symbol: t.symbol,
            market: "crypto",
            price: parseFloat(t.lastPrice),
          });
        }
      }
    } catch (tickerErr) {
      console.warn("[MarketScan] Binance bulk ticker fetch failed:", tickerErr);
      // Fallback default list
      const fallbackList = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];
      for (const s of fallbackList) {
        candidatesToScan.push({ symbol: s, market: "crypto", price: 0 });
      }
    }

    // 4. Add Gold Spot if market is open
    if (!isGoldMarketWeekendClosed()) {
      candidatesToScan.push({ symbol: "XAUUSD", market: "gold", price: 0 });
    }

    // 5. Scan Each Candidate Sequentially (avoiding rate limits)
    for (const item of candidatesToScan) {
      symbolsScanned++;
      const isGold = item.market === "gold" || isGoldSymbol(item.symbol);

      try {
        let candles1h: CandleData[] = [];
        let candles15m: CandleData[] = [];

        if (isGold) {
          // Gold Spot
          let goldSpot = item.price;
          if (goldSpot <= 0) {
            try {
              const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT", {
                cache: "no-store",
              });
              if (res.ok) {
                const d = await res.json();
                goldSpot = parseFloat(d.price);
              }
            } catch {}
          }
          if (goldSpot <= 0) goldSpot = 4148.5;

          // Note: Gold candles around spot are used for mathematical ATR/EMA levels
          candles1h = generateSyntheticGoldKlines(goldSpot, 250);
          candles15m = generateSyntheticGoldKlines(goldSpot, 50);
        } else {
          // Crypto: Real candles strictly required
          const cleanSymbol = item.symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
          [candles1h, candles15m] = await Promise.all([
            fetchBinanceKlines(cleanSymbol, "1h", 500, "futures"),
            fetchBinanceKlines(cleanSymbol, "15m", 100, "futures"),
          ]);
        }

        // Validate candles
        if (candles1h.length < 50 || candles15m.length < 14) continue;

        const livePrice =
          item.price > 0
            ? item.price
            : candles15m[candles15m.length - 1].close;

        // Compute Quantitative Matrix
        const quantMatrix: QuantMatrix = computeQuantMatrix(candles1h, candles15m, livePrice);

        // Evaluate opportunity via multi-factor model
        const lastClosedCandle = candles15m.length >= 2 ? candles15m[candles15m.length - 2] : candles15m[candles15m.length - 1];
        const evalResult = evaluateOpportunity({
          symbol: item.symbol,
          market: isGold ? "gold" : "crypto",
          tradeMode: "futures",
          quantMatrix,
          btcDumpRisk,
          quoteVolume24h: item.price * 1000,
          signalCandle: lastClosedCandle,
        });

        if (!evalResult.isActionable || !evalResult.direction) continue;

        const direction = evalResult.direction;
        const triggerPrice =
          evalResult.setupType === "BREAKOUT"
            ? (direction === "LONG" ? quantMatrix.highestHigh20 : quantMatrix.lowestLow20)
            : livePrice;

        const targetSl = evalResult.stopLoss;
        const targetTp1 = evalResult.takeProfit1;
        const targetTp2 = evalResult.takeProfit2;
        const calculatedRr = evalResult.riskRewardRatio;
        const score = evalResult.score.totalScore;

        // Determine initial state: Pullback is immediate TRIGGERED; Breakout is TRIGGERED only if level touched/broken
        const isAlreadyTriggered =
          evalResult.setupType === "PULLBACK"
            ? true
            : direction === "LONG"
            ? livePrice >= triggerPrice
            : livePrice <= triggerPrice;

        const initialState = isAlreadyTriggered ? "TRIGGERED" : "WATCHING";

        const opportunity: MarketOpportunity = {
          symbol: item.symbol,
          market: isGold ? "gold" : "crypto",
          trade_mode: "futures",
          direction,
          state: initialState,
          current_price: livePrice,
          trigger_price: triggerPrice,
          target_sl: targetSl,
          target_tp1: targetTp1,
          target_tp2: targetTp2,
          calculated_rr: calculatedRr,
          rvol: isGold ? null : quantMatrix.rvol, // Do not store synthetic gold volume
          confluence_score: score,
          trend_bias: quantMatrix.trend,
          expires_at: new Date(Date.now() + OPPORTUNITY_TTL_MS).toISOString(),
        };

        opportunitiesFound++;
        await upsertOpportunityInDb(opportunity);

        // If immediately triggered, process alert
        if (isAlreadyTriggered) {
          const alertSent = await processTriggeredAlert(
            opportunity,
            livePrice,
            `كسر/اختراق فوري عند مستوى $${formatPrice(triggerPrice)}`,
          );
          if (alertSent) alertsDispatched++;
        }
      } catch (itemErr) {
        errors.push(`${item.symbol}: ${String(itemErr)}`);
      }
    }

    // Record Monitor Execution Run
    const durationMs = Date.now() - startTime;
    const runStatus = errors.length === 0 ? "SUCCESS" : errors.length < symbolsScanned ? "PARTIAL_FAIL" : "FAILED";

    await recordMonitorRun({
      triggered_by: triggeredBy,
      symbols_scanned: symbolsScanned,
      opportunities_found: opportunitiesFound,
      alerts_dispatched: alertsDispatched,
      duration_ms: durationMs,
      status: runStatus,
      error_summary: errors.length > 0 ? errors.slice(0, 3).join("; ") : null,
    });

    return {
      success: true,
      duration_ms: durationMs,
      symbols_scanned: symbolsScanned,
      opportunities_found: opportunitiesFound,
      alerts_dispatched: alertsDispatched,
      errors_count: errors.length,
    };
  } catch (fatalErr) {
    const durationMs = Date.now() - startTime;
    const errMsg = fatalErr instanceof Error ? fatalErr.message : String(fatalErr);
    console.error("[MarketScan Fatal Error]:", errMsg);

    await recordMonitorRun({
      triggered_by: triggeredBy,
      symbols_scanned: symbolsScanned,
      opportunities_found: opportunitiesFound,
      alerts_dispatched: alertsDispatched,
      duration_ms: durationMs,
      status: "FAILED",
      error_summary: errMsg,
    });

    return { success: false, error: errMsg, duration_ms: durationMs };
  }
}

/**
 * Process a TRIGGERED opportunity:
 * Validate -> Check Cooldown -> Insert PENDING log -> Dispatch Telegram -> Update to SUCCESS/FAILED -> Mark ALERTED
 */
async function processTriggeredAlert(
  opp: MarketOpportunity,
  currentLivePrice: number,
  triggerNote?: string,
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Build recommendation object for validation
  const rec: AiTradeRecommendation = {
    status: opp.direction,
    symbol: opp.symbol,
    confidence_score: opp.confluence_score || 80,
    confluence_score: opp.confluence_score || 80,
    timeframe_confluence: `إشارة مؤسساتية مفعلة (${opp.trend_bias || "اتجاه مؤكد"})`,
    entry_price: currentLivePrice,
    stop_loss: opp.target_sl || currentLivePrice * 0.98,
    take_profit_1: opp.target_tp1 || currentLivePrice * 1.02,
    take_profit_2: opp.target_tp2 || currentLivePrice * 1.04,
    risk_reward_ratio: opp.calculated_rr || "1:2.00",
    reasoning_arabic: `[إشارة مراقبة آلية] تحقق زناد الدخول عند السعر $${formatPrice(currentLivePrice)}. وقف الخسارة والأهداف محددة رياضياً بواسطة تقلبات ATR.`,
    btc_warning: null,
    timestamp: Date.now(),
  };

  // 1. Final Trade Validation Gate
  const validation = validateTradeRecommendation(
    rec,
    opp.market === "gold" ? DATA_SOURCE_SYNTHETIC : DATA_SOURCE_REAL,
  );

  // For crypto, reject synthetic/invalid data
  if (opp.market === "crypto" && !validation.valid) {
    console.warn(`[MarketScan Alert] Rejected by final validator: ${validation.reason}`);
    return false;
  }

  // 2. Cooldown Check (2 hours)
  const { inCooldown, lastAlertedAt } = await checkAlertCooldown(opp.symbol, opp.direction);
  if (inCooldown) {
    console.log(`[MarketScan Alert] Suppressed ${opp.symbol} ${opp.direction}: in cooldown (last: ${lastAlertedAt})`);
    return false;
  }

  // 3. Generate Idempotency Key
  const idempotencyKey = generateAlertIdempotencyKey(
    opp.symbol,
    opp.direction,
    opp.trigger_price || currentLivePrice,
  );

  // 4. Log alert as PENDING in alert_dispatch_logs
  const logResult = await logAlertDispatch({
    opportunity_id: opp.id,
    symbol: opp.symbol,
    direction: opp.direction,
    channel: "telegram",
    recipient_chat_id: chatId || null,
    idempotency_key: idempotencyKey,
    payload_snapshot: rec as unknown as Record<string, unknown>,
    delivery_status: "PENDING",
  });

  if (!logResult.success && logResult.error?.includes("duplicate")) {
    console.log(`[MarketScan Alert] Duplicate idempotency key ${idempotencyKey}. Suppressed.`);
    return false;
  }

  // If no Telegram credentials configured, mark FAILED and stop
  if (!botToken || !chatId) {
    console.warn("[MarketScan Alert] Telegram credentials not configured in server env.");
    if (logResult.logId) await updateAlertStatus(logResult.logId, "FAILED");
    return false;
  }

  // 5. Dispatch Telegram Message
  try {
    const text = formatTelegramAlert(rec, triggerNote);
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });

    const tgData = await tgRes.json();

    if (tgData.ok) {
      if (logResult.logId) await updateAlertStatus(logResult.logId, "SUCCESS");
      // Update opportunity state to ALERTED
      opp.state = "ALERTED";
      await upsertOpportunityInDb(opp);
      return true;
    } else {
      console.warn("[MarketScan Alert] Telegram API returned error:", tgData.description);
      if (logResult.logId) await updateAlertStatus(logResult.logId, "FAILED");
      return false;
    }
  } catch (tgErr) {
    console.error("[MarketScan Alert] Telegram dispatch exception:", tgErr);
    if (logResult.logId) await updateAlertStatus(logResult.logId, "FAILED");
    return false;
  }
}

// ── GET: Cron Runner or Status Query ─────────────────────────────────────────
export async function GET(req: Request) {
  const url = new URL(req.url);

  // Status-only check (for UI polling of last run)
  if (url.searchParams.get("status") === "1") {
    try {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase
        .from("monitor_execution_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
      }

      return NextResponse.json({
        ok: true,
        lastRun: data?.[0] || null,
        cronConfigured: Boolean(process.env.CRON_SECRET),
        telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      });
    } catch (err) {
      return NextResponse.json({ ok: false, error: String(err) }, { status: 200 });
    }
  }

  // Authorize Cron trigger
  if (!authorizeRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await executeMarketScanCycle("cron_scheduler");
  return NextResponse.json(result);
}

// ── POST: Manual UI or Webhook Trigger ──────────────────────────────────────
export async function POST(req: Request) {
  if (!authorizeRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await executeMarketScanCycle("manual_ui");
  return NextResponse.json(result);
}
