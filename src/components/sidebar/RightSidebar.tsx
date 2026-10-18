// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Right Sidebar (TradingView Chart + AI Recommendation Engine)
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React from "react";
import { Crosshair, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TradingViewChart } from "@/components/chart/TradingViewChart";
import { AiRecommendationCard } from "@/components/ai/AiRecommendationCard";
import { useDashboardStore } from "@/store/useDashboardStore";

export function RightSidebar() {
  const { state } = useDashboardStore();
  const { selectedSymbol, activeMarket, tradeMode } = state;

  return (
    <div className="flex flex-col h-full bg-[#080C14] overflow-y-auto border-l border-[#1E293B]">
      {/* Active Symbol Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1E293B] bg-[#0A0F16] shrink-0">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-[#8B5CF6]" />
          <span className="text-xs text-[#64748B]">الأصل النشط:</span>
          <span className="text-sm font-bold text-[#E2E8F0] font-mono">
            {activeMarket === "gold" ? "XAU/USD (Gold)" : selectedSymbol}
          </span>
        </div>
        <Badge variant="violet" className="text-[10px] font-mono">
          {activeMarket === "gold"
            ? "OANDA"
            : tradeMode === "futures"
              ? "BINANCE FUTURES"
              : "BINANCE SPOT"}
        </Badge>
      </div>

      {/* 1. TradingView Multi-Timeframe Chart */}
      <div className="p-3 pb-1 h-[420px] shrink-0">
        <TradingViewChart className="h-full" />
      </div>

      {/* 2. Core AI Trade Recommendation Card (SMC & Multi-Provider) */}
      <div className="p-3 pt-2">
        <AiRecommendationCard />
      </div>

      {/* 3. Risk Management Reminder */}
      <div className="p-3 pt-1 mt-auto">
        <div className="rounded-xl border border-[#1E293B] bg-[#0A0F16] p-2.5 text-xs leading-relaxed">
          <div className="flex items-center gap-1.5 text-[#F59E0B] font-bold mb-0.5">
            <ShieldAlert className="h-3.5 w-3.5 text-[#F59E0B]" />
            قواعد إدارة المخاطر الصارمة:
          </div>
          <p className="text-[#64748B] text-[10px]">
            لا تخاطر بأكثر من 1-2% من محفظتك في أي صفقة منفردة. استخدم دائماً أمر وقف الخسارة (Stop Loss) وتأكد من توافق الاتجاه مع مؤشر صحة البيتكوين.
          </p>
        </div>
      </div>
    </div>
  );
}
