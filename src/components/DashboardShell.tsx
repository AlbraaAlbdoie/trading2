// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Dashboard Shell (Arabic RTL & Supabase Auth Protected)
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React from "react";
import { TopNavBar } from "@/components/layout/TopNavBar";
import { MarketHealthBar } from "@/components/layout/MarketHealthBar";
import { SplitView } from "@/components/layout/SplitView";
import { ScreenerTable } from "@/components/screener/ScreenerTable";
import { GoldPanel } from "@/components/screener/GoldPanel";
import { RightSidebar } from "@/components/sidebar/RightSidebar";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { TradeJournalModal } from "@/components/journal/TradeJournalModal";
import { SavedSignalsModal } from "@/components/signals/SavedSignalsModal";
import { AuthModal } from "@/components/auth/AuthModal";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useBinanceTickers } from "@/hooks/useBinanceTickers";
import { useDashboardStore } from "@/store/useDashboardStore";
import { Activity, Loader2 } from "lucide-react";

export function DashboardShell() {
  const { state } = useDashboardStore();
  const { activeMarket, authUser, isAuthLoading } = state;

  // Initialize live Binance data stream
  useBinanceTickers();

  // 1. Initial Auth Loading State
  if (isAuthLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#080C14] text-[#E2E8F0]" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 shadow-xl shadow-violet-500/20 animate-pulse">
            <Activity className="h-8 w-8 text-[#8B5CF6]" />
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
            <Loader2 className="h-4 w-4 animate-spin text-[#8B5CF6]" />
            <span>التحقق من جلسة المستخدم عبر Supabase...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Protected View (Auth Guard)
  if (!authUser) {
    return (
      <>
        <AuthScreen />
        <ToastContainer />
      </>
    );
  }

  // 3. Full Authenticated Live Dashboard
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#080C14] text-[#E2E8F0] select-none" dir="rtl">
      {/* Top Navigation */}
      <TopNavBar />

      {/* Market Health Sub-bar */}
      <MarketHealthBar />

      {/* Main Content: Split View */}
      <SplitView
        left={
          activeMarket === "crypto" ? (
            <ScreenerTable />
          ) : (
            <GoldPanel />
          )
        }
        right={<RightSidebar />}
      />

      {/* Modals & Drawers */}
      <SettingsModal />
      <TradeJournalModal />
      <SavedSignalsModal />
      <AuthModal />

      {/* Toast Notifications System */}
      <ToastContainer />
    </div>
  );
}
