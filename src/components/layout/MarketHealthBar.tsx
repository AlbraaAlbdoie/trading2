// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — BTC & Market Health Bar (sub-header info strip)
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React from "react";
import { TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, ShieldX } from "lucide-react";
import { useDashboardStore } from "@/store/useDashboardStore";
import { cn, formatPrice, formatPercent } from "@/lib/utils";

export function MarketHealthBar() {
  const { state } = useDashboardStore();
  const { btcHealth, noTradeMode, tickers, activeMarket } = state;

  // Quick market stats
  const totalCoins = tickers.length;
  const gainers = tickers.filter((t) => t.priceChange24h > 0).length;
  const losers = tickers.filter((t) => t.priceChange24h < 0).length;

  if (activeMarket === "gold") return null;

  return (
    <div className="w-full border-b border-[#1E293B] bg-[#0A0F16]">
      {/* No-Trade Warning Banner */}
      {noTradeMode && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-[#F43F5E]/10 border-b border-[#F43F5E]/20">
          <ShieldX className="h-4 w-4 text-[#F43F5E] animate-pulse" />
          <span className="text-xs font-bold text-[#F43F5E] uppercase tracking-widest">
            ⚠ STAY IN CASH — NO TRADE SETUP — HIGH VOLATILITY DETECTED
          </span>
          <ShieldX className="h-4 w-4 text-[#F43F5E] animate-pulse" />
        </div>
      )}

      {/* Stats Row */}
      <div className="flex items-center justify-between px-4 py-2 gap-4 overflow-x-auto">
        {/* Left: Market overview */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[#64748B]">Markets:</span>
            <span className="text-[#E2E8F0] font-semibold">{totalCoins}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-[#10B981]" />
            <span className="text-[#10B981] font-semibold">{gainers}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-3 w-3 text-[#F43F5E]" />
            <span className="text-[#F43F5E] font-semibold">{losers}</span>
          </div>
        </div>

        {/* Center: BTC Summary (mobile view) */}
        <div className="flex items-center gap-3 lg:hidden">
          <span className="text-xs text-[#F59E0B] font-mono">
            BTC ${btcHealth.price > 0 ? formatPrice(btcHealth.price) : "---"}
          </span>
          <span
            className={cn(
              "text-xs font-semibold",
              btcHealth.change24h >= 0 ? "text-[#10B981]" : "text-[#F43F5E]",
            )}
          >
            {btcHealth.price > 0 ? formatPercent(btcHealth.change24h) : "---"}
          </span>
        </div>

        {/* Right: Health indicators */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[#64748B]">Volatility:</span>
            <span
              className={cn(
                "font-mono font-semibold",
                btcHealth.volatility < 3
                  ? "text-[#10B981]"
                  : btcHealth.volatility < 6
                    ? "text-[#F59E0B]"
                    : "text-[#F43F5E]",
              )}
            >
              {btcHealth.volatility > 0 ? `${btcHealth.volatility}%` : "---"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {btcHealth.health === "STABLE" ? (
              <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
            ) : btcHealth.health === "HIGH_RISK" ? (
              <AlertTriangle className="h-3.5 w-3.5 text-[#F43F5E] animate-pulse" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-[#F59E0B]" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
