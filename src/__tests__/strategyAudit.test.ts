// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Strategy & Backtest Audit Integrity Test Suite
// Verifies: Simultaneous SL/TP Conservative Collision, False Breakout Trap Wicks,
// Realistic Fee/Slippage Deductions, Inadequate Clearance, and Missing Data Safety.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateOpportunity,
  detectTrapWick,
  MIN_ACTIONABLE_SCORE,
  MIN_REWARD_DISTANCE_PCT,
} from "../lib/opportunityRanker.ts";
import {
  computeQuantMatrix,
  calculateEMA,
  calculateATR,
  splitClosedCandles,
} from "../lib/quantEngine.ts";
import { simulateStrategyRun } from "../../scripts/run-backtest.ts";
import type { CandleData, QuantMatrix } from "../lib/types.ts";

function createMockCandle(open: number, high: number, low: number, close: number, volume = 1000, time = 1000000): CandleData {
  return {
    openTime: time,
    closeTime: time + 899999,
    open,
    high,
    low,
    close,
    volume,
  };
}

describe("Backtest Integrity & Anti-Gaming Verification", () => {
  it("[AUDIT-01] Conservative collision rule: When both SL and TP are touched in the same bar, SL is hit first", () => {
    // Setup a 10-bar test where bar 1 generates an entry, and bar 2 has both extreme high and low
    const execCandles: CandleData[] = [];
    const trendCandles: CandleData[] = [];

    for (let i = 0; i < 200; i++) {
      const time = 1000000 + i * 900000;
      trendCandles.push(createMockCandle(100 + i * 2, 102 + i * 2, 99 + i * 2, 101 + i * 2, 2000, time));
    }

    for (let i = 0; i < 50; i++) {
      const time = 1000000 + i * 900000;
      execCandles.push(createMockCandle(400 + i * 2, 405 + i * 2, 395 + i * 2, 402 + i * 2, 2000, time));
    }

    // Bar 35: Extreme candle that touches both high (500) and low (200)
    execCandles[35] = createMockCandle(470, 600, 200, 470, 5000, execCandles[35].openTime);

    const result = simulateStrategyRun("breakout_only", "15m", execCandles, trendCandles, 30, 45);

    // If an active trade was open at bar 35, it MUST exit with SL, NOT TP
    const collisionTrade = result.trades.find((t) => t.exitBar === 35);
    if (collisionTrade) {
      assert.equal(collisionTrade.exitReason, "SL", "Must prioritize Stop Loss over Take Profit on simultaneous hit");
    }
  });

  it("[AUDIT-02] False Breakout Trap: Rejects breakout when signal candle has upper wick > 35%", () => {
    // Signal candle with huge upper rejection wick: Open 100, High 120, Low 99, Close 102
    // Range = 120 - 99 = 21. Upper wick = 120 - 102 = 18. Upper wick ratio = 18 / 21 = 85.7% > 35%
    const trapCandle = createMockCandle(100, 120, 99, 102, 3000);
    const isTrap = detectTrapWick("LONG", trapCandle);
    assert.equal(isTrap, true, "Should identify bull trap wick");

    // Clean breakout candle: Open 100, High 120, Low 99, Close 118
    // Range = 21. Upper wick = 120 - 118 = 2. Upper wick ratio = 2 / 21 = 9.5% <= 35%
    const cleanCandle = createMockCandle(100, 120, 99, 118, 3000);
    const isClean = detectTrapWick("LONG", cleanCandle);
    assert.equal(isClean, false, "Should pass clean breakout without trap wick");
  });

  it("[AUDIT-03] Net R:R Cost Gate: Rejects trades when target distance cannot cover 0.12% fees", () => {
    const mockMatrix: QuantMatrix = {
      currentLivePrice: 100,
      trend: "STRONG_BULLISH",
      ema50: 95,
      ema200: 90,
      atr14: 0.1, // extremely low ATR
      rvol: 2.0,
      volumeStatus: "CONFIRMED_LIQUIDITY",
      highestHigh20: 100.1,
      lowestLow20: 98,
      setupType: "BREAKOUT",
      longLevels: { mathSl: 99.85, mathTp1: 100.2, mathTp2: 100.35, riskRewardRatio: "1:2.33" },
      shortLevels: { mathSl: 100.15, mathTp1: 99.8, mathTp2: 99.65, riskRewardRatio: "1:2.33" },
    };

    // TP1 is 100.2, distance is only 0.2% (< MIN_REWARD_DISTANCE_PCT 0.5%)
    const evaluation = evaluateOpportunity({
      symbol: "TESTUSDT",
      market: "crypto",
      quantMatrix: mockMatrix,
      btcDumpRisk: false,
    });

    assert.equal(evaluation.isActionable, false);
    assert.equal(evaluation.rejectionCode, "REWARD_TOO_SMALL_FOR_FEES");
  });

  it("[AUDIT-04] Insufficient data safety: Handles fewer than 50 bars gracefully without crashing", () => {
    const shortSeries = [createMockCandle(100, 101, 99, 100, 1000)];
    const matrix = computeQuantMatrix(shortSeries, shortSeries, 100);
    assert.ok(matrix !== null);
    assert.equal(matrix.trend, "CHOPPY_SIDEWAYS");
  });

  it("[AUDIT-05] Zero qualifying opportunities: System outputs non-actionable state when criteria fail", () => {
    const mockMatrix: QuantMatrix = {
      currentLivePrice: 100,
      trend: "CHOPPY_SIDEWAYS",
      ema50: 100,
      ema200: 100,
      atr14: 1.0,
      rvol: 0.8,
      volumeStatus: "LOW_LIQUIDITY",
      highestHigh20: 105,
      lowestLow20: 95,
      setupType: "NONE",
      longLevels: { mathSl: 98.5, mathTp1: 102, mathTp2: 103.5, riskRewardRatio: "1:2.33" },
      shortLevels: { mathSl: 101.5, mathTp1: 98, mathTp2: 96.5, riskRewardRatio: "1:2.33" },
    };

    const evaluation = evaluateOpportunity({
      symbol: "BTCUSDT",
      market: "crypto",
      quantMatrix: mockMatrix,
      btcDumpRisk: true,
    });

    assert.equal(evaluation.isActionable, false);
    assert.equal(evaluation.direction, null);
  });
});
