// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with clsx */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format large numbers as compact strings: 1.2M, 340K, etc. */
export function formatVolume(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

/** Format price with appropriate decimals */
export function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  if (price >= 0.001) return price.toFixed(6);
  return price.toFixed(8);
}

/** Format percentage with sign and color hint */
export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** Extract base asset from symbol (e.g., BTCUSDT → BTC) */
export function extractBaseAsset(symbol: string): string {
  return symbol.replace(/USDT$/, "").replace(/BUSD$/, "").replace(/USD$/, "");
}

/** Format symbol for display (e.g., BTCUSDT → BTC/USDT) */
export function formatSymbolDisplay(symbol: string): string {
  const base = extractBaseAsset(symbol);
  const quote = symbol.replace(base, "");
  return `${base}/${quote}`;
}

/** Compute relative volume multiplier */
export function computeRvol(currentVolume: number, avgVolume: number): number {
  if (avgVolume <= 0) return 1;
  return Math.round((currentVolume / avgVolume) * 10) / 10;
}

/** Debounce function */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

/**
 * Check if Gold / Forex market is closed for the weekend.
 * Fact: Gold market closes from Friday 21:00 UTC to Sunday 22:00 UTC.
 */
export function isGoldMarketWeekendClosed(date = new Date()): boolean {
  const utcDay = date.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  const utcHour = date.getUTCHours();
  const utcMinute = date.getUTCMinutes();

  // Friday after 21:00 UTC (from 21:00 to 23:59)
  if (utcDay === 5 && (utcHour > 21 || (utcHour === 21 && utcMinute >= 0))) {
    return true;
  }
  // Saturday all day (6)
  if (utcDay === 6) {
    return true;
  }
  // Sunday before 22:00 UTC (0)
  if (utcDay === 0 && utcHour < 22) {
    return true;
  }

  return false;
}

export interface MarketSessionInfo {
  name: string;
  code: "london" | "newyork" | "tokyo" | "sydney";
  time: string;
  isActive: boolean;
  statusText: string;
}

/**
 * Calculate dynamic status of Global Forex Market Sessions with Weekend Guard
 */
export function getForexMarketSessions(date = new Date()): MarketSessionInfo[] {
  const isWeekendClosed = isGoldMarketWeekendClosed(date);
  const utcHour = date.getUTCHours();
  const utcMinute = date.getUTCMinutes();
  const currentMinutes = utcHour * 60 + utcMinute;

  // London: 08:00 - 16:00 UTC (480 to 960)
  const londonActive = !isWeekendClosed && currentMinutes >= 8 * 60 && currentMinutes < 16 * 60;
  // New York: 13:00 - 22:00 UTC (780 to 1320)
  const nyActive = !isWeekendClosed && currentMinutes >= 13 * 60 && currentMinutes < 22 * 60;
  // Tokyo: 00:00 - 09:00 UTC (0 to 540)
  const tokyoActive = !isWeekendClosed && currentMinutes >= 0 && currentMinutes < 9 * 60;
  // Sydney: 22:00 - 07:00 UTC (crosses midnight)
  const sydneyActive = !isWeekendClosed && (currentMinutes >= 22 * 60 || currentMinutes < 7 * 60);

  const getLabel = (active: boolean) => {
    if (isWeekendClosed) return "مغلق (عطلة نهاية الأسبوع)";
    return active ? "نشطة الآن" : "مغلقة";
  };

  return [
    {
      name: "جلسة لندن (London Session)",
      code: "london",
      time: "08:00 - 16:00 GMT",
      isActive: londonActive,
      statusText: getLabel(londonActive),
    },
    {
      name: "جلسة نيويورك (New York Session)",
      code: "newyork",
      time: "13:00 - 22:00 GMT",
      isActive: nyActive,
      statusText: getLabel(nyActive),
    },
    {
      name: "جلسة طوكيو (Tokyo Session)",
      code: "tokyo",
      time: "00:00 - 09:00 GMT",
      isActive: tokyoActive,
      statusText: getLabel(tokyoActive),
    },
    {
      name: "جلسة سيدني (Sydney Session)",
      code: "sydney",
      time: "22:00 - 07:00 GMT",
      isActive: sydneyActive,
      statusText: getLabel(sydneyActive),
    },
  ];
}

