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
