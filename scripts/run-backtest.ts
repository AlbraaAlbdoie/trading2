// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Quantitative Backtest Engine (Audited V3 with Walk-Forward)
// Compares:
//   A. Legacy Strategy
//   B. Enhanced Strategy (Breakout + Pullback)
//   C. Breakout Only (Pullback Disabled)
// On BTCUSDT and ETHUSDT across 15m and 1h Timeframes.
// Features: Walk-Forward Validation, Market Regime Breakdown, Compounded Equity,
// Conservative Intrabar Collision (SL first), Gap Protection, and 0.12% Taker Fees + Slippage.
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
export type MarketRegime = "BULL_TREND" | "BEAR_TREND" | "CHOPPY_SIDEWAYS";

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
  windowIndex?: number;
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
  additiveNetReturnPct: number;
  compoundedNetReturnPct: number;
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
  regime?: MarketRegime;
}

export interface WalkForwardWindow {
  windowIndex: number;
  trainStart: number;
  trainEnd: number;
  testStart: number;
  testEnd: number;
  trainStartDate: string;
  trainEndDate: string;
  testStartDate: string;
  testEndDate: string;
  regime: MarketRegime;
}

const TAKER_FEE_PCT = 0.04; // 0.04% Binance Futures VIP0 taker fee per side
const SLIPPAGE_PCT = 0.02;  // 0.02% conservative slippage per side
const TOTAL_COST_PER_TRADE_PCT = (TAKER_FEE_PCT + SLIPPAGE_PCT) * 2; // 0.12% roundtrip

/**
 * Fetch historical candles from Binance Futures public API with local caching
 */
export async function fetchBinanceHistory(symbol: string, interval: "15m" | "1h", totalCandles = 3500): Promise<CandleData[]> {
  const cacheDir = path.resolve(process.cwd(), ".cache", "backtest");
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const cacheFile = path.join(cacheDir, `${symbol}_${interval}_${totalCandles}.json`);
  if (fs.existsSync(cacheFile)) {
    const raw = fs.readFileSync(cacheFile, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed.length >= totalCandles * 0.9) {
      return parsed;
    }
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
 * Classify market regime across a segment of candles
 */
export function classifyMarketRegime(candles: CandleData[]): MarketRegime {
  if (candles.length < 50) return "CHOPPY_SIDEWAYS";

  let bullishBars = 0;
  let bearishBars = 0;

  // Simple price change and EMA direction test
  const first = candles[0].close;
  const last = candles[candles.length - 1].close;
  const changePct = ((last - first) / first) * 100;

  for (let i = 20; i < candles.length; i++) {
    const slice = candles.slice(i - 20, i);
    const sma20 = slice.reduce((acc, c) => acc + c.close, 0) / 20;
    if (candles[i].close > sma20) bullishBars++;
    else bearishBars++;
  }

  const total = candles.length - 20;
  if (changePct > 5 && bullishBars / total > 0.60) {
    return "BULL_TREND";
  } else if (changePct < -5 && bearishBars / total > 0.60) {
    return "BEAR_TREND";
  }
  return "CHOPPY_SIDEWAYS";
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
  windowIndex = 1,
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
          windowIndex,
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
          windowIndex,
        };
      } else {
        const code = evalResult.rejectionCode || "NO_SETUP";
        rejections[code] = (rejections[code] || 0) + 1;
      }
    }
  }

  const segmentCandles = execCandles.slice(startBarIndex, endBarIndex);
  const regime = classifyMarketRegime(segmentCandles);

  const metrics = calculateMetrics(strategyName, timeframe, totalEvaluations, trades, rejections, regime);
  return { trades, metrics };
}

