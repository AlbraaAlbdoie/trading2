// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Quantitative Backtest Engine (Audited V2)
// Compares:
//   A. Legacy Strategy
//   B. Enhanced Strategy (Breakout + Pullback)
//   C. Breakout Only (Pullback Disabled)
// On BTCUSDT and ETHUSDT across 15m and 1h Timeframes.
// ═══════════════════════════════════════════════════════════════════════════

import fs from "fs";
import path from "path";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import type { CandleData } from "../src/lib/types.ts";
import { legacyEvaluateSignal } from "../src/lib/strategies/legacyStrategy.ts";
import { computeQuantMatrix, roundPrice } from "../src/lib/quantEngine.ts";
import { evaluateOpportunity } from "../src/lib/opportunityRanker.ts";
import type { RejectionCode } from "../src/lib/opportunityRanker.ts";

export type StrategyVariant = "legacy" | "enhanced" | "breakout_only";

export interface BacktestTrade {
  id: number;
  symbol: string;
  strategy: StrategyVariant;
  setupType: "BREAKOUT" | "PULLBACK" | "LEGACY";
  direction: "LONG" | "SHORT";
  entryBar: number;
  entryTime: number;
  entryPrice: number;
  exitBar: number;
  exitTime: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  exitReason: "SL" | "TP1" | "TP2" | "TIMEOUT";
  grossPnlPct: number;
  netPnlPct: number;
  barsHeld: number;
}

export interface PerformanceMetrics {
  strategy: StrategyVariant;
  timeframe: "15m" | "1h";
  totalEvaluations: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRatePct: number;
  grossProfitPct: number;
  grossLossPct: number;
  netReturnPct: number;
  profitFactor: number;
  expectancyPct: number;
  avgWinPct: number;
  avgLossPct: number;
  maxDrawdownPct: number;
  avgBarsHeld: number;
  breakoutTrades: number;
  breakoutWins: number;
  breakoutWinRatePct: number;
  pullbackTrades: number;
  pullbackWins: number;
  pullbackWinRatePct: number;
  rejections: Record<string, number>;
}

const TAKER_FEE_PCT = 0.04; // 0.04% Binance Futures VIP0 taker fee per side
const SLIPPAGE_PCT = 0.02;  // 0.02% conservative slippage per side
const TOTAL_COST_PER_TRADE_PCT = (TAKER_FEE_PCT + SLIPPAGE_PCT) * 2; // 0.12% roundtrip

/**
 * Fetch historical candles from Binance Futures public API with local caching
 */
export async function fetchBinanceHistory(symbol: string, interval: "15m" | "1h", totalCandles = 2500): Promise<CandleData[]> {
  const cacheDir = path.resolve(process.cwd(), ".cache", "backtest");
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const cacheFile = path.join(cacheDir, `${symbol}_${interval}_${totalCandles}.json`);
  if (fs.existsSync(cacheFile)) {
    const raw = fs.readFileSync(cacheFile, "utf8");
    return JSON.parse(raw);
  }

  console.log(`[Network Fetch] Downloading ${totalCandles} ${interval} candles for ${symbol}...`);
  const allCandles: CandleData[] = [];
  let endTime: number | undefined = undefined;

  while (allCandles.length < totalCandles) {
    const fetchLimit = Math.min(1000, totalCandles - allCandles.length);
    let url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${fetchLimit}`;
    if (endTime) {
      url += `&endTime=${endTime}`;
    }

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch Binance klines: ${res.statusText}`);
    }

    const data: Array<Array<string | number>> = await res.json();
    if (data.length === 0) break;

    const parsed: CandleData[] = data.map((k) => ({
      openTime: Number(k[0]),
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
      closeTime: Number(k[6]),
    }));

    allCandles.unshift(...parsed);
    endTime = Number(data[0][0]) - 1;
    await new Promise((r) => setTimeout(r, 200));
  }

  const uniqueMap = new Map<number, CandleData>();
  for (const c of allCandles) {
    uniqueMap.set(c.openTime, c);
  }
  const sorted = Array.from(uniqueMap.values()).sort((a, b) => a.openTime - b.openTime);

  fs.writeFileSync(cacheFile, JSON.stringify(sorted, null, 2), "utf8");
  return sorted;
}

