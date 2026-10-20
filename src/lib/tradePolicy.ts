// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Unified Trade Policy & Deterministic Validation Engine
// Single source of truth for all thresholds and acceptance rules.
// Used by: ai-analyze route, deterministic fallback, AutoMonitorToggle.
// ═══════════════════════════════════════════════════════════════════════════

import type { AiTradeRecommendation, QuantMatrix } from "./types";

// ── Policy Configuration ───────────────────────────────────────────────────
/**
 * RVOL_MIN_THRESHOLD: Minimum Relative Volume required for any live trade.
 * Strategy document: Institutional setups require confirmed volume >= 1.3x
 * to filter false breakouts and illiquid moves.
 *
 * This is the single authoritative RVOL gate. Do NOT scatter this value.
 * Both the AI prompt and the deterministic fallback MUST use this constant.
 */
export const RVOL_MIN_THRESHOLD = 1.3;

/**
 * MIN_CONFIDENCE_TO_ALERT: Minimum confluence/confidence score
 * required before any Telegram alert or trade recommendation is issued.
 */
export const MIN_CONFIDENCE_TO_ALERT = 80;

/**
 * DATA_SOURCE_REAL: Value used to mark a recommendation whose candles
 * came from a real exchange feed.
 */
export const DATA_SOURCE_REAL = "REAL_EXCHANGE_DATA";
export const DATA_SOURCE_SYNTHETIC = "SYNTHETIC_DATA";

// ── Scoring Heuristic ──────────────────────────────────────────────────────
/**
 * computeDeterministicScore — Transparent deterministic scoring formula.
 *
 * Inputs and weights (total = 100):
 *   - Trend alignment (EMA50/200):     40 pts  (40% — primary signal)
 *   - RVOL above threshold:            30 pts  (30% — liquidity confirmation)
 *   - Price clear of swing extremes:   20 pts  (20% — safe entry clearance)
 *   - BTC stability (not dumping):     10 pts  (10% — market health guard)
 *
 * NOTE: This is a rule-based heuristic, not a statistical win probability.
 * It reflects confluence of confirming indicators, not expected profit rate.
 */
export function computeDeterministicScore({
  trend,
  rvol,
  priceDistToExtremesPct,
  btcDumpRisk,
}: {
  trend: QuantMatrix["trend"];
  rvol: number;
  /** Percentage distance from price to nearest swing extreme (0 to 1) */
  priceDistToExtremesPct: number;
  btcDumpRisk: boolean;
}): number {
  // If BTC is dumping, zero score — capital preservation
  if (btcDumpRisk) return 0;
  // Choppy market = zero directional confidence
  if (trend === "CHOPPY_SIDEWAYS") return 0;

  let score = 0;

  // 1. Trend alignment (40 pts)
  if (trend === "STRONG_BULLISH" || trend === "STRONG_BEARISH") {
    score += 40;
  }

  // 2. RVOL (30 pts, scaled between threshold and 2.0x)
  if (isFinite(rvol) && rvol >= RVOL_MIN_THRESHOLD) {
    // Full 30 pts at RVOL >= 2.0, proportional between 1.3 and 2.0
    const rvolScore = Math.min(30, ((rvol - RVOL_MIN_THRESHOLD) / (2.0 - RVOL_MIN_THRESHOLD)) * 30);
    score += rvolScore;
  }

  // 3. Price clearance from swing extremes (20 pts)
  // priceDistToExtremesPct > 0.004 (0.4%) = full score; below = proportional
  if (priceDistToExtremesPct > 0) {
    const clearanceScore = Math.min(20, (priceDistToExtremesPct / 0.015) * 20);
    score += clearanceScore;
  }

  // 4. BTC health (10 pts) — already 0 if dump risk; add 10 if stable
  score += 10;

  return Math.round(Math.min(100, Math.max(0, score)));
}

// ── R:R Calculator ─────────────────────────────────────────────────────────
/**
 * Calculate reward-to-risk ratio from actual prices.
 * Returns formatted string "1:X.XX" or null if invalid.
 * The ratio is calculated using TP2 (final target) as the primary reward.
 */
export function calculateRiskReward(
  side: "LONG" | "SHORT",
  entry: number,
  stopLoss: number,
  target: number,
): string | null {
  if (!isFinite(entry) || !isFinite(stopLoss) || !isFinite(target)) return null;
  if (entry <= 0 || stopLoss <= 0 || target <= 0) return null;

  let risk: number;
  let reward: number;

  if (side === "SHORT") {
    risk = stopLoss - entry;   // SL above entry for SHORT
    reward = entry - target;   // TP below entry for SHORT
  } else {
    risk = entry - stopLoss;   // SL below entry for LONG
    reward = target - entry;   // TP above entry for LONG
  }

  if (risk <= 0 || reward <= 0) return null;

  const ratio = reward / risk;
  return `1:${ratio.toFixed(2)}`;
}

/**
 * Calculate both TP1 and TP2 reward-to-risk ratios separately.
 */