export function calculateMetrics(
  strategy: StrategyVariant,
  timeframe: "15m" | "1h",
  totalEvaluations: number,
  trades: BacktestTrade[],
  rejections: Record<string, number>,
  regime?: MarketRegime,
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
      additiveNetReturnPct: 0,
      compoundedNetReturnPct: 0,
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
      regime,
    };
  }

  let wins = 0;
  let losses = 0;
  let grossProfitPct = 0;
  let grossLossPct = 0;
  let additiveNetReturnPct = 0;
  let totalBarsHeld = 0;

  let breakoutCount = 0;
  let breakoutWins = 0;
  let pullbackCount = 0;
  let pullbackWins = 0;

  // Compounded equity tracking
  let compoundedEquity = 100.0;
  let peakCompoundedEquity = 100.0;
  let maxCompoundedDrawdownPct = 0;

  for (const t of trades) {
    additiveNetReturnPct += t.netPnlPct;

    // Compound equity: Equity * (1 + netReturn / 100)
    compoundedEquity = compoundedEquity * (1 + t.netPnlPct / 100);
    if (compoundedEquity > peakCompoundedEquity) {
      peakCompoundedEquity = compoundedEquity;
    }
    const currentDd = ((peakCompoundedEquity - compoundedEquity) / peakCompoundedEquity) * 100;
    if (currentDd > maxCompoundedDrawdownPct) {
      maxCompoundedDrawdownPct = currentDd;
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
  const compoundedNetReturnPct = Number((compoundedEquity - 100.0).toFixed(2));

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
    additiveNetReturnPct: Number(additiveNetReturnPct.toFixed(2)),
    compoundedNetReturnPct,
    profitFactor,
    expectancyPct,
    avgWinPct,
    avgLossPct,
    maxDrawdownPct: Number(maxCompoundedDrawdownPct.toFixed(2)),
    avgBarsHeld: Number((totalBarsHeld / trades.length).toFixed(1)),
    breakoutTrades: breakoutCount,
    breakoutWins,
    breakoutWinRatePct: breakoutCount > 0 ? Number(((breakoutWins / breakoutCount) * 100).toFixed(1)) : 0,
    pullbackTrades: pullbackCount,
    pullbackWins,
    pullbackWinRatePct: pullbackCount > 0 ? Number(((pullbackWins / pullbackCount) * 100).toFixed(1)) : 0,
    rejections,
    regime,
  };
}

/**
 * Print 3-Way Table
 */
function print3WayTable(
  title: string,
  legacy: PerformanceMetrics,
  enhanced: PerformanceMetrics,
  breakoutOnly: PerformanceMetrics,
  regime?: MarketRegime,
) {
  console.log(`\n========================================================================================================`);
  console.log(`📊 ${title} ${regime ? `[Regime: ${regime}]` : ""}`);
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
      "Net Return (Compounded)",
      `${legacy.compoundedNetReturnPct}%`,
      `${enhanced.compoundedNetReturnPct}%`,
      `${breakoutOnly.compoundedNetReturnPct}%`,
    ],
    [
      "Net Return (Additive)",
      `${legacy.additiveNetReturnPct}%`,
      `${enhanced.additiveNetReturnPct}%`,
      `${breakoutOnly.additiveNetReturnPct}%`,
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
      "Max Drawdown % (Peak-to-Trough)",
      `${legacy.maxDrawdownPct}%`,
      `${enhanced.maxDrawdownPct}%`,
      `${breakoutOnly.maxDrawdownPct}%`,
    ],
    [
      "Breakout Trades",
      `-`,
      `${enhanced.breakoutTrades} (${enhanced.breakoutWinRatePct}%)`,
      `${breakoutOnly.breakoutTrades} (${breakoutOnly.breakoutWinRatePct}%)`,
    ],
    [
      "Pullback Trades",
      `-`,
      `${enhanced.pullbackTrades} (${enhanced.pullbackWinRatePct}%)`,
      `0 (Disabled)`,
    ],
  ];

  for (const [m, a, b, c] of rows) {
    console.log(`${m.padEnd(28)}| ${a.padEnd(23)}| ${b.padEnd(23)}| ${c}`);
  }

  // Small sample size warning
  if (breakoutOnly.totalTrades < 15) {
    console.log(`⚠️  [Statistical Note]: Sample size (${breakoutOnly.totalTrades} trades) is limited; interpret variance carefully.`);
  }

  console.log(`========================================================================================================\n`);
}

