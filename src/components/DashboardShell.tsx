// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Dashboard Shell
// Orchestrates TopNav, Health Bar, Split View, and data hooks
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React from "react";
import { TopNavBar } from "@/components/layout/TopNavBar";
import { MarketHealthBar } from "@/components/layout/MarketHealthBar";
import { SplitView } from "@/components/layout/SplitView";
import { ScreenerTable } from "@/components/screener/ScreenerTable";
import { GoldPanel } from "@/components/screener/GoldPanel";
import { RightSidebar } from "@/components/sidebar/RightSidebar";
import { useBinanceTickers } from "@/hooks/useBinanceTickers";
import { useDashboardStore } from "@/store/useDashboardStore";

export function DashboardShell() {
  const { state } = useDashboardStore();
  const { activeMarket } = state;

  // Initialize live Binance data engine
  useBinanceTickers();

  return (
    <div className="flex flex-col h-screen overflow-hidden">
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
    </div>
  );
}