/**
 * Execute simulation with audited intrabar price execution, gap protection, and cost deduction.
 */
export function simulateStrategyRun(
  strategyName: StrategyVariant,
  timeframe: "15m" | "1h",
  execCandles: CandleData[],
  trendCandles: CandleData[],
  startBarIndex: number,
  endBarIndex: number,
): { trades: BacktestTrade[]; metrics: PerformanceMetrics } {
  const trades: BacktestTrade[] = [];
  let activeTrade: BacktestTrade | null = null;
  let tradeCounter = 1;

  const rejections: Record<string, number> = {};
  let totalEvaluations = 0;

  for (let i = startBarIndex; i < endBarIndex - 1; i++) {
    const currentBar = execCandles[i];
    const nextBar = execCandles[i + 1];

    // ── Manage Active Trade ───────────────────────────────────────────────
    if (activeTrade) {
      activeTrade.barsHeld++;

      let exitPrice: number | null = null;
      let exitReason: "SL" | "TP1" | "TP2" | "TIMEOUT" | null = null;

      if (activeTrade.direction === "LONG") {
        // Gap Protection: If bar opened below SL, fill at open (realistic gap down slippage)
        const effectiveSlExit = Math.min(activeTrade.stopLoss, currentBar.open);
        const hitSl = currentBar.low <= activeTrade.stopLoss;
        const hitTp2 = currentBar.high >= activeTrade.takeProfit2;
        const hitTp1 = currentBar.high >= activeTrade.takeProfit1;

        // Conservative rule: If both SL and TP touched in same bar, assume SL hit first
        if (hitSl && (hitTp1 || hitTp2)) {
          exitPrice = effectiveSlExit;
          exitReason = "SL";
        } else if (hitSl) {
          exitPrice = effectiveSlExit;
          exitReason = "SL";
        } else if (hitTp2) {
          exitPrice = activeTrade.takeProfit2;
          exitReason = "TP2";
        } else if (hitTp1) {
          exitPrice = activeTrade.takeProfit1;
          exitReason = "TP1";
        } else if (activeTrade.barsHeld >= (timeframe === "15m" ? 48 : 24)) {
          // Timeout exit after holding period
          exitPrice = currentBar.close;
          exitReason = "TIMEOUT";
        }
      } else {
        // SHORT
        const effectiveSlExit = Math.max(activeTrade.stopLoss, currentBar.open);
        const hitSl = currentBar.high >= activeTrade.stopLoss;
        const hitTp2 = currentBar.low <= activeTrade.takeProfit2;
        const hitTp1 = currentBar.low <= activeTrade.takeProfit1;

        if (hitSl && (hitTp1 || hitTp2)) {
          exitPrice = effectiveSlExit;
          exitReason = "SL";
        } else if (hitSl) {
          exitPrice = effectiveSlExit;
          exitReason = "SL";
        } else if (hitTp2) {
          exitPrice = activeTrade.takeProfit2;
          exitReason = "TP2";
        } else if (hitTp1) {
          exitPrice = activeTrade.takeProfit1;
          exitReason = "TP1";
        } else if (activeTrade.barsHeld >= (timeframe === "15m" ? 48 : 24)) {
          exitPrice = currentBar.close;
          exitReason = "TIMEOUT";
        }
      }

      if (exitPrice !== null && exitReason !== null) {
        activeTrade.exitBar = i;
        activeTrade.exitTime = currentBar.closeTime;
        activeTrade.exitPrice = exitPrice;
        activeTrade.exitReason = exitReason;

        const rawReturnPct =
          activeTrade.direction === "LONG"
            ? ((exitPrice - activeTrade.entryPrice) / activeTrade.entryPrice) * 100
            : ((activeTrade.entryPrice - exitPrice) / activeTrade.entryPrice) * 100;

        activeTrade.grossPnlPct = Number(rawReturnPct.toFixed(3));
        activeTrade.netPnlPct = Number((rawReturnPct - TOTAL_COST_PER_TRADE_PCT).toFixed(3));

        trades.push(activeTrade);
        activeTrade = null;
      }
      continue;
    }

    // ── Evaluate New Signal ───────────────────────────────────────────────
    totalEvaluations++;

    // Zero Lookahead Bias: History strictly up to current closed bar
    const historyExec = execCandles.slice(0, i + 1);
    const historyTrend = trendCandles.filter((c) => c.closeTime <= currentBar.openTime);

    if (historyTrend.length < 50 || historyExec.length < 30) continue;

    if (strategyName === "legacy") {
      const legacySignal = legacyEvaluateSignal(historyTrend, historyExec, currentBar.close, "futures");
      if (legacySignal.action === "LONG" || legacySignal.action === "SHORT") {
        const entryPrice = nextBar.open;
        const distSl = Math.abs(currentBar.close - legacySignal.sl);
        const distTp1 = Math.abs(legacySignal.tp1 - currentBar.close);
        const distTp2 = Math.abs(legacySignal.tp2 - currentBar.close);

        const stopLoss = legacySignal.action === "LONG" ? entryPrice - distSl : entryPrice + distSl;
        const tp1 = legacySignal.action === "LONG" ? entryPrice + distTp1 : entryPrice - distTp1;
        const tp2 = legacySignal.action === "LONG" ? entryPrice + distTp2 : entryPrice - distTp2;

        activeTrade = {
          id: tradeCounter++,
          symbol: "ASSET",
          strategy: "legacy",
          setupType: "LEGACY",
          direction: legacySignal.action,
          entryBar: i + 1,
          entryTime: nextBar.openTime,
          entryPrice,
          exitBar: 0,
          exitTime: 0,
          exitPrice: 0,
          stopLoss: roundPrice(stopLoss),
          takeProfit1: roundPrice(tp1),
          takeProfit2: roundPrice(tp2),
          exitReason: "TIMEOUT",
          grossPnlPct: 0,
          netPnlPct: 0,
          barsHeld: 0,
        };
      } else {
        rejections["LEGACY_NO_SETUP"] = (rejections["LEGACY_NO_SETUP"] || 0) + 1;
      }
    } else {
      // Enhanced or Breakout_Only
      const quantMatrix = computeQuantMatrix(historyTrend, historyExec, currentBar.close, {
        referenceTime: currentBar.closeTime,
      });

      const isBreakoutOnly = strategyName === "breakout_only";

      const evalResult = evaluateOpportunity({
        symbol: "ASSET",
        market: "crypto",
        tradeMode: "futures",
        quantMatrix,
        btcDumpRisk: false,
        quoteVolume24h: 100_000_000,
        breakoutOnly: isBreakoutOnly,
        signalCandle: currentBar,
      });

      if (evalResult.isActionable && evalResult.direction && evalResult.setupType !== "NONE") {
        const entryPrice = nextBar.open;
        const distSl = Math.abs(currentBar.close - evalResult.stopLoss);
        const distTp1 = Math.abs(evalResult.takeProfit1 - currentBar.close);
        const distTp2 = Math.abs(evalResult.takeProfit2 - currentBar.close);

        const stopLoss = evalResult.direction === "LONG" ? entryPrice - distSl : entryPrice + distSl;
        const tp1 = evalResult.direction === "LONG" ? entryPrice + distTp1 : entryPrice - distTp1;
        const tp2 = evalResult.direction === "LONG" ? entryPrice + distTp2 : entryPrice - distTp2;

        activeTrade = {
          id: tradeCounter++,
          symbol: "ASSET",
          strategy: strategyName,
          setupType: evalResult.setupType,
          direction: evalResult.direction,
          entryBar: i + 1,
          entryTime: nextBar.openTime,
          entryPrice,
          exitBar: 0,
          exitTime: 0,
          exitPrice: 0,
          stopLoss: roundPrice(stopLoss),
          takeProfit1: roundPrice(tp1),
          takeProfit2: roundPrice(tp2),
          exitReason: "TIMEOUT",
          grossPnlPct: 0,
          netPnlPct: 0,
          barsHeld: 0,
        };
      } else {
        const code = evalResult.rejectionCode || "NO_SETUP";
        rejections[code] = (rejections[code] || 0) + 1;
      }
    }
  }

  const metrics = calculateMetrics(strategyName, timeframe, totalEvaluations, trades, rejections);
  return { trades, metrics };
}