/**
 * Build Walk-Forward Sliding Windows
 */
export function buildWalkForwardWindows(
  totalBars: number,
  warmupBars: number,
  numWindows = 3,
  candles: CandleData[] = [],
): WalkForwardWindow[] {
  const usable = totalBars - warmupBars;
  const windowLength = Math.floor(usable / (numWindows + 1));
  const windows: WalkForwardWindow[] = [];

  for (let w = 0; w < numWindows; w++) {
    const trainStart = warmupBars + w * Math.floor(windowLength * 0.7);
    const trainEnd = trainStart + windowLength;
    const testStart = trainEnd;
    const testEnd = Math.min(totalBars, testStart + Math.floor(windowLength * 0.5));

    if (testEnd <= testStart) break;

    const segment = candles.slice(testStart, testEnd);
    const regime = classifyMarketRegime(segment);

    windows.push({
      windowIndex: w + 1,
      trainStart,
      trainEnd,
      testStart,
      testEnd,
      trainStartDate: candles[trainStart] ? new Date(candles[trainStart].openTime).toISOString().slice(0, 10) : "",
      trainEndDate: candles[trainEnd] ? new Date(candles[trainEnd].openTime).toISOString().slice(0, 10) : "",
      testStartDate: candles[testStart] ? new Date(candles[testStart].openTime).toISOString().slice(0, 10) : "",
      testEndDate: candles[testEnd - 1] ? new Date(candles[testEnd - 1].closeTime).toISOString().slice(0, 10) : "",
      regime,
    });
  }

  return windows;
}

/**
 * Main Orchestrator
 */
