// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Quantitative Math Engine (Deterministic Statistical Backend)
// EMA Trend Classification, ATR Volatility Anchors, RVOL & Key Swings
// ═══════════════════════════════════════════════════════════════════════════

import type { CandleData, QuantMatrix } from "./types.ts";
import { calculateRiskReward } from "./tradePolicy.ts";

export interface CandleSplitResult {
  closedCandles: CandleData[];
  formingCandle?: CandleData;
  isLastCandleClosed: boolean;
}

/**
 * Split candle array into verified closed candles and optional forming (unclosed) candle.
 * Eliminates Lookahead & Partial Candle distortion in indicator baselines.
 */
export function splitClosedCandles(
  candles: CandleData[],
  options?: { referenceTime?: number; assumeLastIsOpen?: boolean },
): CandleSplitResult {
  if (candles.length === 0) {
    return { closedCandles: [], isLastCandleClosed: true };
  }

  const last = candles[candles.length - 1];
  const refTime = options?.referenceTime ?? Date.now();

  let isLastOpen = false;
  if (options?.assumeLastIsOpen !== undefined) {
    isLastOpen = options.assumeLastIsOpen && candles.length > 1;
  } else if (last.closeTime && last.closeTime > refTime) {
    isLastOpen = true;
  }

  if (isLastOpen) {
    return {
      closedCandles: candles.slice(0, -1),
      formingCandle: last,
      isLastCandleClosed: false,
    };
  }

  return {
    closedCandles: candles,
    formingCandle: undefined,
    isLastCandleClosed: true,
  };
}

/**
 * Calculate Exponential Moving Average (EMA) with adaptive backfill
 */
export function calculateEMA(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  if (data.length < period) {
    period = Math.max(2, data.length);
  }

  const k = 2 / (period + 1);
  const emaArray: number[] = new Array(data.length);

  // Initial SMA seed over first 'period' values
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  emaArray[period - 1] = sum / period;

  // EMA accumulation
  for (let i = period; i < data.length; i++) {
    emaArray[i] = data[i] * k + emaArray[i - 1] * (1 - k);
  }

  // Backfill earlier values for consistent indexing
  for (let i = 0; i < period - 1; i++) {
    emaArray[i] = emaArray[period - 1];
  }

  return emaArray;
}

/**
 * Calculate Average True Range (ATR) over period (default 14)
 * TR = max(High - Low, |High - PrevClose|, |Low - PrevClose|)
 */
export function calculateATR(candles: CandleData[], period = 14): number {
  if (candles.length < 2) return 1.0;

  const trueRanges: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];

    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close),
    );
    trueRanges.push(tr);
  }

  if (trueRanges.length === 0) return 1.0;

  // Standard ATR smoothing using last 'period' True Ranges
  const slice = trueRanges.slice(-Math.min(period, trueRanges.length));
  const avg = slice.reduce((acc, val) => acc + val, 0) / slice.length;
  return Math.max(0.0001, avg);
}

/**
 * Calculate Relative Volume (RVOL) comparing closed candle volume fairly
 * against a 20-candle moving average of completed candles.
 */
export function calculateRVOL(
  candles: CandleData[],
  lookback = 20,
  options?: { referenceTime?: number; assumeLastIsOpen?: boolean },
): {
  rvol: number;
  status: "CONFIRMED_LIQUIDITY" | "LOW_LIQUIDITY";
  closedRvol: number;
  formingRvol?: number;
} {
  const { closedCandles, formingCandle } = splitClosedCandles(candles, options);

  if (closedCandles.length < 2) {
    return { rvol: 1.0, status: "LOW_LIQUIDITY", closedRvol: 1.0 };
  }

  // Target closed candle is the latest completed candle
  const targetCandle = closedCandles[closedCandles.length - 1];
  const baselineCandles = closedCandles.slice(-Math.min(lookback + 1, closedCandles.length), -1);

  if (baselineCandles.length === 0) {
    return { rvol: 1.0, status: "LOW_LIQUIDITY", closedRvol: 1.0 };
  }

  const sumVol = baselineCandles.reduce((acc, c) => acc + (c.volume || 0), 0);
  const avgVol = sumVol / baselineCandles.length;

  const rawRvol = avgVol > 0 ? (targetCandle.volume || 0) / avgVol : 1.0;
  const closedRvol = Math.round(rawRvol * 100) / 100;

  // Extrapolate forming candle volume if available
  let formingRvol: number | undefined;
  if (formingCandle && formingCandle.openTime && formingCandle.closeTime && avgVol > 0) {
    const duration = formingCandle.closeTime - formingCandle.openTime;
    const refTime = options?.referenceTime ?? Date.now();
    const elapsed = Math.max(1, refTime - formingCandle.openTime);
    const progressRatio = Math.min(1, Math.max(0.05, elapsed / duration));
    const projectedVolume = (formingCandle.volume || 0) / progressRatio;
    formingRvol = Math.round((projectedVolume / avgVol) * 100) / 100;
  }

  return {
    rvol: closedRvol,
    status: closedRvol >= 1.2 ? "CONFIRMED_LIQUIDITY" : "LOW_LIQUIDITY",
    closedRvol,
    formingRvol,
  };
}

