// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Binance Tickers Data Hook
// Live REST polling + WebSocket with liquidity guard & RVOL computation
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import { useEffect, useRef, useCallback } from "react";
import { useDashboardStore } from "@/store/useDashboardStore";
import { useWebSocket } from "./useWebSocket";
import type { BinanceTickerRaw, TickerData, BtcHealthState } from "@/lib/types";
import {
  BINANCE_FUTURES_REST,
  BINANCE_SPOT_REST,
  BINANCE_FUTURES_WS,
  BINANCE_SPOT_WS,
  MIN_VOLUME_USDT,
  POLL_INTERVAL_MS,
  BTC_VOLATILITY_SAFE,
  BTC_VOLATILITY_CAUTION,
} from "@/lib/constants";
import { extractBaseAsset, formatSymbolDisplay, computeRvol } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────

/** Filter and transform raw Binance tickers */
function processRawTickers(
  raw: BinanceTickerRaw[],
  prevMap: Map<string, TickerData>,
  volumeHistory: Map<string, number[]>,
): TickerData[] {
  return raw
    .filter((t) => {
      // USDT pairs only
      if (!t.symbol.endsWith("USDT")) return false;
      // Liquidity guard
      const vol = parseFloat(t.quoteVolume);
      if (vol < MIN_VOLUME_USDT) return false;
      // Skip leveraged tokens
      if (/UP|DOWN|BULL|BEAR/.test(t.symbol)) return false;
      return true;
    })
    .map((t): TickerData => {
      const price = parseFloat(t.lastPrice);
      const prevPrice = prevMap.get(t.symbol)?.markPrice ?? price;
      const vol = parseFloat(t.quoteVolume);
      
      // Track volume history for RVOL
      const hist = volumeHistory.get(t.symbol) || [];
      hist.push(vol);
      if (hist.length > 20) hist.shift();
      volumeHistory.set(t.symbol, hist);
      
      const avgVol = hist.length > 1 
        ? hist.slice(0, -1).reduce((a, b) => a + b, 0) / (hist.length - 1)
        : vol;

      return {
        symbol: t.symbol,
        displayName: formatSymbolDisplay(t.symbol),
        baseAsset: extractBaseAsset(t.symbol),
        markPrice: price,
        priceChange24h: parseFloat(t.priceChangePercent),
        volume24h: vol,
        rvol: computeRvol(vol, avgVol),
        highPrice: parseFloat(t.highPrice),
        lowPrice: parseFloat(t.lowPrice),
        priceDirection: price > prevPrice ? "up" : price < prevPrice ? "down" : "neutral",
        lastUpdate: Date.now(),
      };
    })
    .sort((a, b) => b.volume24h - a.volume24h);
}

/** Compute BTC health from its ticker */
function computeBtcHealth(tickers: TickerData[]): BtcHealthState {
  const btc = tickers.find((t) => t.symbol === "BTCUSDT");
  if (!btc) {
    return { price: 0, change24h: 0, volatility: 0, health: "UNKNOWN", lastUpdate: Date.now() };
  }

  const range = btc.highPrice - btc.lowPrice;
  const mid = (btc.highPrice + btc.lowPrice) / 2;
  const volatility = mid > 0 ? (range / mid) * 100 : 0;

  let health: BtcHealthState["health"] = "STABLE";
  if (volatility > BTC_VOLATILITY_CAUTION) health = "HIGH_RISK";
  else if (volatility > BTC_VOLATILITY_SAFE) health = "CAUTION";

  return {
    price: btc.markPrice,
    change24h: btc.priceChange24h,
    volatility: Math.round(volatility * 100) / 100,
    health,
    lastUpdate: Date.now(),
  };
}

// ── Main Hook ─────────────────────────────────────────────────────────
export function useBinanceTickers() {
  const { state, updateTickers, updateBtcHealth, setWsStatus } = useDashboardStore();
  const { tradeMode } = state;

  const tickerMapRef = useRef<Map<string, TickerData>>(new Map());
  const volumeHistoryRef = useRef<Map<string, number[]>>(new Map());
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const restUrl = tradeMode === "futures" ? BINANCE_FUTURES_REST : BINANCE_SPOT_REST;
  const wsUrl = tradeMode === "futures" ? BINANCE_FUTURES_WS : BINANCE_SPOT_WS;

  // ── Process incoming data (both WS & REST) ─────────────────────
  const processTickers = useCallback(
    (raw: BinanceTickerRaw[]) => {
      const processed = processRawTickers(raw, tickerMapRef.current, volumeHistoryRef.current);
      
      // Update map for next comparison
      tickerMapRef.current = new Map(processed.map((t) => [t.symbol, t]));

      updateTickers(processed);
      updateBtcHealth(computeBtcHealth(processed));
    },
    [updateTickers, updateBtcHealth],
  );

  // ── REST polling (fallback) ────────────────────────────────────
  const fetchRest = useCallback(async () => {
    try {
      const res = await fetch(restUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: BinanceTickerRaw[] = await res.json();
      processTickers(data);
    } catch (err) {
      console.warn("[NEXUS] REST poll failed:", err);
    }
  }, [restUrl, processTickers]);

  // Initial REST fetch + polling fallback
  useEffect(() => {
    fetchRest(); // immediate first fetch

    pollTimerRef.current = setInterval(fetchRest, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchRest]);

  // ── WebSocket connection ───────────────────────────────────────
  const handleWsMessage = useCallback(
    (data: unknown) => {
      if (Array.isArray(data)) {
        processTickers(data as BinanceTickerRaw[]);
      }
    },
    [processTickers],
  );

  useWebSocket({
    url: wsUrl,
    onMessage: handleWsMessage,
    onStatusChange: setWsStatus,
    reconnectDelay: 3000,
    maxRetries: 10,
    enabled: state.activeMarket === "crypto",
  });

  return {
    tickers: state.tickers,
    btcHealth: state.btcHealth,
    wsStatus: state.wsStatus,
  };
}
