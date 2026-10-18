// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Market Health Bar (Arabic RTL)
// شريط مؤشرات السوق والسيولة وسياسة الحذر (البقاء كاش)
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React from "react";
import { TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, ShieldX } from "lucide-react";
import { useDashboardStore } from "@/store/useDashboardStore";
import { cn, formatPrice, formatPercent } from "@/lib/utils";

export function MarketHealthBar() {
  const { state } = useDashboardStore();
  const { btcHealth, noTradeMode, tickers, activeMarket } = state;

  const totalCoins = tickers.length;
  const gainers = tickers.filter((t) => t.priceChange24h > 0).length;
  const losers = tickers.filter((t) => t.priceChange24h < 0).length;

  if (activeMarket === "gold") return null;

  return (
    <div className="w-full border-b border-[#1E293B] bg-[#0A0F16]">
      {/* No-Trade Warning Banner */}
      {noTradeMode && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-[#F43F5E]/15 border-b border-[#F43F5E]/30 animate-pulse">
          <ShieldX className="h-4 w-4 text-[#F43F5E]" />
          <span className="text-xs font-bold text-[#F43F5E] tracking-wide">
            ⚠ تنبيه وقائي صارم: [البقاء كاش / لا توجد صفقة تداول آمنة] — رصد حركة تذبذب حادة وغير مستقرة
          </span>
          <ShieldX className="h-4 w-4 text-[#F43F5E]" />
        </div>
      )}

      {/* Stats Row */}
      <div className="flex items-center justify-between px-4 py-2 gap-4 overflow-x-auto text-xs">
        {/* Market Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[#64748B]">الأسواق المراقبة (حجم ≥ 30M$):</span>
            <span className="text-[#E2E8F0] font-mono font-bold">{totalCoins}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-[#10B981]" />
            <span className="text-[#64748B]">الصاعدة:</span>
            <span className="text-[#10B981] font-mono font-bold">{gainers}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-[#F43F5E]" />
            <span className="text-[#64748B]">الهابطة:</span>
            <span className="text-[#F43F5E] font-mono font-bold">{losers}</span>
          </div>
        </div>

        {/* BTC Summary (Small screen view) */}
        <div className="flex items-center gap-2 lg:hidden">
          <span className="text-xs text-[#F59E0B] font-mono">
            BTC ${btcHealth.price > 0 ? formatPrice(btcHealth.price) : "---"}
          </span>
          <span
            className={cn(
              "text-xs font-bold font-mono",
              btcHealth.change24h >= 0 ? "text-[#10B981]" : "text-[#F43F5E]",
            )}
          >
            {btcHealth.price > 0 ? formatPercent(btcHealth.change24h) : "---"}
          </span>
        </div>

        {/* Volatility & Health */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[#64748B]">تذبذب البيتكوين 24س:</span>
            <span
              className={cn(
                "font-mono font-bold",
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
          <div className="flex items-center gap-1">
            {btcHealth.health === "STABLE" ? (
              <ShieldCheck className="h-4 w-4 text-[#10B981]" />
            ) : btcHealth.health === "HIGH_RISK" ? (
              <AlertTriangle className="h-4 w-4 text-[#F43F5E] animate-pulse" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
