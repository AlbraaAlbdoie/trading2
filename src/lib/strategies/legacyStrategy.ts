// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Legacy Strategy Snapshot (For Historical Backtesting Comparison)
// Preserves the EXACT unedited logic of the original quant & clearance implementation.
// ═══════════════════════════════════════════════════════════════════════════

import type { CandleData, QuantMatrix, AiTradeRecommendation, TradeMode } from "../types.ts";
import { calculateRiskReward } from "../tradePolicy.ts";

export function legacyCalculateEMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];

  const initialSlice = values.slice(0, period);
  const sma = initialSlice.reduce((sum, v) => sum + v, 0) / period;
  result.push(sma);

  for (let i = period; i < values.length; i++) {
    const current = values[i];
    const prev = result[result.length - 1];
    result.push(current * k + prev * (1 - k));
  }
  return result;
}

export function legacyCalculateATR(candles: CandleData[], period = 14): number {
  if (candles.length < 2) return 0;
  const trValues: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trValues.push(tr);
  }
  if (trValues.length < period) {
    return trValues.reduce((a, b) => a + b, 0) / (trValues.length || 1);
  }
  const initial = trValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let atr = initial;
  for (let i = period; i < trValues.length; i++) {
    atr = (atr * (period - 1) + trValues[i]) / period;
  }
  return atr;
}

export function legacyCalculateRVOL(candles: CandleData[], lookback = 20): { rvol: number } {
  if (candles.length < 2) return { rvol: 1.0 };
  const currentCandle = candles[candles.length - 1];
  const previousCandles = candles.slice(-lookback - 1, -1);
  if (previousCandles.length === 0) return { rvol: 1.0 };

  const sumVol = previousCandles.reduce((acc, c) => acc + (c.volume || 0), 0);
  const avgVol = sumVol / previousCandles.length;
  const rawRvol = avgVol > 0 ? (currentCandle.volume || 0) / avgVol : 1.0;
  return { rvol: Math.round(rawRvol * 100) / 100 };
}

export function legacyCalculateKeySwings(candles: CandleData[], lookback = 20): { highestHigh20: number; lowestLow20: number } {
  if (candles.length === 0) return { highestHigh20: 0, lowestLow20: 0 };
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

export function legacyEvaluateSignal(
  candles1h: CandleData[],
  candles15m: CandleData[],
  currentLivePrice: number,
  tradeMode: TradeMode = "futures",
): {
  action: "LONG" | "SHORT" | "NO_CLEAR_SETUP";
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  rr: string | null;
  rvol: number;
} {
  const closes1h = candles1h.map((c) => c.close);
  const ema50Series = legacyCalculateEMA(closes1h, 50);
  const ema200Series = legacyCalculateEMA(closes1h, 200);

  const ema50 = ema50Series.length > 0 ? ema50Series[ema50Series.length - 1] : currentLivePrice;
  const ema200 = ema200Series.length > 0 ? ema200Series[ema200Series.length - 1] : currentLivePrice;

  let trend: "STRONG_BULLISH" | "STRONG_BEARISH" | "CHOPPY_SIDEWAYS" = "CHOPPY_SIDEWAYS";
  if (currentLivePrice > ema50 && ema50 > ema200) {
    trend = "STRONG_BULLISH";
  } else if (currentLivePrice < ema50 && ema50 < ema200) {
    trend = "STRONG_BEARISH";
  }

  const atr14 = legacyCalculateATR(candles15m, 14);
  const { rvol } = legacyCalculateRVOL(candles15m, 20);
  const { highestHigh20, lowestLow20 } = legacyCalculateKeySwings(candles15m, 20);

  if (trend === "CHOPPY_SIDEWAYS" || rvol < 1.3) {
    return { action: "NO_CLEAR_SETUP", entry: currentLivePrice, sl: currentLivePrice, tp1: currentLivePrice, tp2: currentLivePrice, rr: "0:0", rvol };
  }

  const distToHighPct = highestHigh20 > 0 ? (highestHigh20 - currentLivePrice) / currentLivePrice : 1;
  const distToLowPct = lowestLow20 > 0 ? (currentLivePrice - lowestLow20) / currentLivePrice : 1;

  if (trend === "STRONG_BULLISH" && distToHighPct > 0.004) {
    const sl = currentLivePrice - 1.5 * atr14;
    const tp1 = currentLivePrice + 2.0 * atr14;
    const tp2 = currentLivePrice + 3.5 * atr14;
    const rr = calculateRiskReward("LONG", currentLivePrice, sl, tp2);
    return { action: "LONG", entry: currentLivePrice, sl, tp1, tp2, rr, rvol };
  }

  if (trend === "STRONG_BEARISH" && distToLowPct > 0.004 && tradeMode === "futures") {
    const sl = currentLivePrice + 1.5 * atr14;
    const tp1 = currentLivePrice - 2.0 * atr14;
    const tp2 = currentLivePrice - 3.5 * atr14;
    const rr = calculateRiskReward("SHORT", currentLivePrice, sl, tp2);
    return { action: "SHORT", entry: currentLivePrice, sl, tp1, tp2, rr, rvol };
  }

  return { action: "NO_CLEAR_SETUP", entry: currentLivePrice, sl: currentLivePrice, tp1: currentLivePrice, tp2: currentLivePrice, rr: "0:0", rvol };
}