function calculateMetrics(
  strategy: StrategyVariant,
  timeframe: "15m" | "1h",
  totalEvaluations: number,
  trades: BacktestTrade[],
  rejections: Record<string, number>,
): PerformanceMetrics {
  if (trades.length === 0) {
    return {
      strategy,
      timeframe,
      totalEvaluations,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRatePct: 0,
      grossProfitPct: 0,
      grossLossPct: 0,
      netReturnPct: 0,
      profitFactor: 0,
      expectancyPct: 0,
      avgWinPct: 0,
      avgLossPct: 0,
      maxDrawdownPct: 0,
      avgBarsHeld: 0,
      breakoutTrades: 0,
      breakoutWins: 0,
      breakoutWinRatePct: 0,
      pullbackTrades: 0,
      pullbackWins: 0,
      pullbackWinRatePct: 0,
      rejections,
    };
  }

  let wins = 0;
  let losses = 0;
  let grossProfitPct = 0;
  let grossLossPct = 0;
  let netReturnPct = 0;
  let totalBarsHeld = 0;

  let breakoutCount = 0;
  let breakoutWins = 0;
  let pullbackCount = 0;
  let pullbackWins = 0;

  let peakEquity = 0;
  let currentEquity = 0;
  let maxDrawdownPct = 0;

  for (const t of trades) {
    netReturnPct += t.netPnlPct;
    currentEquity += t.netPnlPct;
    if (currentEquity > peakEquity) {
      peakEquity = currentEquity;
    }
    const dd = peakEquity - currentEquity;
    if (dd > maxDrawdownPct) {
      maxDrawdownPct = dd;
    }

    totalBarsHeld += t.barsHeld;

    if (t.netPnlPct > 0) {
      wins++;
      grossProfitPct += t.netPnlPct;
    } else {
      losses++;
      grossLossPct += Math.abs(t.netPnlPct);
    }

    if (t.setupType === "BREAKOUT") {
      breakoutCount++;
      if (t.netPnlPct > 0) breakoutWins++;
    } else if (t.setupType === "PULLBACK") {
      pullbackCount++;
      if (t.netPnlPct > 0) pullbackWins++;
    }
  }

  const winRatePct = Number(((wins / trades.length) * 100).toFixed(2));
  const profitFactor = grossLossPct > 0 ? Number((grossProfitPct / grossLossPct).toFixed(2)) : grossProfitPct > 0 ? 999 : 0;

  const avgWinPct = wins > 0 ? Number((grossProfitPct / wins).toFixed(2)) : 0;
  const avgLossPct = losses > 0 ? Number((grossLossPct / losses).toFixed(2)) : 0;
  const expectancyPct = Number(((wins / trades.length) * avgWinPct - (losses / trades.length) * avgLossPct).toFixed(3));

  return {
    strategy,
    timeframe,
    totalEvaluations,
    totalTrades: trades.length,
    wins,
    losses,
    winRatePct,
    grossProfitPct: Number(grossProfitPct.toFixed(2)),
    grossLossPct: Number(grossLossPct.toFixed(2)),
    netReturnPct: Number(netReturnPct.toFixed(2)),
    profitFactor,
    expectancyPct,
    avgWinPct,
    avgLossPct,
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    avgBarsHeld: Number((totalBarsHeld / trades.length).toFixed(1)),
    breakoutTrades: breakoutCount,
    breakoutWins,
    breakoutWinRatePct: breakoutCount > 0 ? Number(((breakoutWins / breakoutCount) * 100).toFixed(1)) : 0,
    pullbackTrades: pullbackCount,
    pullbackWins,
    pullbackWinRatePct: pullbackCount > 0 ? Number(((pullbackWins / pullbackCount) * 100).toFixed(1)) : 0,
    rejections,
  };
}

