// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Screener Filters & Search Bar (Arabic RTL)
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React from "react";
import { Search, Sparkles, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/store/useDashboardStore";
import { playTradeChime } from "@/hooks/useAudioAlert";
import { FILTER_PRESETS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { FilterPreset } from "@/lib/types";

export function ScreenerFilters() {
  const {
    state,
    setSearchQuery,
    setActiveFilter,
    runAutoAlphaScan,
  } = useDashboardStore();

  const { searchQuery, activeFilter, tradeMode, audioEnabled, isAutoScanning } = state;

  const visibleFilters = FILTER_PRESETS.filter((f) => {
    if (tradeMode === "spot" && f.key === "short_squeeze") return false;
    return true;
  });

  const handleFilterClick = (key: FilterPreset) => {
    setActiveFilter(key);
    if (audioEnabled) {
      playTradeChime("medium");
    }
  };

  const handleAiScan = () => {
    if (audioEnabled) {
      playTradeChime("high");
    }
    runAutoAlphaScan();
  };

  return (
    <div className="flex flex-col gap-2.5 sm:gap-3 p-3 sm:p-4 border-b border-[#1E293B] bg-[#080C14]">
      {/* Top row: AI Scanner + Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        <Button
          variant="scanner"
          size="sm"
          onClick={handleAiScan}
          disabled={isAutoScanning}
          className="w-full sm:w-auto shrink-0 font-bold tracking-wide h-9 text-xs justify-center"
        >
          {isAutoScanning ? (
            <>
              <Loader2 className="h-4 w-4 ml-1.5 animate-spin" />
              <span>جارٍ مسح أفضل 5 أزواج...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 ml-1.5 animate-pulse" />
              <span className="hidden sm:inline">🚀 مسح السوق الآلي (AUTO AI ALPHA SCANNER)</span>
              <span className="sm:hidden">🚀 مسح آلي لأقوى الفرص (AI SCANNER)</span>
            </>
          )}
        </Button>

        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
          <Input
            placeholder="ابحث عن رمز العملة أو الزوج (مثال: SOL, ETH, BTC)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 pl-3 h-9 text-xs placeholder:text-[#64748B] w-full"
          />
        </div>
      </div>

      {/* Filter Presets */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
        <span className="text-xs text-[#64748B] whitespace-nowrap ml-1 font-semibold">
          فلاتر الفرص:
        </span>
        {visibleFilters.map((filter) => (
          <FilterButton
            key={filter.key}
            label={filter.label}
            icon={filter.icon}
            active={activeFilter === filter.key}
            onClick={() => handleFilterClick(filter.key)}
          />
        ))}
      </div>
    </div>
  );
}

function FilterButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer",
        active
          ? "bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/40 shadow-sm shadow-violet-500/20"
          : "bg-[#0F1419] text-[#94A3B8] border border-[#1E293B] hover:text-[#E2E8F0] hover:border-[#334155]",
      )}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
