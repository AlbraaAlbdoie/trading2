// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Bullet Strategy Engine (استراتيجية بولت)
// EMA21 High/Low Channel + EMA144 Target + MACD Cross Detection
// ═══════════════════════════════════════════════════════════════════════════

import type { CandleData, BulletSignal } from "./types";

/** Calculate Exponential Moving Average (EMA) */
export function calculateEMA(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  if (data.length < period) {
    // If fewer candles, compute adaptive EMA with available length
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

  // Calculate EMA onwards
  for (let i = period; i < data.length; i++) {
    emaArray[i] = data[i] * k + emaArray[i - 1] * (1 - k);
  }

  // Backfill initial elements for convenience
  for (let i = 0; i < period - 1; i++) {
    emaArray[i] = emaArray[period - 1];
  }

  return emaArray;
}

/** Calculate MACD (Fast = 12, Slow = 26, Signal = 9) */
export function calculateMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): {
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
  macdCross: "BULLISH" | "BEARISH" | "NONE";
} {
  const minLength = Math.max(fastPeriod, slowPeriod) + signalPeriod;
  if (closes.length < 5) {
    return {
      macdLine: [0],
      signalLine: [0],
      histogram: [0],
      macdCross: "NONE",
    };
  }

  const fastEMA = calculateEMA(closes, Math.min(fastPeriod, closes.length));
  const slowEMA = calculateEMA(closes, Math.min(slowPeriod, closes.length));

  const macdLine: number[] = closes.map((_, i) => (fastEMA[i] || 0) - (slowEMA[i] || 0));
  const signalLine = calculateEMA(macdLine, Math.min(signalPeriod, macdLine.length));
  const histogram: number[] = macdLine.map((m, i) => m - (signalLine[i] || 0));

  // Determine recent cross in last 3 candles
  let macdCross: "BULLISH" | "BEARISH" | "NONE" = "NONE";
  const len = macdLine.length;

  if (len >= 2) {
    const curMacd = macdLine[len - 1];
    const curSig = signalLine[len - 1];
    const prevMacd = macdLine[len - 2];
    const prevSig = signalLine[len - 2];

    // Bullish cross: MACD crosses above Signal
    if (prevMacd <= prevSig && curMacd > curSig) {
      macdCross = "BULLISH";
    }
    // Bearish cross: MACD crosses below Signal
    else if (prevMacd >= prevSig && curMacd < curSig) {
      macdCross = "BEARISH";
    }
    // Or strong ongoing momentum in direction if just crossed
    else if (curMacd > curSig && histogram[len - 1] > 0 && histogram[len - 1] > (histogram[len - 2] || 0)) {
      macdCross = "BULLISH";
    }
    else if (curMacd < curSig && histogram[len - 1] < 0 && histogram[len - 1] < (histogram[len - 2] || 0)) {
      macdCross = "BEARISH";
    }
  }

  return { macdLine, signalLine, histogram, macdCross };
}

/** Find recent swing high and low over lookback window */
export function findRecentSwings(candles: CandleData[], lookback = 20): {
  swingHigh: number;
  swingLow: number;
} {
  if (candles.length === 0) return { swingHigh: 0, swingLow: 0 };
  const slice = candles.slice(-Math.min(lookback, candles.length));

  let swingHigh = -Infinity;
  let swingLow = Infinity;

  for (const c of slice) {
    if (c.high > swingHigh) swingHigh = c.high;
    if (c.low < swingLow) swingLow = c.low;
  }

  return { swingHigh, swingLow };
}

/**
 * Execute Bullet Strategy (منطق استراتيجية بولت)
 *
 * Rules:
 * if (macdCross === "BULLISH" && closePrice > ema21_high) {
 *   // صفقة شراء (LONG)
 *   const target = (ema144 > closePrice) ? ema144 : recentSwingHigh;
 *   bulletSignal = { direction: "LONG", status: "VALID", targetPrice: target };
 * }
 * else if (macdCross === "BEARISH" && closePrice < ema21_low) {
 *   // صفقة بيع (SHORT)
 *   const target = (ema144 < closePrice) ? ema144 : recentSwingLow;
 *   bulletSignal = { direction: "SHORT", status: "VALID", targetPrice: target };
 * }
 * else {
 *   bulletSignal = { direction: "NONE", status: "NO_SETUP" };
 * }
 */