async function main() {
  console.log(`\n🚀 NEXUS ALPHA — Quantitative Multi-Strategy Walk-Forward Engine Starting...`);
  console.log(`Deductions: 0.08% Binance Futures taker fee + 0.04% conservative slippage = 0.12% per roundtrip.`);

  const symbols = ["BTCUSDT", "ETHUSDT"];

  for (const sym of symbols) {
    // ═════════════════════════════════════════════════════════════════════════
    // 1. 15-Minute Timeframe Walk-Forward (15m execution with 1h trend filter)
    // ═════════════════════════════════════════════════════════════════════════
    const [c15m, c1h] = await Promise.all([
      fetchBinanceHistory(sym, "15m", 3500),
      fetchBinanceHistory(sym, "1h", 2000),
    ]);

    const total15m = c15m.length;
    const warmup15m = 350;

    console.log(`\n################################################################################`);
    console.log(`📈 SYMBOL: ${sym} — TIMEFRAME: 15-MINUTE (Total Bars: ${total15m})`);
    console.log(`################################################################################`);

    // Build 3 Walk-Forward Windows
    const windows15m = buildWalkForwardWindows(total15m, warmup15m, 3, c15m);

    const wfTradesLegacy: BacktestTrade[] = [];
    const wfTradesEnhanced: BacktestTrade[] = [];
    const wfTradesBreakout: BacktestTrade[] = [];

    for (const win of windows15m) {
      console.log(`\n▶ [Walk-Forward Window ${win.windowIndex}]:`);
      console.log(`   Train Period: ${win.trainStartDate} -> ${win.trainEndDate} (${win.trainEnd - win.trainStart} bars)`);
      console.log(`   Test Period:  ${win.testStartDate} -> ${win.testEndDate} (${win.testEnd - win.testStart} bars) | Regime: ${win.regime}`);

      // Run Out-of-Sample test on this window
      const legRun = simulateStrategyRun("legacy", "15m", c15m, c1h, win.testStart, win.testEnd, win.windowIndex);
      const enhRun = simulateStrategyRun("enhanced", "15m", c15m, c1h, win.testStart, win.testEnd, win.windowIndex);
      const brkRun = simulateStrategyRun("breakout_only", "15m", c15m, c1h, win.testStart, win.testEnd, win.windowIndex);

      wfTradesLegacy.push(...legRun.trades);
      wfTradesEnhanced.push(...enhRun.trades);
      wfTradesBreakout.push(...brkRun.trades);

      print3WayTable(
        `${sym} [15M] — Window ${win.windowIndex} Out-of-Sample`,
        legRun.metrics,
        enhRun.metrics,
        brkRun.metrics,
        win.regime,
      );
    }

    // Aggregated Walk-Forward Out-of-Sample Results
    const aggLegacy = calculateMetrics("legacy", "15m", 0, wfTradesLegacy, {});
    const aggEnhanced = calculateMetrics("enhanced", "15m", 0, wfTradesEnhanced, {});
    const aggBreakout = calculateMetrics("breakout_only", "15m", 0, wfTradesBreakout, {});

    console.log(`\n🏆 [AGGREGATED WALK-FORWARD SUMMARY — ${sym} 15M (All Out-of-Sample Windows Combined)]:`);
    print3WayTable(`${sym} [15M] — FULL WALK-FORWARD OUT-OF-SAMPLE`, aggLegacy, aggEnhanced, aggBreakout);

    // ═════════════════════════════════════════════════════════════════════════
    // 2. 1-Hour Timeframe Walk-Forward (1h execution)
    // ═════════════════════════════════════════════════════════════════════════
    const total1h = c1h.length;
    const warmup1h = 250;

    console.log(`\n################################################################################`);
    console.log(`📈 SYMBOL: ${sym} — TIMEFRAME: 1-HOUR (Total Bars: ${total1h})`);
    console.log(`################################################################################`);

    const windows1h = buildWalkForwardWindows(total1h, warmup1h, 2, c1h);

    const wfTradesLegacy1h: BacktestTrade[] = [];
    const wfTradesEnhanced1h: BacktestTrade[] = [];
    const wfTradesBreakout1h: BacktestTrade[] = [];

    for (const win of windows1h) {
      console.log(`\n▶ [Walk-Forward Window ${win.windowIndex} (1H)]:`);
      console.log(`   Train Period: ${win.trainStartDate} -> ${win.trainEndDate} (${win.trainEnd - win.trainStart} bars)`);
      console.log(`   Test Period:  ${win.testStartDate} -> ${win.testEndDate} (${win.testEnd - win.testStart} bars) | Regime: ${win.regime}`);

      const legRun = simulateStrategyRun("legacy", "1h", c1h, c1h, win.testStart, win.testEnd, win.windowIndex);
      const enhRun = simulateStrategyRun("enhanced", "1h", c1h, c1h, win.testStart, win.testEnd, win.windowIndex);
      const brkRun = simulateStrategyRun("breakout_only", "1h", c1h, c1h, win.testStart, win.testEnd, win.windowIndex);

      wfTradesLegacy1h.push(...legRun.trades);
      wfTradesEnhanced1h.push(...enhRun.trades);
      wfTradesBreakout1h.push(...brkRun.trades);

      print3WayTable(
        `${sym} [1H] — Window ${win.windowIndex} Out-of-Sample`,
        legRun.metrics,
        enhRun.metrics,
        brkRun.metrics,
        win.regime,
      );
    }

    const aggLegacy1h = calculateMetrics("legacy", "1h", 0, wfTradesLegacy1h, {});
    const aggEnhanced1h = calculateMetrics("enhanced", "1h", 0, wfTradesEnhanced1h, {});
    const aggBreakout1h = calculateMetrics("breakout_only", "1h", 0, wfTradesBreakout1h, {});

    console.log(`\n🏆 [AGGREGATED WALK-FORWARD SUMMARY — ${sym} 1H (All Out-of-Sample Windows Combined)]:`);
    print3WayTable(`${sym} [1H] — FULL WALK-FORWARD OUT-OF-SAMPLE`, aggLegacy1h, aggEnhanced1h, aggBreakout1h);
  }

  console.log(`🏁 Complete Multi-Strategy Walk-Forward Analysis Finished.`);
}

main().catch((err) => {
  console.error("Backtest failed:", err);
  process.exit(1);
});
