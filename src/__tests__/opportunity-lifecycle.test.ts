// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Opportunity Lifecycle & Deduplication Test Suite (Phase 2)
// Tests for: opportunityManager.ts (FSM State Transitions, Idempotency, Rules)
// Uses Node.js 22 built-in test runner (node:test & node:assert)
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  generateAlertIdempotencyKey,
  evalOpportunityTransition,
  isGoldSymbol,
  ALERT_COOLDOWN_MS,
  OPPORTUNITY_TTL_MS,
} from "../lib/opportunityManager.ts";
import type { MarketOpportunity } from "../lib/types.ts";

function makeOpp(overrides: Partial<MarketOpportunity> = {}): MarketOpportunity {
  return {
    symbol: "SOLUSDT",
    market: "crypto",
    trade_mode: "futures",
    direction: "LONG",
    state: "WATCHING",
    current_price: 150,
    trigger_price: 155,       // LONG trigger above current price
    target_sl: 145,           // SL below current price
    target_tp1: 165,
    target_tp2: 175,
    calculated_rr: "1:2.00",
    rvol: 1.6,
    confluence_score: 85,
    trend_bias: "STRONG_BULLISH",
    expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour in future
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Idempotency Key & Deduplication Tests
// ═══════════════════════════════════════════════════════════════════════════
describe("Idempotency Key Generator (Deduplication)", () => {
  it("[P2-01] Generates identical key for identical inputs in same time bucket", () => {
    const key1 = generateAlertIdempotencyKey("SOLUSDT", "LONG", 155.0);
    const key2 = generateAlertIdempotencyKey("SOLUSDT", "LONG", 155.0);
    assert.strictEqual(key1, key2);
  });

  it("[P2-02] Normalizes lowercase and uppercase symbols to same key", () => {
    const keyUpper = generateAlertIdempotencyKey("BTCUSDT", "LONG", 65000);
    const keyLower = generateAlertIdempotencyKey("btcusdt", "long", 65000);
    assert.strictEqual(keyUpper, keyLower);
  });

  it("[P2-03] Generates different keys for different directions (LONG vs SHORT)", () => {
    const keyLong = generateAlertIdempotencyKey("SOLUSDT", "LONG", 155.0);
    const keyShort = generateAlertIdempotencyKey("SOLUSDT", "SHORT", 155.0);
    assert.notStrictEqual(keyLong, keyShort);
  });

  it("[P2-04] Generates different keys for different symbols", () => {
    const keySol = generateAlertIdempotencyKey("SOLUSDT", "LONG", 155.0);
    const keyEth = generateAlertIdempotencyKey("ETHUSDT", "LONG", 155.0);
    assert.notStrictEqual(keySol, keyEth);
  });

  it("[P2-05] Key is a 32-character hexadecimal string", () => {
    const key = generateAlertIdempotencyKey("BTCUSDT", "SHORT", 60000);
    assert.strictEqual(key.length, 32);
    assert.match(key, /^[a-f0-9]{32}$/);
  });

  it("[P2-06] Cooldown constant is exactly 2 hours (7,200,000 ms)", () => {
    assert.strictEqual(ALERT_COOLDOWN_MS, 2 * 60 * 60 * 1000);
  });

  it("[P2-07] Opportunity TTL constant is exactly 90 minutes (5,400,000 ms)", () => {
    assert.strictEqual(OPPORTUNITY_TTL_MS, 90 * 60 * 1000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. FSM Opportunity Lifecycle State Transitions
// ═══════════════════════════════════════════════════════════════════════════
describe("FSM State Transitions (evalOpportunityTransition)", () => {
  it("[P2-08] WATCHING remains WATCHING if price has not hit trigger or SL", () => {
    const opp = makeOpp({ trigger_price: 155, target_sl: 145 });
    const { nextState } = evalOpportunityTransition(opp, 152); // between SL and trigger
    assert.strictEqual(nextState, "WATCHING");
  });

  it("[P2-09] LONG: WATCHING -> TRIGGERED when price reaches trigger_price", () => {
    const opp = makeOpp({ direction: "LONG", trigger_price: 155, target_sl: 145 });
    const { nextState } = evalOpportunityTransition(opp, 155.5); // >= trigger
    assert.strictEqual(nextState, "TRIGGERED");
  });

  it("[P2-10] SHORT: WATCHING -> TRIGGERED when price breaks below trigger_price", () => {
    const opp = makeOpp({
      direction: "SHORT",
      current_price: 150,
      trigger_price: 145, // SHORT trigger below current
      target_sl: 155,     // SL above current
    });
    const { nextState } = evalOpportunityTransition(opp, 144.5); // <= trigger
    assert.strictEqual(nextState, "TRIGGERED");
  });

  it("[P2-11] WATCHING -> EXPIRED when expires_at timestamp is in the past", () => {
    const opp = makeOpp({
      expires_at: new Date(Date.now() - 1000).toISOString(), // 1s ago
    });
    const { nextState } = evalOpportunityTransition(opp, 152);
    assert.strictEqual(nextState, "EXPIRED");
  });

  it("[P2-12] LONG: WATCHING -> INVALIDATED when price drops below target_sl before trigger", () => {
    const opp = makeOpp({ direction: "LONG", trigger_price: 155, target_sl: 145 });
    const { nextState, reason } = evalOpportunityTransition(opp, 144.0); // <= SL
    assert.strictEqual(nextState, "INVALIDATED");
    assert.ok(reason?.includes("وقف الخسارة"));
  });

  it("[P2-13] SHORT: WATCHING -> INVALIDATED when price rises above target_sl before trigger", () => {
    const opp = makeOpp({ direction: "SHORT", trigger_price: 145, target_sl: 155 });
    const { nextState } = evalOpportunityTransition(opp, 156.0); // >= SL
    assert.strictEqual(nextState, "INVALIDATED");
  });

  it("[P2-14] Crypto: WATCHING -> INVALIDATED when BTC Dump Risk is active", () => {
    const opp = makeOpp({ symbol: "SOLUSDT", market: "crypto" });
    const { nextState, reason } = evalOpportunityTransition(opp, 152, undefined, true);
    assert.strictEqual(nextState, "INVALIDATED");
    assert.ok(reason?.includes("BTC"));
  });

  it("[P2-15] Invalid/zero currentPrice results in DATA_UNAVAILABLE", () => {
    const opp = makeOpp();
    const { nextState } = evalOpportunityTransition(opp, 0);
    assert.strictEqual(nextState, "DATA_UNAVAILABLE");
  });

  it("[P2-16] Terminal states (ALERTED, INVALIDATED, EXPIRED) do not re-transition", () => {
    const alertedOpp = makeOpp({ state: "ALERTED" });
    const { nextState: s1 } = evalOpportunityTransition(alertedOpp, 200);
    assert.strictEqual(s1, "ALERTED");

    const invalidOpp = makeOpp({ state: "INVALIDATED" });
    const { nextState: s2 } = evalOpportunityTransition(invalidOpp, 200);
    assert.strictEqual(s2, "INVALIDATED");

    const expiredOpp = makeOpp({ state: "EXPIRED" });
    const { nextState: s3 } = evalOpportunityTransition(expiredOpp, 200);
    assert.strictEqual(s3, "EXPIRED");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Crypto vs Gold Asset Separation Tests
// ═══════════════════════════════════════════════════════════════════════════
describe("Crypto vs Gold Separation Rules", () => {
  it("[P2-17] Correctly identifies Gold symbols", () => {
    assert.strictEqual(isGoldSymbol("XAUUSD"), true);
    assert.strictEqual(isGoldSymbol("XAU/USD"), true);
    assert.strictEqual(isGoldSymbol("GOLD"), true);
    assert.strictEqual(isGoldSymbol("BTCUSDT"), false);
    assert.strictEqual(isGoldSymbol("SOLUSDT"), false);
  });

  it("[P2-18] Gold opportunities are NOT invalidated by BTC dump guard", () => {
    const goldOpp = makeOpp({
      symbol: "XAUUSD",
      market: "gold",
      direction: "LONG",
      trigger_price: 2700,
      target_sl: 2650,
      current_price: 2680,
    });
    // BTC dump is true, but symbol is Gold -> should NOT be invalidated by BTC dump
    const { nextState } = evalOpportunityTransition(goldOpp, 2680, undefined, true);
    assert.strictEqual(nextState, "WATCHING");
  });
});
