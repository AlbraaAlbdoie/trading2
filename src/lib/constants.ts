// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Constants & Configuration
// ═══════════════════════════════════════════════════════════════════════════

import type { FilterPreset, ScreenerColumn } from "./types";

// ── Binance API Endpoints ──────────────────────────────────────────────
export const BINANCE_FUTURES_REST = "https://fapi.binance.com/fapi/v1/ticker/24hr";
export const BINANCE_SPOT_REST = "https://api.binance.com/api/v3/ticker/24hr";
export const BINANCE_FUTURES_WS = "wss://fstream.binance.com/ws/!ticker@arr";
export const BINANCE_SPOT_WS = "wss://stream.binance.com:9443/ws/!ticker@arr";

// ── Liquidity Guard Threshold ──────────────────────────────────────────
/** Minimum 24h USDT volume to appear in screener ($30M) */
export const MIN_VOLUME_USDT = 30_000_000;

// ── Polling fallback interval (ms) ────────────────────────────────────
export const POLL_INTERVAL_MS = 4000; // 4 seconds

// ── RVOL baseline window (ticks to average) ───────────────────────────
export const RVOL_BASELINE_TICKS = 20;

// ── BTC Health thresholds ─────────────────────────────────────────────
export const BTC_VOLATILITY_SAFE = 3;      // < 3% range = STABLE
export const BTC_VOLATILITY_CAUTION = 6;   // < 6% = CAUTION
// above 6% => HIGH_RISK

// ── Theme Colors ──────────────────────────────────────────────────────
export const THEME = {
  bg: "#080C14",
  card: "#0F1419",
  cardHover: "#151C24",
  border: "#1E293B",
  bull: "#10B981",
  bear: "#F43F5E",
  gold: "#F59E0B",
  violet: "#8B5CF6",
  blue: "#3B82F6",
  text: "#E2E8F0",
  muted: "#64748B",
  cyan: "#06B6D4",
} as const;

// ── Filter Presets ────────────────────────────────────────────────────
export const FILTER_PRESETS: { key: FilterPreset; label: string; icon: string }[] = [
  { key: "all", label: "All Coins", icon: "🌐" },
  { key: "top_gainers", label: "Top Gainers", icon: "🔥" },
  { key: "high_volume", label: "High Volume", icon: "📊" },
  { key: "short_squeeze", label: "Short Squeeze", icon: "🩳" },
  { key: "spot_accumulation", label: "Accumulation", icon: "💎" },
];

// ── Screener Table Columns ────────────────────────────────────────────
export const SCREENER_COLUMNS: ScreenerColumn[] = [
  { key: "symbol", label: "Symbol", align: "left", sortable: true, width: "180px" },
  { key: "markPrice", label: "Price", align: "right", sortable: true, width: "120px" },
  { key: "priceChange24h", label: "24h %", align: "right", sortable: true, width: "100px" },
  { key: "volume24h", label: "Volume (M$)", align: "right", sortable: true, width: "130px" },
  { key: "rvol", label: "RVOL", align: "right", sortable: true, width: "90px" },
  { key: "action", label: "Action", align: "center", sortable: false, width: "110px" },
];
