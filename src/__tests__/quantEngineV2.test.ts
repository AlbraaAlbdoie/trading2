// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Quantitative Engine V2 & Opportunity Ranker Unit Tests
// Tests Closed-Candle Separation, RVOL Fairness, EMA Warmup, and Multi-Factor Scoring
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  splitClosedCandles,
  calculateEMA,
  calculateATR,
  calculateRVOL,
  calculateKeySwings,
  computeQuantMatrix,
} from "../lib/quantEngine.ts";
import {
  evaluateOpportunity,
  rankOpportunities,
  MIN_ACTIONABLE_SCORE,
} from "../lib/opportunityRanker.ts";
import type { CandleData } from "../lib/types.ts";

function createCandles(count: number, basePrice = 100, intervalMs = 900000, startTime = 1000000): CandleData[] {
  const candles: CandleData[] = [];
  for (let i = 0; i < count; i++) {
    const openTime = startTime + i * intervalMs;
    const closeTime = openTime + intervalMs - 1;
    candles.push({
      openTime,
      closeTime,
      open: basePrice + i * 0.1,
      high: basePrice + i * 0.1 + 1.0,
      low: basePrice + i * 0.1 - 1.0,
      close: basePrice + i * 0.1 + 0.5,
      volume: 1000,
    });
  }
  return candles;
}

describe("Quantitative Engine V2 — Closed Candle & Math Verification", () => {
  it("[V2-01] splitClosedCandles separates completed candles from forming candle", () => {
    const candles = createCandles(10, 100, 900000, 1000000);
    const formingTime = candles[9].openTime + 300000; // middle of candle 9

    const result = splitClosedCandles(candles, { referenceTime: formingTime });
    assert.equal(result.isLastCandleClosed, false);
    assert.equal(result.closedCandles.length, 9);
    assert.equal(result.formingCandle?.openTime, candles[9].openTime);
  });

  it("[V2-02] RVOL compares closed candles fairly and does not distort early in forming candle", () => {
    const candles = createCandles(25, 100, 900000, 1000000);
    // Baseline candles have volume 1000
    // Candle 23 (last completed) has volume 1500 => RVOL should be 1.50
    candles[23].volume = 1500;
    // Candle 24 (forming candle at minute 1) has only 50 volume
    candles[24].volume = 50;

    const refTime = candles[24].openTime + 60000; // 1 minute in
    const rvolResult = calculateRVOL(candles, 20, { referenceTime: refTime });

    // Confirmed RVOL should be based on completed candle (1.50), NOT 0.05
    assert.equal(rvolResult.rvol, 1.5);
    assert.equal(rvolResult.status, "CONFIRMED_LIQUIDITY");
    assert.equal(rvolResult.closedRvol, 1.5);
    assert.ok(rvolResult.formingRvol !== undefined);
  });

  it("[V2-03] Key Swings ignores forming candle high wick and preserves closed structural levels", () => {
    const candles = createCandles(22, 100, 900000, 1000000);
    // Highest high of closed bars is 105
    candles[15].high = 105;
    // Forming candle spikes to 200 (unconfirmed)
    candles[21].high = 200;

    const refTime = candles[21].openTime + 60000;
    const swings = calculateKeySwings(candles, 20, { referenceTime: refTime });

    assert.equal(swings.highestHigh20, 105);
  });

  it("[V2-04] EMA calculation converges with independent mathematical reference", () => {
    const prices = Array.from({ length: 500 }, (_, i) => 100 + Math.sin(i / 10) * 10);
    const period = 50;
    const emaSeries = calculateEMA(prices, period);

    // Independent reference calculation
    const k = 2 / (period + 1);
    let refEma = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < prices.length; i++) {
      refEma = prices[i] * k + refEma * (1 - k);
    }

    const calculatedLast = emaSeries[emaSeries.length - 1];
    assert.ok(Math.abs(calculatedLast - refEma) < 1e-9, `Mismatch: ${calculatedLast} vs ${refEma}`);
  });

  it("[V2-05] computeQuantMatrix separates Breakout from Pullback without contradiction", () => {
    const candles1h = createCandles(300, 100, 3600000, 1000000);
    // Make 1h strongly bullish with steady upward trend
    for (let i = 0; i < candles1h.length; i++) {
      candles1h[i].close = 100 + i * 2;
    }
    // At index 299, close = 698. EMA50 is ~650, EMA200 is ~500

    const candles15m = createCandles(40, 650, 900000, 1000000);
    for (let i = 0; i < candles15m.length; i++) {
      candles15m[i].high = 670 + i * 1;
      candles15m[i].low = 650 + i * 1;
      candles15m[i].close = 660 + i * 1;
    }
    // 20-candle high on 15m is around 709

    // Breakout scenario: live price is breaking the 20-candle high (e.g. 715)
    const quantBreakout = computeQuantMatrix(candles1h, candles15m, 715);
    assert.equal(quantBreakout.trend, "STRONG_BULLISH");
    assert.equal(quantBreakout.setupType, "BREAKOUT");
    assert.ok(quantBreakout.breakoutLevels !== undefined);

    // Pullback scenario: price pulled back to 665 (above EMA50 ~ 650, below swing high ~ 709, room > 0.6%)
    const quantPullback = computeQuantMatrix(candles1h, candles15m, 665);
    assert.equal(quantPullback.trend, "STRONG_BULLISH");
    assert.equal(quantPullback.setupType, "PULLBACK");
    assert.ok(quantPullback.pullbackLevels !== undefined);
  });
});

