// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Split View Layout (Desktop 60/40 & Mobile Native App Tabs)
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React from "react";
import { LayoutGrid, LineChart, Sparkles } from "lucide-react";
import { useDashboardStore } from "@/store/useDashboardStore";
import { RightSidebar } from "@/components/sidebar/RightSidebar";
import { playTradeChime } from "@/hooks/useAudioAlert";
import { cn } from "@/lib/utils";

interface SplitViewProps {
  left: React.ReactNode;
  right?: React.ReactNode;
}

export function SplitView({ left, right }: SplitViewProps) {
  const { state, setMobileActiveTab } = useDashboardStore();
  const { mobileActiveTab, aiRecommendation, isAiAnalyzing, isAutoScanning, audioEnabled } = state;

  const handleTabChange = (tab: "screener" | "chart" | "ai") => {
    setMobileActiveTab(tab);
    if (audioEnabled) {
      playTradeChime("low");
    }
  };

  return (
    <div className="flex flex-1 min-h-0 w-full overflow-hidden relative">
      {/* ── Desktop View (>= 1024px) ─────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 min-h-0 w-full overflow-hidden">
        {/* Left Panel — Screener / Gold (60%) */}
        <div className="flex flex-col w-[60%] min-h-0 overflow-hidden border-r border-[#1E293B]">
          {left}
        </div>

        {/* Right Sidebar — Live Chart & AI Recommendation (40%) */}
        <div className="flex flex-col w-[40%] min-h-0 overflow-hidden">
          {right || <RightSidebar viewMode="all" />}
        </div>
      </div>

      {/* ── Mobile View (< 1024px) ──────────────────────────────────── */}
      <div className="flex lg:hidden flex-col flex-1 min-h-0 w-full overflow-hidden">
        {/* Active Tab Screen */}
        <div className="flex-1 min-h-0 w-full overflow-hidden pb-14">
          {mobileActiveTab === "screener" && (
            <div className="h-full w-full flex flex-col min-h-0 overflow-hidden">
              {left}
            </div>
          )}

          {mobileActiveTab === "chart" && (
            <div className="h-full w-full flex flex-col min-h-0 overflow-hidden">
              <RightSidebar viewMode="chart" />
            </div>
          )}

          {mobileActiveTab === "ai" && (
            <div className="h-full w-full flex flex-col min-h-0 overflow-y-auto">
              <RightSidebar viewMode="ai" />
            </div>
          )}
        </div>

        {/* Sleek Mobile Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 h-14 bg-[#0A0F16]/95 backdrop-blur-xl border-t border-[#1E293B] flex items-center justify-around px-2 shadow-2xl">
          {/* Tab 1: Screener / Market */}
          <MobileNavButton
            active={mobileActiveTab === "screener"}
            onClick={() => handleTabChange("screener")}
            icon={<LayoutGrid className="h-4 w-4" />}
            label="قوائم المراقبة"
          />

          {/* Tab 2: Live Chart */}
          <MobileNavButton
            active={mobileActiveTab === "chart"}
            onClick={() => handleTabChange("chart")}
            icon={<LineChart className="h-4 w-4" />}
            label="الشارت الحي"
          />

          {/* Tab 3: AI Recommendation & Analysis */}
          <MobileNavButton
            active={mobileActiveTab === "ai"}
            onClick={() => handleTabChange("ai")}
            icon={<Sparkles className="h-4 w-4" />}
            label="توصيات الذكاء AI"
            hasBadge={!!aiRecommendation || isAiAnalyzing || isAutoScanning}
            badgePulse={isAiAnalyzing || isAutoScanning}
          />
        </nav>
      </div>
    </div>
  );
}

function MobileNavButton({
  active,
  onClick,
  icon,
  label,
  hasBadge,
  badgePulse,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hasBadge?: boolean;
  badgePulse?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center flex-1 h-full py-1 gap-1 transition-all duration-200 cursor-pointer relative",
        active
          ? "text-[#8B5CF6] font-bold"
          : "text-[#64748B] hover:text-[#E2E8F0] font-medium",
      )}
    >
      <div className="relative">
        <div
          className={cn(
            "p-1 rounded-lg transition-colors",
            active ? "bg-[#8B5CF6]/15" : "bg-transparent",
          )}
        >
          {icon}
        </div>
        {hasBadge && (
          <span
            className={cn(
              "absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#10B981]",
              badgePulse && "animate-ping bg-[#06B6D4]",
            )}
          />
        )}
      </div>
      <span className="text-[11px] leading-none tracking-tight">{label}</span>
      {active && (
        <span className="absolute bottom-0 w-8 h-0.5 bg-[#8B5CF6] rounded-full shadow-sm shadow-violet-500" />
      )}
    </button>
  );
}