/**
 * Print 3-Way Comparison Table
 */
function print3WayTable(title: string, legacy: PerformanceMetrics, enhanced: PerformanceMetrics, breakoutOnly: PerformanceMetrics) {
  console.log(`\n========================================================================================================`);
  console.log(`📊 ${title}`);
  console.log(`========================================================================================================`);
  console.log(
    `Metric                      | A. Legacy Strategy     | B. Enhanced (Full)     | C. Breakout Only`,
  );
  console.log(`--------------------------------------------------------------------------------------------------------`);

  const rows: Array<[string, string, string, string]> = [
    ["Total Trades", String(legacy.totalTrades), String(enhanced.totalTrades), String(breakoutOnly.totalTrades)],
    [
      "Win Rate %",
      `${legacy.winRatePct}% (${legacy.wins}/${legacy.totalTrades})`,
      `${enhanced.winRatePct}% (${enhanced.wins}/${enhanced.totalTrades})`,
      `${breakoutOnly.winRatePct}% (${breakoutOnly.wins}/${breakoutOnly.totalTrades})`,
    ],
    [
      "Net Return (After Fees)",
      `${legacy.netReturnPct}%`,
      `${enhanced.netReturnPct}%`,
      `${breakoutOnly.netReturnPct}%`,
    ],
    [
      "Profit Factor",
      String(legacy.profitFactor),
      String(enhanced.profitFactor),
      String(breakoutOnly.profitFactor),
    ],
    [
      "Expectancy / Trade",
      `${legacy.expectancyPct}%`,
      `${enhanced.expectancyPct}%`,
      `${breakoutOnly.expectancyPct}%`,
    ],
    [
      "Avg Win / Avg Loss",
      `+${legacy.avgWinPct}% / -${legacy.avgLossPct}%`,
      `+${enhanced.avgWinPct}% / -${enhanced.avgLossPct}%`,
      `+${breakoutOnly.avgWinPct}% / -${breakoutOnly.avgLossPct}%`,
    ],
    [
      "Max Drawdown %",
      `${legacy.maxDrawdownPct}%`,
      `${enhanced.maxDrawdownPct}%`,
      `${breakoutOnly.maxDrawdownPct}%`,
    ],
    [
      "Breakout Breakdown",
      `-`,
      `${enhanced.breakoutTrades} (${enhanced.breakoutWinRatePct}%)`,
      `${breakoutOnly.breakoutTrades} (${breakoutOnly.breakoutWinRatePct}%)`,
    ],
    [
      "Pullback Breakdown",
      `-`,
      `${enhanced.pullbackTrades} (${enhanced.pullbackWinRatePct}%)`,
      `0 (Disabled)`,
    ],
  ];

  for (const [m, a, b, c] of rows) {
    console.log(`${m.padEnd(28)}| ${a.padEnd(23)}| ${b.padEnd(23)}| ${c}`);
  }

  console.log(`--------------------------------------------------------------------------------------------------------`);
  console.log(`🔍 Top Rejection Reasons (Enhanced B vs C):`);
  const topRejectionsB = Object.entries(enhanced.rejections).sort((x, y) => y[1] - x[1]).slice(0, 3);
  const topRejectionsC = Object.entries(breakoutOnly.rejections).sort((x, y) => y[1] - x[1]).slice(0, 3);
  console.log(`   • Enhanced B Filters: ${topRejectionsB.map(([k, v]) => `${k}: ${v}`).join(", ")}`);
  console.log(`   • Breakout C Filters: ${topRejectionsC.map(([k, v]) => `${k}: ${v}`).join(", ")}`);
  console.log(`========================================================================================================\n`);
}

