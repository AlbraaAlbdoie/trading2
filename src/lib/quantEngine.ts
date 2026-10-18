// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Quantitative Math Engine (Deterministic Statistical Backend)
// EMA Trend Classification, ATR Volatility Anchors, RVOL & Key Swings
// ═══════════════════════════════════════════════════════════════════════════

import type { CandleData, QuantMatrix } from "./types";

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

  // Initial SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  emaArray[period - 1] = sum / period;

  // EMA accumulation
  for (let i = period; i < data.length; i++) {
    emaArray[i] = data[i] * k + emaArray[i - 1] * (1 - k);
  }

  // Backfill earlier values
  for (let i = 0; i < period - 1; i++) {
    emaArray[i] = emaArray[period - 1];
  }

  return emaArray;
}

/**
 * Calculate Average True Range (ATR) over 14 periods
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

  // Use last 'period' True Ranges for standard ATR
  const slice = trueRanges.slice(-Math.min(period, trueRanges.length));
  const avg = slice.reduce((acc, val) => acc + val, 0) / slice.length;
  return Math.max(0.0001, avg);
}

/**
 * Calculate Relative Volume (RVOL) of current candle vs 20-candle average
 * RVOL < 1.2 => LOW_LIQUIDITY (False breakout risk)
 */
export function calculateRVOL(
  candles: CandleData[],
  lookback = 20,
): { rvol: number; status: "CONFIRMED_LIQUIDITY" | "LOW_LIQUIDITY" } {
  if (candles.length < 2) {
    return { rvol: 1.0, status: "LOW_LIQUIDITY" };
  }

  const currentCandle = candles[candles.length - 1];
  const previousCandles = candles.slice(-Math.min(lookback + 1, candles.length), -1);

  if (previousCandles.length === 0) {
    return { rvol: 1.0, status: "LOW_LIQUIDITY" };
  }

  const sumVol = previousCandles.reduce((acc, c) => acc + (c.volume || 0), 0);
  const avgVol = sumVol / previousCandles.length;

  const rawRvol = avgVol > 0 ? (currentCandle.volume || 0) / avgVol : 1.0;
  const rvol = Math.round(rawRvol * 100) / 100;

  return {
    rvol,
    status: rvol >= 1.2 ? "CONFIRMED_LIQUIDITY" : "LOW_LIQUIDITY",
  };
}

/**
 * Find Highest High and Lowest Low over last 20 candles
 */
export function calculateKeySwings(
  candles: CandleData[],
  lookback = 20,
): { highestHigh20: number; lowestLow20: number } {
  if (candles.length === 0) {
    return { highestHigh20: 0, lowestLow20: 0 };
  }

  const slice = candles.slice(-Math.min(lookback, candles.length));
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
function roundPrice(val: number): number {
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
): QuantMatrix {
  const latest15m = candles15m[candles15m.length - 1];
  const currentLivePrice =
    explicitLivePrice && explicitLivePrice > 0
      ? explicitLivePrice
      : (latest15m ? latest15m.close : 100);

  // 1. Trend Classification on 1H timeframe
  const closes1h = candles1h.map((c) => c.close);
  const ema50Series = calculateEMA(closes1h, 50);
  const ema200Series = calculateEMA(closes1h, 200);

  const ema50 = ema50Series.length > 0 ? ema50Series[ema50Series.length - 1] : currentLivePrice;
  const ema200 = ema200Series.length > 0 ? ema200Series[ema200Series.length - 1] : currentLivePrice;

  const trend = determineTrendClassification(currentLivePrice, ema50, ema200);

  // 2. ATR 14 on 15M candles
  const atr14 = calculateATR(candles15m, 14);

  // 3. RVOL on 15M candles
  const { rvol, status: volumeStatus } = calculateRVOL(candles15m, 20);

  // 4. Key Swings on 15M candles
  const { highestHigh20, lowestLow20 } = calculateKeySwings(candles15m, 20);

  // 5. Mathematical ATR Stop Loss & Take Profit Levels
  // LONG: Math_SL = price - (1.5 * ATR), Math_TP1 = price + (2.0 * ATR), Math_TP2 = price + (3.5 * ATR)
  const longSl = roundPrice(currentLivePrice - 1.5 * atr14);
  const longTp1 = roundPrice(currentLivePrice + 2.0 * atr14);
  const longTp2 = roundPrice(currentLivePrice + 3.5 * atr14);

  // SHORT: Math_SL = price + (1.5 * ATR), Math_TP1 = price - (2.0 * ATR), Math_TP2 = price - (3.5 * ATR)
  const shortSl = roundPrice(currentLivePrice + 1.5 * atr14);
  const shortTp1 = roundPrice(currentLivePrice - 2.0 * atr14);
  const shortTp2 = roundPrice(currentLivePrice - 3.5 * atr14);

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
    longLevels: {
      mathSl: longSl,
      mathTp1: longTp1,
      mathTp2: longTp2,
      riskRewardRatio: "1:2.0",
    },
    shortLevels: {
      mathSl: shortSl,
      mathTp1: shortTp1,
      mathTp2: shortTp2,
      riskRewardRatio: "1:2.0",
    },
  };
}
