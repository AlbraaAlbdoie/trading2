// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Quantitative Opportunity Ranker & Multi-Factor Scoring
// Replaces cosmetic confidence numbers with an auditable, testable scoring model.
// Evaluates Trend (25), Liquidity (25), Structure (20), Volatility (15), Macro (15).
// Includes False Breakout Trap Guard, Net R:R Cost Gate, and Breakout-Only mode.
// ═══════════════════════════════════════════════════════════════════════════

import type { QuantMatrix, TradeMode, CandleData } from "./types.ts";
import { calculateRiskReward } from "./tradePolicy.ts";
import { roundPrice } from "./quantEngine.ts";

export interface ScoreBreakdown {
  trendScore: number;       // 0–25 pts
  liquidityScore: number;   // 0–25 pts
  structureScore: number;   // 0–20 pts
  volatilityScore: number;  // 0–15 pts
  macroScore: number;       // 0–15 pts
  totalScore: number;       // 0–100 pts
}

export type RejectionCode =
  | "NONE"
  | "CHOPPY_SIDEWAYS"
  | "LOW_RVOL"
  | "BTC_DUMP_RISK"
  | "PULLBACK_DISABLED"
  | "SCORE_BELOW_THRESHOLD"
  | "FALSE_BREAKOUT_TRAP_WICK"
  | "REWARD_TOO_SMALL_FOR_FEES"
  | "NO_CLEAR_LEVELS";

export interface OpportunityEvaluation {
  symbol: string;
  market: "crypto" | "gold";
  tradeMode: TradeMode;
  direction: "LONG" | "SHORT" | null;
  setupType: "BREAKOUT" | "PULLBACK" | "NONE";
  isActionable: boolean;
  rejectionCode: RejectionCode;
  score: ScoreBreakdown;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskRewardRatio: string;
  reasoningArabic: string;
  quantMatrix: QuantMatrix;
}

export interface RankerInput {
  symbol: string;
  market: "crypto" | "gold";
  tradeMode?: TradeMode;
  quantMatrix: QuantMatrix;
  btcDumpRisk: boolean;
  quoteVolume24h?: number;
  breakoutOnly?: boolean;
  signalCandle?: CandleData;
}

export const MIN_ACTIONABLE_SCORE = 70;
export const MIN_REWARD_DISTANCE_PCT = 0.005; // 0.50% minimum distance to TP1 to clear 0.12% roundtrip fees

/**
 * Check if the signal candle exhibits an adverse rejection wick (False Breakout / Bull/Bear Trap).
 */
export function detectTrapWick(side: "LONG" | "SHORT", candle?: CandleData): boolean {
  if (!candle) return false;
  const range = candle.high - candle.low;
  if (range <= 0) return false;

  if (side === "LONG") {
    // Bull trap: Large upper wick (> 35% of total candle range) indicates sellers rejected the breakout
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    return upperWick / range > 0.35;
  } else {
    // Bear trap: Large lower wick (> 35% of total candle range) indicates buyers absorbed the breakdown
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    return lowerWick / range > 0.35;
  }
}

/**
 * Evaluate an asset quantitatively across all 5 statistical pillars.
 */