/**
 * Main Orchestrator
 */
async function main() {
  console.log(`\n🚀 NEXUS ALPHA — Quantitative Multi-Strategy Backtest Starting...`);
  console.log(`Deductions: 0.08% Binance taker fee + 0.04% conservative slippage = 0.12% per roundtrip.`);

  const symbols = ["BTCUSDT", "ETHUSDT"];

  for (const sym of symbols) {
    // ═════════════════════════════════════════════════════════════════════════
    // 1. 15-Minute Timeframe Backtest (15m execution with 1h trend filter)
    // ═════════════════════════════════════════════════════════════════════════
    const [c15m, c1h] = await Promise.all([
      fetchBinanceHistory(sym, "15m", 2500),
      fetchBinanceHistory(sym, "1h", 1000),
    ]);

    const total15m = c15m.length;
    const warmup15m = 350;
    const usable15m = total15m - warmup15m;
    const split15m = warmup15m + Math.floor(usable15m * 0.70);

    const start15mDate = new Date(c15m[warmup15m].openTime).toISOString().slice(0, 10);
    const split15mDate = new Date(c15m[split15m].openTime).toISOString().slice(0, 10);
    const end15mDate = new Date(c15m[total15m - 1].closeTime).toISOString().slice(0, 10);

    console.log(`\n================================================================================`);
    console.log(`📈 SYMBOL: ${sym} — TIMEFRAME: 15-MINUTE`);
    console.log(`Data Range: ${start15mDate} to ${end15mDate} | Split at: ${split15mDate}`);
    console.log(`================================================================================`);

    // In-Sample 15m
    const legIn15 = simulateStrategyRun("legacy", "15m", c15m, c1h, warmup15m, split15m);
    const enhIn15 = simulateStrategyRun("enhanced", "15m", c15m, c1h, warmup15m, split15m);
    const brkIn15 = simulateStrategyRun("breakout_only", "15m", c15m, c1h, warmup15m, split15m);
    print3WayTable(`${sym} [15M] — In-Sample (Dev: 70%)`, legIn15.metrics, enhIn15.metrics, brkIn15.metrics);

    // Out-of-Sample 15m
    const legOut15 = simulateStrategyRun("legacy", "15m", c15m, c1h, split15m, total15m);
    const enhOut15 = simulateStrategyRun("enhanced", "15m", c15m, c1h, split15m, total15m);
    const brkOut15 = simulateStrategyRun("breakout_only", "15m", c15m, c1h, split15m, total15m);
    print3WayTable(`${sym} [15M] — Out-of-Sample (Strict Validation: 30%)`, legOut15.metrics, enhOut15.metrics, brkOut15.metrics);

    // ═════════════════════════════════════════════════════════════════════════
    // 2. 1-Hour Timeframe Backtest (1h execution with 1h trend filter)
    // ═════════════════════════════════════════════════════════════════════════
    const total1h = c1h.length;
    const warmup1h = 250;
    const usable1h = total1h - warmup1h;
    const split1h = warmup1h + Math.floor(usable1h * 0.70);

    const start1hDate = new Date(c1h[warmup1h].openTime).toISOString().slice(0, 10);
    const split1hDate = new Date(c1h[split1h].openTime).toISOString().slice(0, 10);
    const end1hDate = new Date(c1h[total1h - 1].closeTime).toISOString().slice(0, 10);

    console.log(`\n================================================================================`);
    console.log(`📈 SYMBOL: ${sym} — TIMEFRAME: 1-HOUR`);
    console.log(`Data Range: ${start1hDate} to ${end1hDate} | Split at: ${split1hDate}`);
    console.log(`================================================================================`);

    // In-Sample 1h
    const legIn1h = simulateStrategyRun("legacy", "1h", c1h, c1h, warmup1h, split1h);
    const enhIn1h = simulateStrategyRun("enhanced", "1h", c1h, c1h, warmup1h, split1h);
    const brkIn1h = simulateStrategyRun("breakout_only", "1h", c1h, c1h, warmup1h, split1h);
    print3WayTable(`${sym} [1H] — In-Sample (Dev: 70%)`, legIn1h.metrics, enhIn1h.metrics, brkIn1h.metrics);

    // Out-of-Sample 1h
    const legOut1h = simulateStrategyRun("legacy", "1h", c1h, c1h, split1h, total1h);
    const enhOut1h = simulateStrategyRun("enhanced", "1h", c1h, c1h, split1h, total1h);
    const brkOut1h = simulateStrategyRun("breakout_only", "1h", c1h, c1h, split1h, total1h);
    print3WayTable(`${sym} [1H] — Out-of-Sample (Strict Validation: 30%)`, legOut1h.metrics, enhOut1h.metrics, brkOut1h.metrics);
  }

  console.log(`🏁 All Multi-Timeframe Multi-Strategy Backtests Complete.`);
}

main().catch((err) => {
  console.error("Backtest failed:", err);
  process.exit(1);
});