export function calculateBulletSignal(candles: CandleData[]): BulletSignal {
  if (candles.length < 5) {
    return { direction: "NONE", status: "NO_SETUP" };
  }

  const latestCandle = candles[candles.length - 1];
  const closePrice = latestCandle.close;

  // 1. Arrays for sources
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const closes = candles.map((c) => c.close);

  // 2. EMA Calculations
  const ema21Highs = calculateEMA(highs, 21);
  const ema21Lows = calculateEMA(lows, 21);
  const ema144Closes = calculateEMA(closes, 144);

  const ema21_high = ema21Highs[ema21Highs.length - 1];
  const ema21_low = ema21Lows[ema21Lows.length - 1];
  const ema144 = ema144Closes[ema144Closes.length - 1];

  // 3. MACD Cross
  const { macdLine, signalLine, macdCross } = calculateMACD(closes);
  const currentMacd = macdLine[macdLine.length - 1];
  const currentSignal = signalLine[signalLine.length - 1];

  // 4. Recent Swings
  const { swingHigh: recentSwingHigh, swingLow: recentSwingLow } = findRecentSwings(candles, 20);

  // 5. Evaluate Bullet Strategy Logic
  if (macdCross === "BULLISH" && closePrice > ema21_high) {
    // صفقة شراء (LONG)
    const target = ema144 > closePrice ? ema144 : recentSwingHigh;
    const stopLoss = Math.min(ema21_low, recentSwingLow);
    const risk = closePrice - stopLoss;
    const reward = target - closePrice;
    const rr = risk > 0 ? (reward / risk).toFixed(1) : "2.0";

    return {
      direction: "LONG",
      status: "VALID",
      targetPrice: Math.round(target * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      entryPrice: Math.round(closePrice * 100) / 100,
      riskRewardRatio: `1:${rr}`,
      metrics: {
        closePrice,
        ema21_high,
        ema21_low,
        ema144,
        recentSwingHigh,
        recentSwingLow,
        macdLine: currentMacd,
        signalLine: currentSignal,
        macdCross,
      },
      reasoning_arabic: `إشارة شراء قوية (Bullet LONG): تقاطع إيجابي لمؤشر MACD مع اختراق السعر أعلى قناة EMA 21 High (${ema21_high.toFixed(2)}). الهدف محدد نحو ${target === ema144 ? "متوسط EMA 144 الديناميكي" : "القمة السابقة (Swing High)"} عند $${target.toFixed(2)}.`,
    };
  } else if (macdCross === "BEARISH" && closePrice < ema21_low) {
    // صفقة بيع (SHORT)
    const target = ema144 < closePrice ? ema144 : recentSwingLow;
    const stopLoss = Math.max(ema21_high, recentSwingHigh);
    const risk = stopLoss - closePrice;
    const reward = closePrice - target;
    const rr = risk > 0 ? (reward / risk).toFixed(1) : "2.0";

    return {
      direction: "SHORT",
      status: "VALID",
      targetPrice: Math.round(target * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      entryPrice: Math.round(closePrice * 100) / 100,
      riskRewardRatio: `1:${rr}`,
      metrics: {
        closePrice,
        ema21_high,
        ema21_low,
        ema144,
        recentSwingHigh,
        recentSwingLow,
        macdLine: currentMacd,
        signalLine: currentSignal,
        macdCross,
      },
      reasoning_arabic: `إشارة بيع قوية (Bullet SHORT): تقاطع سلبي لمؤشر MACD مع كسر السعر أسفل قناة EMA 21 Low (${ema21_low.toFixed(2)}). الهدف محدد نحو ${target === ema144 ? "متوسط EMA 144 الديناميكي" : "القاع السابق (Swing Low)"} عند $${target.toFixed(2)}.`,
    };
  } else {
    return {
      direction: "NONE",
      status: "NO_SETUP",
      metrics: {
        closePrice,
        ema21_high,
        ema21_low,
        ema144,
        recentSwingHigh,
        recentSwingLow,
        macdLine: currentMacd,
        signalLine: currentSignal,
        macdCross,
      },
      reasoning_arabic: "لا توجد إشارة نشطة لاستراتيجية بولت حالياً (السعر داخل نطاق EMA 21 أو لم يتحقق تقاطع MACD المطلوب).",
    };
  }
}
