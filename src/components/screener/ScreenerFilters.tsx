// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Screener Filters & Search Bar
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React from "react";
import { Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/store/useDashboardStore";
import { FILTER_PRESETS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { FilterPreset } from "@/lib/types";

export function ScreenerFilters() {
  const { state, setSearchQuery, setActiveFilter } = useDashboardStore();
  const { searchQuery, activeFilter, tradeMode } = state;

  // Hide futures-only filters in spot mode
  const visibleFilters = FILTER_PRESETS.filter((f) => {
    if (tradeMode === "spot" && f.key === "short_squeeze") return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-3 p-4 border-b border-[#1E293B]">
      {/* Top row: AI Scanner + Search */}
      <div className="flex items-center gap-3">
        <Button variant="scanner" size="sm" className="shrink-0">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">AUTO AI ALPHA SCANNER</span>
          <span className="sm:hidden">AI SCAN</span>
        </Button>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
          <Input
            placeholder="Search symbol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
      </div>

      {/* Filter Presets */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
        {visibleFilters.map((filter) => (
          <FilterButton
            key={filter.key}
            filterKey={filter.key}
            label={filter.label}
            icon={filter.icon}
            active={activeFilter === filter.key}
            onClick={() => setActiveFilter(filter.key)}
          />
        ))}
      </div>
    </div>
  );
}

function FilterButton({
  filterKey,
  label,
  icon,
  active,
  onClick,
}: {
  filterKey: FilterPreset;
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-200 cursor-pointer",
        active
          ? "bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30"
          : "bg-[#0F1419] text-[#64748B] border border-[#1E293B] hover:text-[#E2E8F0] hover:border-[#334155]",
      )}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