/**
 * Find Highest High and Lowest Low over last 20 candles
 * Defaults to strictly evaluating completed (closed) candles.
 */
export function calculateKeySwings(
  candles: CandleData[],
  lookback = 20,
  options?: { referenceTime?: number; assumeLastIsOpen?: boolean },
): { highestHigh20: number; lowestLow20: number } {
  const { closedCandles } = splitClosedCandles(candles, options);
  const evaluationCandles = closedCandles.length > 0 ? closedCandles : candles;

  if (evaluationCandles.length === 0) {
    return { highestHigh20: 0, lowestLow20: 0 };
  }

  const slice = evaluationCandles.slice(-Math.min(lookback, evaluationCandles.length));
  let highestHigh20 = -Infinity;
  let lowestLow20 = Infinity;

  for (const c of slice) {
    if (c.high > highestHigh20) highestHigh20 = c.high;
    if (c.low < lowestLow20) lowestLow20 = c.low;
  }

  return {
    highestHigh20: Math.round(highestHigh20 * 100) / 100,
    lowestLow20: Math.round(lowestLow20 * 100) / 100,
  };
}

/**
 * Determine True Market Trend Classification:
 * - If Price > EMA_50 AND EMA_50 > EMA_200 -> STRONG_BULLISH
 * - If Price < EMA_50 AND EMA_50 < EMA_200 -> STRONG_BEARISH
 * - Otherwise -> CHOPPY_SIDEWAYS (Automatic NO_TRADE trigger)
 */
export function determineTrendClassification(
  price: number,
  ema50: number,
  ema200: number,
): "STRONG_BULLISH" | "STRONG_BEARISH" | "CHOPPY_SIDEWAYS" {
  if (price > ema50 && ema50 > ema200) {
    return "STRONG_BULLISH";
  }
  if (price < ema50 && ema50 < ema200) {
    return "STRONG_BEARISH";
  }
  return "CHOPPY_SIDEWAYS";
}

/**
 * Round price to appropriate precision based on price magnitude
 */
export function roundPrice(val: number): number {
  if (val >= 1000) return Math.round(val * 100) / 100;
  if (val >= 1) return Math.round(val * 10000) / 10000;
  return Math.round(val * 1000000) / 1000000;
}

/**
 * Compute the complete deterministic Quantitative Matrix in TypeScript
 */
