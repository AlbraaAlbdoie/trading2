// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Screener Table (Arabic RTL)
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React, { useMemo, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Loader2, Sparkles } from "lucide-react";
import { ScreenerRow } from "./ScreenerRow";
import { ScreenerFilters } from "./ScreenerFilters";
import { useDashboardStore } from "@/store/useDashboardStore";
import { SCREENER_COLUMNS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TickerData, FilterPreset } from "@/lib/types";

type SortKey = "symbol" | "markPrice" | "priceChange24h" | "volume24h" | "rvol";
type SortDir = "asc" | "desc";

function applyFilter(tickers: TickerData[], filter: FilterPreset): TickerData[] {
  switch (filter) {
    case "top_gainers":
      return [...tickers].sort((a, b) => b.priceChange24h - a.priceChange24h).slice(0, 35);
    case "high_volume":
      return [...tickers].sort((a, b) => b.volume24h - a.volume24h).slice(0, 35);
    case "short_squeeze":
      return tickers.filter((t) => t.priceChange24h < -2 && t.rvol >= 1.5);
    case "spot_accumulation":
      return tickers.filter(
        (t) => Math.abs(t.priceChange24h) < 3 && t.rvol >= 1.3,
      );
    default:
      return tickers;
  }
}

export function ScreenerTable() {
  const { state, setSelectedSymbol, runAiAnalysis } = useDashboardStore();
  const { tickers, searchQuery, activeFilter, selectedSymbol } = state;
  const [sortKey, setSortKey] = useState<SortKey>("volume24h");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleAnalyzeCoin = (symbol: string) => {
    setSelectedSymbol(symbol);
    runAiAnalysis(symbol);
  };

  const filteredTickers = useMemo(() => {
    let result = applyFilter(tickers, activeFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.toUpperCase();
      result = result.filter(
        (t) =>
          t.symbol.includes(q) ||
          t.baseAsset.includes(q) ||
          t.displayName.toUpperCase().includes(q),
      );
    }

    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return result;
  }, [tickers, searchQuery, activeFilter, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (!SCREENER_COLUMNS.find((c) => c.key === key)?.sortable) return;
    const k = key as SortKey;
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const isEmpty = tickers.length === 0;
  const noResults = !isEmpty && filteredTickers.length === 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[#080C14]">
      {/* Filters */}
      <ScreenerFilters />

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#1E293B]">
        {isEmpty ? (
          <LoadingState />
        ) : noResults ? (
          <EmptyState />
        ) : (
          <table className="w-full min-w-[560px] border-collapse">
            {/* Header */}
            <thead className="sticky top-0 z-10 bg-[#0A0F16]">
              <tr>
                {SCREENER_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-3 sm:px-4 py-2.5 text-[11px] font-bold text-[#64748B] border-b border-[#1E293B]",
                      col.align === "right" && "text-right",
                      col.align === "left" && "text-left",
                      col.align === "center" && "text-center",
                      col.sortable && "cursor-pointer hover:text-[#E2E8F0] transition-colors select-none",
                    )}
                    style={{ width: col.width }}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.sortable && sortKey === col.key && (
                        sortDir === "asc" ? (
                          <ArrowUp className="h-3 w-3 text-[#8B5CF6]" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-[#8B5CF6]" />
                        )
                      )}
                      {col.sortable && sortKey !== col.key && (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {filteredTickers.map((ticker) => (
                <ScreenerRow
                  key={ticker.symbol}
                  ticker={ticker}
                  onAnalyze={handleAnalyzeCoin}
                  isSelected={selectedSymbol === ticker.symbol}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer Stats */}
      {!isEmpty && (
        <div className="flex flex-col sm:flex-row items-center justify-between px-3 sm:px-4 py-2 border-t border-[#1E293B] bg-[#0A0F16] text-[11px] sm:text-xs text-[#64748B] gap-1 sm:gap-0 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#8B5CF6]" />
            <span>
              عرض {filteredTickers.length} من أصل {tickers.length} زوج مؤهل
            </span>
          </div>
          <span className="font-mono text-[10px] sm:text-[11px] bg-[#1E293B]/40 px-2 py-0.5 rounded border border-[#1E293B]">
            فلتر السيولة الصارم: حجم 24س ≥ 30,000,000 USDT
          </span>
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-72 gap-4">
      <Loader2 className="h-8 w-8 text-[#8B5CF6] animate-spin" />
      <div className="text-center">
        <p className="text-sm font-bold text-[#E2E8F0]">
          الاتصال بمحرك بث بينانس المباشر...
        </p>
        <p className="text-xs text-[#64748B] mt-1">
          جارٍ جلب وتصفية أسعار العملات ومعدلات السيولة الفورية
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
      <div className="text-4xl">🔍</div>
      <p className="text-sm font-semibold text-[#E2E8F0]">لم يتم العثور على أزواج مطابقة للبحث</p>
      <p className="text-xs text-[#64748B]">جرب تغيير شروط الفلتر أو كتابة رمز عملة آخر</p>
    </div>
  );
}