export function calculateRiskRewardBoth(
  side: "LONG" | "SHORT",
  entry: number,
  stopLoss: number,
  tp1: number,
  tp2: number,
): { rrTp1: string | null; rrTp2: string | null } {
  return {
    rrTp1: calculateRiskReward(side, entry, stopLoss, tp1),
    rrTp2: calculateRiskReward(side, entry, stopLoss, tp2),
  };
}

// ── RVOL Validation ─────────────────────────────────────────────────────────
/**
 * validateRvol — Programmatic RVOL gate.
 * Returns true only if RVOL is finite, positive, and >= RVOL_MIN_THRESHOLD.
 * Missing, NaN, Infinity, or negative values are rejected.
 */
export function validateRvol(rvol: number | undefined | null): boolean {
  if (rvol === undefined || rvol === null) return false;
  if (!isFinite(rvol)) return false;
  if (rvol < 0) return false;
  return rvol >= RVOL_MIN_THRESHOLD;
}

// ── Final Trade Validator ───────────────────────────────────────────────────
export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string; code: ValidationFailureCode };

export type ValidationFailureCode =
  | "INVALID_DATA_SOURCE"       // synthetic data used in live path
  | "INVALID_SYMBOL"            // symbol rejected by exchange
  | "INVALID_STATUS"            // status is not a tradeable value
  | "INVALID_PRICES"            // entry/sl/tp non-finite or zero
  | "INVALID_PRICE_ORDERING"    // LONG: sl<entry<tp violated; SHORT: sl>entry>tp violated
  | "ZERO_RISK_DISTANCE"        // SL == entry
  | "RVOL_TOO_LOW"              // RVOL below RVOL_MIN_THRESHOLD
  | "INVALID_RR"                // R:R could not be calculated
  | "INVALID_CONFIDENCE"        // confidence score outside 0-100

/**
 * validateTradeRecommendation — Deterministic final gate.
 *
 * Must be called after all AI and strategy processing, before:
 * - Displaying a trade in the dashboard
 * - Sending a Telegram alert
 * - Saving to Supabase as a valid signal
 *
 * Returns { valid: true } only if all conditions pass.
 * An invalid recommendation MUST NOT be treated as a trade.
 */
export function validateTradeRecommendation(
  rec: AiTradeRecommendation,
  dataSource?: string,
): ValidationResult {
  const { status, entry_price, stop_loss, take_profit_1, take_profit_2, confidence_score, quant_matrix } = rec;

  // 1. Must be a real trade status
  if (status !== "LONG" && status !== "SHORT" && status !== "SPOT_BUY") {
    return { valid: false, reason: `Status "${status}" is not a tradeable setup.`, code: "INVALID_STATUS" };
  }

  // 2. Data source must not be synthetic for live trades
  if (dataSource === DATA_SOURCE_SYNTHETIC) {
    return {
      valid: false,
      reason: "Recommendation generated from synthetic/simulated candle data. Real exchange data required.",
      code: "INVALID_DATA_SOURCE",
    };
  }

  // 3. All prices must be finite and positive
  const prices = [entry_price, stop_loss, take_profit_1, take_profit_2];
  if (prices.some((p) => !isFinite(p) || p <= 0)) {
    return { valid: false, reason: "Entry, SL, or TP contains invalid (zero/NaN/Infinity) values.", code: "INVALID_PRICES" };
  }

  // 4. Price ordering
  if (status === "LONG" || status === "SPOT_BUY") {
    if (!(stop_loss < entry_price && entry_price < take_profit_1 && take_profit_1 <= take_profit_2)) {
      return {
        valid: false,
        reason: `LONG price ordering violated: expected SL(${stop_loss}) < Entry(${entry_price}) < TP1(${take_profit_1}) <= TP2(${take_profit_2})`,
        code: "INVALID_PRICE_ORDERING",
      };
    }
  } else if (status === "SHORT") {
    if (!(stop_loss > entry_price && entry_price > take_profit_1 && take_profit_1 >= take_profit_2)) {
      return {
        valid: false,
        reason: `SHORT price ordering violated: expected SL(${stop_loss}) > Entry(${entry_price}) > TP1(${take_profit_1}) >= TP2(${take_profit_2})`,
        code: "INVALID_PRICE_ORDERING",
      };
    }
  }

  // 5. Risk distance must be positive
  const riskDist = status === "SHORT"
    ? stop_loss - entry_price
    : entry_price - stop_loss;
  if (riskDist <= 0) {
    return { valid: false, reason: "Risk distance is zero or negative — cannot calculate R:R.", code: "ZERO_RISK_DISTANCE" };
  }

  // 6. RVOL must meet policy threshold
  if (quant_matrix) {
    if (!validateRvol(quant_matrix.rvol)) {
      return {
        valid: false,
        reason: `RVOL ${quant_matrix.rvol?.toFixed(2) ?? "N/A"} is below required minimum of ${RVOL_MIN_THRESHOLD}.`,
        code: "RVOL_TOO_LOW",
      };
    }
  }

  // 7. Confidence score must be 0-100
  if (!isFinite(confidence_score) || confidence_score < 0 || confidence_score > 100) {
    return { valid: false, reason: `Confidence score ${confidence_score} is outside valid range 0-100.`, code: "INVALID_CONFIDENCE" };
  }

  return { valid: true };
}
