// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Signal Integrity Test Suite (Phase 1)
// Uses Node.js 22 built-in test runner (node:test & node:assert)
// Zero external test dependencies required.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  RVOL_MIN_THRESHOLD,
  validateRvol,
  calculateRiskReward,
  calculateRiskRewardBoth,
  computeDeterministicScore,
  validateTradeRecommendation,
  DATA_SOURCE_SYNTHETIC,
  DATA_SOURCE_REAL,
} from "../lib/tradePolicy.ts";
import type { AiTradeRecommendation } from "../lib/types.ts";

// ── Helper: Build minimal valid AiTradeRecommendation ─────────────────────
function makeRec(overrides: Partial<AiTradeRecommendation> = {}): AiTradeRecommendation {
  return {
    status: "LONG",
    symbol: "BTCUSDT",
    confidence_score: 82,
    confluence_score: 82,
    timeframe_confluence: "EMA Confirmed",
    entry_price: 100,
    stop_loss: 90,        // LONG: SL < Entry
    take_profit_1: 110,   // TP1 > Entry
    take_profit_2: 120,   // TP2 > TP1
    risk_reward_ratio: "1:2.00",
    reasoning_arabic: "اختبار",
    btc_warning: null,
    timestamp: Date.now(),
    quant_matrix: {
      currentLivePrice: 100,
      trend: "STRONG_BULLISH",
      ema50: 98,
      ema200: 95,
      atr14: 5,
      rvol: 1.5,          // Above RVOL_MIN_THRESHOLD
      volumeStatus: "CONFIRMED_LIQUIDITY",
      highestHigh20: 115,
      lowestLow20: 88,
      longLevels: { mathSl: 90, mathTp1: 110, mathTp2: 120, riskRewardRatio: "1:2.00" },
      shortLevels: { mathSl: 110, mathTp1: 90, mathTp2: 80, riskRewardRatio: "1:1.33" },
    },
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. RVOL Threshold Tests
// ═══════════════════════════════════════════════════════════════════════════
describe("RVOL threshold (RVOL_MIN_THRESHOLD = 1.3)", () => {
  it("[T-01] RVOL_MIN_THRESHOLD is exactly 1.3", () => {
    assert.strictEqual(RVOL_MIN_THRESHOLD, 1.3);
  });

  it("[T-02] RVOL 1.22 is rejected (below threshold)", () => {
    assert.strictEqual(validateRvol(1.22), false);
  });

  it("[T-03] RVOL 1.29 is rejected (just below threshold)", () => {
    assert.strictEqual(validateRvol(1.29), false);
  });

  it("[T-04] RVOL 1.30 is accepted (exactly at threshold)", () => {
    assert.strictEqual(validateRvol(1.30), true);
  });

  it("[T-05] RVOL 1.50 is accepted (above threshold)", () => {
    assert.strictEqual(validateRvol(1.50), true);
  });

  it("[T-06] RVOL NaN is rejected", () => {
    assert.strictEqual(validateRvol(NaN), false);
  });

  it("[T-07] RVOL null is rejected", () => {
    assert.strictEqual(validateRvol(null), false);
  });

  it("[T-08] RVOL undefined is rejected", () => {
    assert.strictEqual(validateRvol(undefined), false);
  });

  it("[T-09] Negative RVOL is rejected", () => {
    assert.strictEqual(validateRvol(-1), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. R:R Calculation Tests (replaces hardcoded 1:2.0)
// ═══════════════════════════════════════════════════════════════════════════
describe("calculateRiskReward — Real R:R from actual prices", () => {
  it("[T-10] LONG: entry=100, SL=90, TP1=110 => R:R TP1 = 1:1.00", () => {
    const rr = calculateRiskReward("LONG", 100, 90, 110);
    assert.strictEqual(rr, "1:1.00");
  });

  it("[T-11] LONG: entry=100, SL=90, TP2=120 => R:R TP2 = 1:2.00", () => {
    const rr = calculateRiskReward("LONG", 100, 90, 120);
    assert.strictEqual(rr, "1:2.00");
  });

  it("[T-12] SHORT: entry=100, SL=110, TP1=90 => R:R TP1 = 1:1.00", () => {
    const rr = calculateRiskReward("SHORT", 100, 110, 90);
    assert.strictEqual(rr, "1:1.00");
  });

  it("[T-13] SHORT: entry=100, SL=115, TP2=67.5 => R:R TP2 = 1:2.17", () => {
    // Risk = 115 - 100 = 15; Reward (TP2) = 100 - 67.5 = 32.5; R:R = 32.5/15 = 2.17
    const rr = calculateRiskReward("SHORT", 100, 115, 67.5);
    assert.strictEqual(rr, "1:2.17");
  });

  it("[T-14] SOXLUSDT audit case: entry=99.49, SL=121.14, TP2=48.97 => NOT 1:2.0", () => {
    // Audit confirmed: true TP2 R:R is 1:2.33, not hardcoded 1:2.0
    const rr = calculateRiskReward("SHORT", 99.49, 121.14, 48.97);
    assert.notStrictEqual(rr, "1:2.0");
    assert.notStrictEqual(rr, null);
    const ratio = parseFloat((rr ?? "0").replace("1:", ""));
    assert.ok(Math.abs(ratio - 2.33) < 0.05, `Expected close to 2.33, got ${ratio}`);
  });

  it("[T-15] Zero risk distance returns null", () => {
    const rr = calculateRiskReward("LONG", 100, 100, 110); // SL == entry
    assert.strictEqual(rr, null);
  });

  it("[T-16] Negative reward (wrong direction) returns null", () => {
    const rr = calculateRiskReward("LONG", 100, 90, 85); // TP below entry for LONG
    assert.strictEqual(rr, null);
  });

  it("[T-17] calculateRiskRewardBoth returns both TP1 and TP2 ratios", () => {
    const { rrTp1, rrTp2 } = calculateRiskRewardBoth("LONG", 100, 90, 110, 120);
    assert.strictEqual(rrTp1, "1:1.00");
    assert.strictEqual(rrTp2, "1:2.00");
  });

  it("[T-18] ATR-based levels: entry=100, ATR=10, SHORT => SL=115, TP1=80, TP2=65 => R:R TP2 = 1:2.33", () => {
    const rr = calculateRiskReward("SHORT", 100, 115, 65);
    assert.notStrictEqual(rr, null);
    const ratio = parseFloat((rr ?? "0").replace("1:", ""));
    assert.ok(Math.abs(ratio - 2.33) < 0.05, `Expected close to 2.33, got ${ratio}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Final Trade Validator Tests
// ═══════════════════════════════════════════════════════════════════════════
describe("validateTradeRecommendation — Final gate", () => {
  it("[T-19] Valid LONG recommendation passes validator", () => {
    const result = validateTradeRecommendation(makeRec(), DATA_SOURCE_REAL);
    assert.strictEqual(result.valid, true);
  });

  it("[T-20] Valid SHORT recommendation passes validator", () => {
    const rec = makeRec({
      status: "SHORT",
      entry_price: 100,
      stop_loss: 110,   // SHORT: SL > entry
      take_profit_1: 90,
      take_profit_2: 80,
      quant_matrix: {
        currentLivePrice: 100,
        trend: "STRONG_BEARISH",
        ema50: 102, ema200: 105, atr14: 5,
        rvol: 1.5, volumeStatus: "CONFIRMED_LIQUIDITY",
        highestHigh20: 112, lowestLow20: 78,
        longLevels: { mathSl: 90, mathTp1: 110, mathTp2: 120, riskRewardRatio: "1:2.00" },
        shortLevels: { mathSl: 110, mathTp1: 90, mathTp2: 80, riskRewardRatio: "1:1.33" },
      },
    });
    const result = validateTradeRecommendation(rec, DATA_SOURCE_REAL);
    assert.strictEqual(result.valid, true);
  });

  it("[T-21] Signal from synthetic data source is rejected", () => {
    const result = validateTradeRecommendation(makeRec(), DATA_SOURCE_SYNTHETIC);
    assert.strictEqual(result.valid, false);
    if (!result.valid) {
      assert.strictEqual(result.code, "INVALID_DATA_SOURCE");
    }
  });

  it("[T-22] NO_CLEAR_SETUP status is rejected (not tradeable)", () => {
    const rec = makeRec({ status: "NO_CLEAR_SETUP" });
    const result = validateTradeRecommendation(rec, DATA_SOURCE_REAL);
    assert.strictEqual(result.valid, false);
    if (!result.valid) {
      assert.strictEqual(result.code, "INVALID_STATUS");
    }
  });

  it("[T-23] LONG with zero entry_price is rejected", () => {
    const rec = makeRec({ entry_price: 0 });
    const result = validateTradeRecommendation(rec, DATA_SOURCE_REAL);
    assert.strictEqual(result.valid, false);
    if (!result.valid) {
      assert.strictEqual(result.code, "INVALID_PRICES");
    }
  });

  it("[T-24] LONG with SL > entry (wrong ordering) is rejected", () => {
    const rec = makeRec({ stop_loss: 110, entry_price: 100 });
    const result = validateTradeRecommendation(rec, DATA_SOURCE_REAL);
    assert.strictEqual(result.valid, false);
    if (!result.valid) {
      assert.strictEqual(result.code, "INVALID_PRICE_ORDERING");
    }
  });

  it("[T-25] SHORT with SL < entry (wrong ordering) is rejected", () => {
    const rec = makeRec({
      status: "SHORT",
      entry_price: 100,
      stop_loss: 90,
      take_profit_1: 85,
      take_profit_2: 80,
    });
    const result = validateTradeRecommendation(rec, DATA_SOURCE_REAL);
    assert.strictEqual(result.valid, false);
    if (!result.valid) {
      assert.strictEqual(result.code, "INVALID_PRICE_ORDERING");
    }
  });

  it("[T-26] LONG with RVOL = 1.22 in quant_matrix is rejected", () => {
    const rec = makeRec({
      quant_matrix: { ...makeRec().quant_matrix!, rvol: 1.22 },
    });
    const result = validateTradeRecommendation(rec, DATA_SOURCE_REAL);
    assert.strictEqual(result.valid, false);
    if (!result.valid) {
      assert.strictEqual(result.code, "RVOL_TOO_LOW");
    }
  });

  it("[T-27] LONG with RVOL = 1.30 in quant_matrix is accepted", () => {
    const rec = makeRec({
      quant_matrix: { ...makeRec().quant_matrix!, rvol: 1.30 },
    });
    const result = validateTradeRecommendation(rec, DATA_SOURCE_REAL);
    assert.strictEqual(result.valid, true);
  });

  it("[T-28] LONG with Infinity confidence_score is rejected", () => {
    const rec = makeRec({ confidence_score: Infinity });
    const result = validateTradeRecommendation(rec, DATA_SOURCE_REAL);
    assert.strictEqual(result.valid, false);
    if (!result.valid) {
      assert.strictEqual(result.code, "INVALID_CONFIDENCE");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Deterministic Score Tests (replaced hardcoded 84/86)
// ═══════════════════════════════════════════════════════════════════════════
describe("computeDeterministicScore — Transparent heuristic", () => {
  it("[T-29] BTC dump risk returns score 0", () => {
    const score = computeDeterministicScore({
      trend: "STRONG_BULLISH",
      rvol: 2.0,
      priceDistToExtremesPct: 0.02,
      btcDumpRisk: true,
    });
    assert.strictEqual(score, 0);
  });

  it("[T-30] Choppy sideways trend returns score 0", () => {
    const score = computeDeterministicScore({
      trend: "CHOPPY_SIDEWAYS",
      rvol: 2.0,
      priceDistToExtremesPct: 0.02,
      btcDumpRisk: false,
    });
    assert.strictEqual(score, 0);
  });

  it("[T-31] Strong bullish + high RVOL = score > 70 (good setup)", () => {
    const score = computeDeterministicScore({
      trend: "STRONG_BULLISH",
      rvol: 2.0,
      priceDistToExtremesPct: 0.02,
      btcDumpRisk: false,
    });
    assert.ok(score > 70, `Expected score > 70, got ${score}`);
  });

  it("[T-32] Score is always in range [0, 100]", () => {
    const score = computeDeterministicScore({
      trend: "STRONG_BEARISH",
      rvol: 5.0,  // extreme RVOL
      priceDistToExtremesPct: 1.0,  // extreme clearance
      btcDumpRisk: false,
    });
    assert.ok(score >= 0 && score <= 100, `Expected score between 0 and 100, got ${score}`);
  });
});