export function computeQuantMatrix(
  candles1h: CandleData[],
  candles15m: CandleData[],
  explicitLivePrice?: number,
  options?: { referenceTime?: number; assumeLastIsOpen?: boolean },
): QuantMatrix {
  // 1. Separate closed and forming candles
  const { closedCandles: closed1h } = splitClosedCandles(candles1h, options);
  const { closedCandles: closed15m, formingCandle } = splitClosedCandles(candles15m, options);

  const evalCandles1h = closed1h.length >= 50 ? closed1h : candles1h;
  const evalCandles15m = closed15m.length >= 14 ? closed15m : candles15m;

  const latestCandle = formingCandle || evalCandles15m[evalCandles15m.length - 1];
  const currentLivePrice =
    explicitLivePrice && explicitLivePrice > 0
      ? explicitLivePrice
      : (latestCandle ? latestCandle.close : 100);

  // 2. Trend Classification on 1H timeframe using closed bars
  const closes1h = evalCandles1h.map((c) => c.close);
  const ema50Series = calculateEMA(closes1h, 50);
  const ema200Series = calculateEMA(closes1h, 200);

  const ema50 = ema50Series.length > 0 ? ema50Series[ema50Series.length - 1] : currentLivePrice;
  const ema200 = ema200Series.length > 0 ? ema200Series[ema200Series.length - 1] : currentLivePrice;

  const trend = determineTrendClassification(currentLivePrice, ema50, ema200);

  // 3. ATR 14 on closed 15M candles
  const atr14 = calculateATR(evalCandles15m, 14);

  // 4. RVOL comparing closed volume fairly against baseline
  const { rvol, status: volumeStatus, closedRvol, formingRvol } = calculateRVOL(
    candles15m,
    20,
    options,
  );

  // 5. Key Swings on closed 15M candles
  const { highestHigh20, lowestLow20 } = calculateKeySwings(candles15m, 20, options);

  // 6. Setup classification: Disentangle Breakout vs Pullback
  let setupType: "BREAKOUT" | "PULLBACK" | "NONE" = "NONE";

  if (trend === "STRONG_BULLISH") {
    // Breakout condition: price is breaking or has broken the 20-candle swing high
    if (currentLivePrice >= highestHigh20 * 0.998) {
      setupType = "BREAKOUT";
    } else if (
      currentLivePrice > ema50 &&
      (highestHigh20 - currentLivePrice) / currentLivePrice >= 0.006
    ) {
      // Pullback condition: price is in an uptrend above EMA50 with sufficient room to the high
      setupType = "PULLBACK";
    }
  } else if (trend === "STRONG_BEARISH") {
    // Breakdown condition: price is breaking or has broken the 20-candle swing low
    if (currentLivePrice <= lowestLow20 * 1.002) {
      setupType = "BREAKOUT";
    } else if (
      currentLivePrice < ema50 &&
      (currentLivePrice - lowestLow20) / currentLivePrice >= 0.006
    ) {
      // Pullback condition: price is in a downtrend below EMA50 with sufficient room to the low
      setupType = "PULLBACK";
    }
  }

  // 7. Standard ATR SL & TP Levels (100% backward compatible)
  const longSl = roundPrice(currentLivePrice - 1.5 * atr14);
  const longTp1 = roundPrice(currentLivePrice + 2.0 * atr14);
  const longTp2 = roundPrice(currentLivePrice + 3.5 * atr14);

  const shortSl = roundPrice(currentLivePrice + 1.5 * atr14);
  const shortTp1 = roundPrice(currentLivePrice - 2.0 * atr14);
  const shortTp2 = roundPrice(currentLivePrice - 3.5 * atr14);

  const longRrTp2 = calculateRiskReward("LONG", currentLivePrice, longSl, longTp2) ?? "N/A";
  const shortRrTp2 = calculateRiskReward("SHORT", currentLivePrice, shortSl, shortTp2) ?? "N/A";

  // 8. Specialized Breakout & Pullback Levels
  const breakoutLevels = {
    entry: currentLivePrice,
    mathSl: trend === "STRONG_BULLISH" ? roundPrice(currentLivePrice - 1.5 * atr14) : roundPrice(currentLivePrice + 1.5 * atr14),
    mathTp1: trend === "STRONG_BULLISH" ? roundPrice(currentLivePrice + 2.0 * atr14) : roundPrice(currentLivePrice - 2.0 * atr14),
    mathTp2: trend === "STRONG_BULLISH" ? roundPrice(currentLivePrice + 3.5 * atr14) : roundPrice(currentLivePrice - 3.5 * atr14),
    riskRewardRatio: trend === "STRONG_BULLISH" ? longRrTp2 : shortRrTp2,
  };

  const pullbackLongSl = roundPrice(Math.min(ema50 - 0.5 * atr14, currentLivePrice - 1.5 * atr14));
  const pullbackLongTp1 = roundPrice(highestHigh20);
  const pullbackLongTp2 = roundPrice(highestHigh20 + 1.5 * atr14);
  const pullbackLongRr = calculateRiskReward("LONG", currentLivePrice, pullbackLongSl, pullbackLongTp2) ?? "N/A";

  const pullbackShortSl = roundPrice(Math.max(ema50 + 0.5 * atr14, currentLivePrice + 1.5 * atr14));
  const pullbackShortTp1 = roundPrice(lowestLow20);
  const pullbackShortTp2 = roundPrice(lowestLow20 - 1.5 * atr14);
  const pullbackShortRr = calculateRiskReward("SHORT", currentLivePrice, pullbackShortSl, pullbackShortTp2) ?? "N/A";

  const pullbackLevels = {
    entry: currentLivePrice,
    mathSl: trend === "STRONG_BULLISH" ? pullbackLongSl : pullbackShortSl,
    mathTp1: trend === "STRONG_BULLISH" ? pullbackLongTp1 : pullbackShortTp1,
    mathTp2: trend === "STRONG_BULLISH" ? pullbackLongTp2 : pullbackShortTp2,
    riskRewardRatio: trend === "STRONG_BULLISH" ? pullbackLongRr : pullbackShortRr,
  };

  return {
    currentLivePrice: roundPrice(currentLivePrice),
    trend,
    ema50: roundPrice(ema50),
    ema200: roundPrice(ema200),
    atr14: roundPrice(atr14),
    rvol,
    volumeStatus,
    highestHigh20,
    lowestLow20,
    setupType,
    formingRvol,
    closedRvol,
    longLevels: {
      mathSl: longSl,
      mathTp1: longTp1,
      mathTp2: longTp2,
      riskRewardRatio: longRrTp2,
    },
    shortLevels: {
      mathSl: shortSl,
      mathTp1: shortTp1,
      mathTp2: shortTp2,
      riskRewardRatio: shortRrTp2,
    },
    breakoutLevels,
    pullbackLevels,
  };
}