describe("Opportunity Ranker — Multi-Factor Scoring & Selection", () => {
  it("[V2-06] Actionable setup requires confirmed trend, liquidity, and valid setup type", () => {
    const candles1h = createCandles(300, 100, 3600000, 1000000);
    for (let i = 0; i < candles1h.length; i++) {
      candles1h[i].close = 100 + i * 2;
    }

    const candles15m = createCandles(40, 600, 900000, 1000000);
    for (let i = 0; i < candles15m.length; i++) {
      candles15m[i].volume = 1000;
    }
    // Last completed 15m candle has high volume surge (RVOL = 1.8)
    candles15m[39].volume = 1800;

    const matrix = computeQuantMatrix(candles1h, candles15m, 750);
    const evaluation = evaluateOpportunity({
      symbol: "BTCUSDT",
      market: "crypto",
      tradeMode: "futures",
      quantMatrix: matrix,
      btcDumpRisk: false,
      quoteVolume24h: 100_000_000,
    });

    assert.equal(evaluation.isActionable, true);
    assert.ok(evaluation.score.totalScore >= MIN_ACTIONABLE_SCORE);
    assert.equal(evaluation.direction, "LONG");
    assert.equal(evaluation.setupType, "BREAKOUT");
  });

  it("[V2-07] Choppy sideways market receives 0 trend score and is strictly non-actionable", () => {
    const candles1h = createCandles(100, 100, 3600000, 1000000); // flat candles
    const candles15m = createCandles(40, 100, 900000, 1000000);

    const matrix = computeQuantMatrix(candles1h, candles15m, 100);
    const evaluation = evaluateOpportunity({
      symbol: "ETHUSDT",
      market: "crypto",
      tradeMode: "futures",
      quantMatrix: matrix,
      btcDumpRisk: false,
    });

    assert.equal(evaluation.isActionable, false);
    assert.equal(evaluation.score.trendScore, 0);
  });

  it("[V2-08] rankOpportunities sorts candidates by score descending and prioritizes actionable setups", () => {
    const evalA = {
      symbol: "AAA",
      market: "crypto",
      tradeMode: "futures",
      direction: "LONG",
      setupType: "BREAKOUT",
      isActionable: true,
      score: { trendScore: 25, liquidityScore: 25, structureScore: 20, volatilityScore: 15, macroScore: 10, totalScore: 95 },
    } as any;

    const evalB = {
      symbol: "BBB",
      market: "crypto",
      tradeMode: "futures",
      direction: null,
      setupType: "NONE",
      isActionable: false,
      score: { trendScore: 0, liquidityScore: 15, structureScore: 0, volatilityScore: 10, macroScore: 10, totalScore: 35 },
    } as any;

    const evalC = {
      symbol: "CCC",
      market: "crypto",
      tradeMode: "futures",
      direction: "LONG",
      setupType: "PULLBACK",
      isActionable: true,
      score: { trendScore: 20, liquidityScore: 20, structureScore: 15, volatilityScore: 15, macroScore: 10, totalScore: 80 },
    } as any;

    const ranked = rankOpportunities([evalB, evalA, evalC]);
    assert.equal(ranked[0].symbol, "AAA"); // 95
    assert.equal(ranked[1].symbol, "CCC"); // 80
    assert.equal(ranked[2].symbol, "BBB"); // non-actionable
  });
});
