// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Constants & Configuration (Arabic RTL Financial Terminology)
// ═══════════════════════════════════════════════════════════════════════════

import type { FilterPreset, ScreenerColumn, TimeframeInterval, AiModelOption } from "./types";

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
export const BTC_VOLATILITY_SAFE = 3;      // < 3% range = مستقر
export const BTC_VOLATILITY_CAUTION = 6;   // < 6% = تذبذب متوسط

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

// ── Arabic Filter Presets ─────────────────────────────────────────────
export const FILTER_PRESETS: { key: FilterPreset; label: string; icon: string }[] = [
  { key: "all", label: "جميع الأزواج", icon: "🌐" },
  { key: "top_gainers", label: "الأعلى صعوداً", icon: "🔥" },
  { key: "high_volume", label: "سيولة عملاقة", icon: "📊" },
  { key: "short_squeeze", label: "شورت سكويز", icon: "🩳" },
  { key: "spot_accumulation", label: "تجميع سبوت", icon: "💎" },
];

// ── Arabic Screener Table Columns ─────────────────────────────────────
export const SCREENER_COLUMNS: ScreenerColumn[] = [
  { key: "symbol", label: "الرمز والزوج", align: "right", sortable: true, width: "180px" },
  { key: "markPrice", label: "سعر الماركت", align: "left", sortable: true, width: "120px" },
  { key: "priceChange24h", label: "التغير 24س %", align: "left", sortable: true, width: "110px" },
  { key: "volume24h", label: "حجم التداول (م$)", align: "left", sortable: true, width: "130px" },
  { key: "rvol", label: "مضاعف RVOL", align: "left", sortable: true, width: "100px" },
  { key: "action", label: "إجراء التحليل", align: "center", sortable: false, width: "110px" },
];

// ── Multi-Timeframe Chart Intervals ───────────────────────────────────
export const TIMEFRAMES: { key: TimeframeInterval; label: string; tooltip: string }[] = [
  { key: "5", label: "5د", tooltip: "5 دقائق" },
  { key: "15", label: "15د", tooltip: "15 دقيقة (افتراضي)" },
  { key: "60", label: "1س", tooltip: "ساعة واحدة" },
  { key: "240", label: "4س", tooltip: "4 ساعات" },
  { key: "D", label: "1ي", tooltip: "يومي" },
];

// ── AI Models List ────────────────────────────────────────────────────
export const AI_MODELS: { id: AiModelOption; name: string; provider: string; tag: string }[] = [
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "Google AI", tag: "الأسرع والأحدث" },
  { id: "groq-llama-3.3", name: "Groq Llama 3.3 70B", provider: "Groq Cloud", tag: "فائق السرعة (LPUs)" },
  { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "OpenRouter", tag: "دقة استثنائية" },
  { id: "gpt-4o", name: "GPT-4o Omnichannel", provider: "OpenRouter", tag: "تحليل متعدد الأبعاد" },
];

// ── Default API Keys ──────────────────────────────────────────────────
export const DEFAULT_API_KEYS = {
  geminiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || "AQ.Ab8RN6KULQtXWED1b4WSAaZ0Sby9p1DsuhtZvILmctxtqxGdjQ",
  groqKey: process.env.NEXT_PUBLIC_GROQ_API_KEY || "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",
  openRouterKey: process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || "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",
  goldKey: process.env.NEXT_PUBLIC_GOLD_API_KEY || "91e8dace85b3450ba3ed3257529e155f",
  selectedModel: "gemini-2.0-flash" as AiModelOption,
};
