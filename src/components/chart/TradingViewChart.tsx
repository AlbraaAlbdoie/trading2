// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Interactive Multi-Timeframe TradingView Chart Widget
// Robust React 19 / Next.js 16 Embed (Eliminates contentWindow iframe error)
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React, { useState, useEffect, memo } from "react";
import { TIMEFRAMES } from "@/lib/constants";
import { useDashboardStore } from "@/store/useDashboardStore";
import { playTradeChime } from "@/hooks/useAudioAlert";
import { cn } from "@/lib/utils";
import type { TimeframeInterval } from "@/lib/types";
import { RefreshCw, ExternalLink } from "lucide-react";

interface TradingViewChartProps {
  className?: string;
}

function mapSymbolToTradingView(symbol: string, activeMarket: string, tradeMode: string): string {
  if (activeMarket === "gold" || symbol === "XAUUSD" || symbol === "XAU/USD" || symbol.includes("XAU")) {
    return "TVC:GOLD";
  }
  const clean = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (clean.endsWith("USDT")) {
    if (tradeMode === "futures") {
      return `BINANCE:${clean}.P`;
    }
    return `BINANCE:${clean}`;
  }
  return `BINANCE:${clean}USDT`;
}

export const TradingViewChart = memo(function TradingViewChart({ className }: TradingViewChartProps) {
  const { state, setChartTimeframe } = useDashboardStore();
  const { selectedSymbol, activeMarket, tradeMode, chartTimeframe, audioEnabled } = state;

  const [isLoading, setIsLoading] = useState(true);
  const tvSymbol = mapSymbolToTradingView(selectedSymbol, activeMarket, tradeMode);

  // Suppress harmless cross-origin contentWindow listener noise from external iframes
  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      if (
        event.message?.includes("contentWindow") ||
        event.message?.includes("iframe") ||
        event.filename?.includes("tradingview")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
    };

    window.addEventListener("error", handleWindowError, true);
    return () => window.removeEventListener("error", handleWindowError, true);
  }, []);

  const handleTimeframeChange = (tf: TimeframeInterval) => {
    if (audioEnabled) {
      playTradeChime("high");
    }
    setIsLoading(true);
    setChartTimeframe(tf);
  };

  // Build clean, standalone TradingView iframe embed URL with MACD pane
  const iframeSrc = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(
    tvSymbol,
  )}&interval=${chartTimeframe}&symboledit=0&saveimage=0&toolbarbg=080C14&theme=dark&style=1&timezone=Etc%2FUTC&studies=%5B%22MACD%40tv-basicstudies%22%5D&locale=ar_AE&overrides=%7B%22paneProperties.background%22%3A%22%23080C14%22%2C%22paneProperties.vertGridProperties.color%22%3A%22rgba(30%2C41%2C59%2C0.4)%22%2C%22paneProperties.horzGridProperties.color%22%3A%22rgba(30%2C41%2C59%2C0.4)%22%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&utm_source=nexus-alpha`;

  return (
    <div
      className={cn(
        "flex flex-col h-full w-full rounded-xl border border-[#1E293B] bg-[#080C14] overflow-hidden",
        className,
      )}
    >
      {/* Chart Top Header & Timeframe Switcher */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1E293B] bg-[#0F1419]/90 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#10B981] animate-ping" />
            <span className="text-xs font-bold text-[#E2E8F0] tracking-wide font-mono">
              {tvSymbol}
            </span>
          </div>
          <span className="text-[10px] text-[#64748B] hidden sm:inline">
            {activeMarket === "gold"
              ? "أونصة الذهب الفورية"
              : tradeMode === "futures"
                ? "عقود آجلة (Futures)"
                : "سوق فوري (Spot)"}
          </span>
        </div>

        {/* Timeframe Buttons */}
        <div className="flex items-center gap-1 bg-[#080C14] p-1 rounded-lg border border-[#1E293B]">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.key}
              onClick={() => handleTimeframeChange(tf.key)}
              title={tf.tooltip}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded transition-all duration-150 cursor-pointer",
                chartTimeframe === tf.key
                  ? "bg-[#8B5CF6] text-white shadow-sm shadow-violet-500/30"
                  : "text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1E293B]",
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* TradingView Native iframe Container */}
      <div className="flex-1 w-full min-h-[360px] relative bg-[#080C14]">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#080C14] text-[#64748B] text-xs">
            <RefreshCw className="h-4 w-4 animate-spin ml-2 text-[#8B5CF6]" />
            جارٍ تحميل منصة الرسم البياني...
          </div>
        )}

        <iframe
          key={`${tvSymbol}-${chartTimeframe}`}
          src={iframeSrc}
          title={`TradingView Chart ${tvSymbol}`}
          className="w-full h-full border-0"
          style={{ minHeight: "360px", backgroundColor: "#080C14" }}
          loading="lazy"
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
});