export function evaluateOpportunity(input: RankerInput): OpportunityEvaluation {
  const {
    symbol,
    market,
    tradeMode = "futures",
    quantMatrix,
    btcDumpRisk,
    quoteVolume24h = 0,
    breakoutOnly = false,
    signalCandle,
  } = input;

  const {
    currentLivePrice,
    trend,
    ema50,
    ema200,
    atr14,
    rvol,
    highestHigh20,
    lowestLow20,
    setupType = "NONE",
  } = quantMatrix;

  // ── 1. Trend Pillar (0–25 pts) ──────────────────────────────────────────
  let trendScore = 0;
  if (trend === "STRONG_BULLISH") {
    const emaSpreadPct = ema200 > 0 ? (ema50 - ema200) / ema200 : 0;
    trendScore = emaSpreadPct > 0.01 ? 25 : 20;
  } else if (trend === "STRONG_BEARISH" && tradeMode === "futures") {
    const emaSpreadPct = ema200 > 0 ? (ema200 - ema50) / ema200 : 0;
    trendScore = emaSpreadPct > 0.01 ? 25 : 20;
  } else {
    trendScore = 0;
  }

  // ── 2. Liquidity Pillar (0–25 pts) ──────────────────────────────────────
  let liquidityScore = 0;
  if (market === "gold") {
    liquidityScore = 20;
  } else {
    if (rvol >= 2.0) {
      liquidityScore = 25;
    } else if (rvol >= 1.5) {
      liquidityScore = 20;
    } else if (rvol >= 1.3) {
      liquidityScore = 15;
    } else {
      liquidityScore = 0;
    }
  }

  // ── 3. Structure & Clearance Pillar (0–20 pts) ──────────────────────────
  let structureScore = 0;
  let isTrapRisk = false;

  if (setupType === "BREAKOUT") {
    const directionCandidate = trend === "STRONG_BULLISH" ? "LONG" : "SHORT";
    isTrapRisk = detectTrapWick(directionCandidate, signalCandle);
    structureScore = isTrapRisk ? 5 : 20;
  } else if (setupType === "PULLBACK") {
    if (breakoutOnly) {
      structureScore = 0;
    } else if (trend === "STRONG_BULLISH") {
      const roomPct = highestHigh20 > 0 ? (highestHigh20 - currentLivePrice) / currentLivePrice : 0;
      structureScore = roomPct >= 0.01 ? 20 : 15;
    } else if (trend === "STRONG_BEARISH") {
      const roomPct = lowestLow20 > 0 ? (currentLivePrice - lowestLow20) / currentLivePrice : 0;
      structureScore = roomPct >= 0.01 ? 20 : 15;
    }
  } else {
    structureScore = 0;
  }

  // ── 4. Volatility Health Pillar (0–15 pts) ──────────────────────────────
  let volatilityScore = 0;
  const atrPct = currentLivePrice > 0 ? (atr14 / currentLivePrice) * 100 : 0;
  if (atrPct >= 0.6 && atrPct <= 3.5) {
    volatilityScore = 15;
  } else if (atrPct > 3.5 && atrPct <= 5.0) {
    volatilityScore = 10;
  } else if (atrPct < 0.6 && atrPct > 0.2) {
    volatilityScore = 8;
  } else {
    volatilityScore = 3;
  }

  // ── 5. Macro / Market Pillar (0–15 pts) ──────────────────────────────────
  let macroScore = 0;
  if (market === "crypto") {
    if (!btcDumpRisk) macroScore += 10;
    if (quoteVolume24h > 50_000_000) {
      macroScore += 5;
    } else if (quoteVolume24h > 10_000_000) {
      macroScore += 3;
    }
  } else {
    macroScore = 15;
  }

  const totalScore = Math.min(100, trendScore + liquidityScore + structureScore + volatilityScore + macroScore);
  const scoreBreakdown: ScoreBreakdown = {
    trendScore,
    liquidityScore,
    structureScore,
    volatilityScore,
    macroScore,
    totalScore,
  };

  // Determine Direction
  let direction: "LONG" | "SHORT" | null = null;
  if (trend === "STRONG_BULLISH" && (!btcDumpRisk || market === "gold")) {
    direction = "LONG";
  } else if (trend === "STRONG_BEARISH" && tradeMode === "futures") {
    direction = "SHORT";
  }

  // Determine Levels
  let entry = currentLivePrice;
  let stopLoss = currentLivePrice;
  let takeProfit1 = currentLivePrice;
  let takeProfit2 = currentLivePrice;
  let riskRewardRatio = "0:0";

  if (direction === "LONG") {
    if (setupType === "BREAKOUT") {
      entry = currentLivePrice;
      stopLoss = roundPrice(currentLivePrice - 1.5 * atr14);
      takeProfit1 = roundPrice(currentLivePrice + 2.0 * atr14);
      takeProfit2 = roundPrice(currentLivePrice + 3.5 * atr14);
      riskRewardRatio = calculateRiskReward("LONG", entry, stopLoss, takeProfit2) ?? "1:2.33";
    } else if (setupType === "PULLBACK") {
      entry = currentLivePrice;
      stopLoss = roundPrice(Math.min(ema50 - 0.5 * atr14, currentLivePrice - 1.5 * atr14));
      takeProfit1 = roundPrice(highestHigh20);
      takeProfit2 = roundPrice(highestHigh20 + 1.5 * atr14);
      riskRewardRatio = calculateRiskReward("LONG", entry, stopLoss, takeProfit2) ?? "1:2.00";
    }
  } else if (direction === "SHORT") {
    if (setupType === "BREAKOUT") {
      entry = currentLivePrice;
      stopLoss = roundPrice(currentLivePrice + 1.5 * atr14);
      takeProfit1 = roundPrice(currentLivePrice - 2.0 * atr14);
      takeProfit2 = roundPrice(currentLivePrice - 3.5 * atr14);
      riskRewardRatio = calculateRiskReward("SHORT", entry, stopLoss, takeProfit2) ?? "1:2.33";
    } else if (setupType === "PULLBACK") {
      entry = currentLivePrice;
      stopLoss = roundPrice(Math.max(ema50 + 0.5 * atr14, currentLivePrice + 1.5 * atr14));
      takeProfit1 = roundPrice(lowestLow20);
      takeProfit2 = roundPrice(lowestLow20 - 1.5 * atr14);
      riskRewardRatio = calculateRiskReward("SHORT", entry, stopLoss, takeProfit2) ?? "1:2.00";
    }
  }

  // Cost Gate: Reward distance must clear minimum fee & slippage threshold
  const rewardDistancePct = entry > 0 ? Math.abs(takeProfit1 - entry) / entry : 0;
  const isRewardAdequate = rewardDistancePct >= MIN_REWARD_DISTANCE_PCT;

  // Determine Rejection Code
  let rejectionCode: RejectionCode = "NONE";
  if (trend === "CHOPPY_SIDEWAYS") {
    rejectionCode = "CHOPPY_SIDEWAYS";
  } else if (market === "crypto" && btcDumpRisk) {
    rejectionCode = "BTC_DUMP_RISK";
  } else if (market === "crypto" && rvol < 1.3) {
    rejectionCode = "LOW_RVOL";
  } else if (breakoutOnly && setupType === "PULLBACK") {
    rejectionCode = "PULLBACK_DISABLED";
  } else if (setupType === "NONE") {
    rejectionCode = "NO_CLEAR_LEVELS";
  } else if (isTrapRisk) {
    rejectionCode = "FALSE_BREAKOUT_TRAP_WICK";
  } else if (!isRewardAdequate) {
    rejectionCode = "REWARD_TOO_SMALL_FOR_FEES";
  } else if (totalScore < MIN_ACTIONABLE_SCORE) {
    rejectionCode = "SCORE_BELOW_THRESHOLD";
  }

  const isActionable =
    direction !== null &&
    setupType !== "NONE" &&
    totalScore >= MIN_ACTIONABLE_SCORE &&
    (market === "gold" || rvol >= 1.3) &&
    !isTrapRisk &&
    isRewardAdequate &&
    (!breakoutOnly || setupType === "BREAKOUT");

  // Construct Arabic reasoning
  let reasoningArabic = "";
  if (!isActionable) {
    switch (rejectionCode) {
      case "CHOPPY_SIDEWAYS":
        reasoningArabic = `سوق متذبذب عرضي دون اتجاه مؤسساتي (EMA50 / EMA200 متداخلة). لا توجد أفضلية إحصائية للدخول.`;
        break;
      case "BTC_DUMP_RISK":
        reasoningArabic = `حارس البيتكوين نشط: رصد هبوط حاد وسريع في BTC. تم رفض إشارة الشراء للحفاظ على رأس المال.`;
        break;
      case "LOW_RVOL":
        reasoningArabic = `حجم التداول النسبي ضعيف (RVOL = ${rvol.toFixed(2)} < 1.30). لا يوجد تدفق سيولة مؤسساتي كافٍ.`;
        break;
      case "FALSE_BREAKOUT_TRAP_WICK":
        reasoningArabic = `تحذير اختراق كاذب (Trap Wick): شمعة الاختراق أظهرت ذيل رفض سعري عاكس يتجاوز 35% من مداها.`;
        break;
      case "REWARD_TOO_SMALL_FOR_FEES":
        reasoningArabic = `المسافة إلى الهدف الأول (${(rewardDistancePct * 100).toFixed(2)}%) غير كافية لتغطية رسوم التداول والانزلاق السعري بأمان.`;
        break;
      case "PULLBACK_DISABLED":
        reasoningArabic = `تم استبعاد نمط الارتداد (Pullback) وفقاً لسياسة التداول الحالية (Breakout Only Mode).`;
        break;
      default:
        reasoningArabic = `الفرصة لم تصل للحد الأدنى من التوافق الإحصائي (${totalScore}/${MIN_ACTIONABLE_SCORE}). لا توجد صفقة مقترحة.`;
        break;
    }
  } else {
    const setupName = setupType === "BREAKOUT" ? "اختراق زخم مؤكد (Breakout)" : "ارتداد تصحيحي مع الاتجاه (Trend Pullback)";
    const dirName = direction === "LONG" ? "شراء" : "بيع";
    reasoningArabic = `[توافق إحصائي كمي: ${totalScore}/100] إشارة ${dirName} مبنية على نمط ${setupName}. تأكيد سيولة RVOL = ${rvol.toFixed(2)}. مستويات المخاطرة والربح محددة لنسبة عائد ${riskRewardRatio}.`;
  }

  return {
    symbol,
    market,
    tradeMode,
    direction,
    setupType,
    isActionable,
    rejectionCode,
    score: scoreBreakdown,
    entry,
    stopLoss,
    takeProfit1,
    takeProfit2,
    riskRewardRatio,
    reasoningArabic,
    quantMatrix,
  };
}

/**
 * Rank multiple opportunities and select the highest quality setups.
 */
export function rankOpportunities(evaluations: OpportunityEvaluation[]): OpportunityEvaluation[] {
  return [...evaluations].sort((a, b) => {
    if (a.isActionable && !b.isActionable) return -1;
    if (!a.isActionable && b.isActionable) return 1;
    return b.score.totalScore - a.score.totalScore;
  });
}
