// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Screener Table Row (Arabic RTL)
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React, { useEffect, useState } from "react";
import { LineChart, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { playTradeChime } from "@/hooks/useAudioAlert";
import { useDashboardStore } from "@/store/useDashboardStore";
import type { TickerData } from "@/lib/types";
import { cn, formatPrice, formatPercent, formatVolume } from "@/lib/utils";

interface ScreenerRowProps {
  ticker: TickerData;
  onAnalyze: (symbol: string) => void;
  isSelected: boolean;
}

export function ScreenerRow({ ticker, onAnalyze, isSelected }: ScreenerRowProps) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const { state } = useDashboardStore();
  const { audioEnabled } = state;

  useEffect(() => {
    if (ticker.priceDirection === "up") {
      setFlash("up");
    } else if (ticker.priceDirection === "down") {
      setFlash("down");
    }
    const timer = setTimeout(() => setFlash(null), 600);
    return () => clearTimeout(timer);
  }, [ticker.markPrice, ticker.priceDirection]);

  const isBullish = ticker.priceChange24h >= 0;
  const isHighRvol = ticker.rvol >= 2;

  const handleRowClick = () => {
    onAnalyze(ticker.symbol);
    if (audioEnabled) {
      playTradeChime("high");
    }
  };

  return (
    <tr
      onClick={handleRowClick}
      className={cn(
        "group border-b border-[#1E293B]/40 transition-all duration-150 cursor-pointer select-none",
        isSelected
          ? "bg-[#8B5CF6]/10 border-r-4 border-r-[#8B5CF6]"
          : "hover:bg-[#151C24]/80",
        flash === "up" && "animate-price-up",
        flash === "down" && "animate-price-down",
      )}
    >
      {/* Symbol */}
      <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-right">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div
            className={cn(
              "flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg text-xs font-bold font-mono shrink-0",
              isBullish ? "bg-[#10B981]/15 text-[#10B981]" : "bg-[#F43F5E]/15 text-[#F43F5E]",
            )}
          >
            {ticker.baseAsset.slice(0, 3)}
          </div>
          <div className="flex flex-col text-right">
            <span className="text-xs sm:text-sm font-bold text-[#E2E8F0] font-mono">{ticker.baseAsset}</span>
            <span className="text-[10px] text-[#64748B] font-mono">{ticker.displayName}</span>
          </div>
        </div>
      </td>

      {/* Mark Price */}
      <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-left">
        <span
          className={cn(
            "text-xs sm:text-sm font-mono font-semibold transition-colors duration-300",
            flash === "up" && "text-[#10B981] font-bold",
            flash === "down" && "text-[#F43F5E] font-bold",
            !flash && "text-[#E2E8F0]",
          )}
        >
          ${formatPrice(ticker.markPrice)}
        </span>
      </td>

      {/* 24h Change % */}
      <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-left">
        <span
          className={cn(
            "text-xs sm:text-sm font-semibold font-mono inline-block px-1.5 py-0.5 rounded",
            isBullish
              ? "text-[#10B981] bg-[#10B981]/10"
              : "text-[#F43F5E] bg-[#F43F5E]/10",
          )}
        >
          {formatPercent(ticker.priceChange24h)}
        </span>
      </td>

      {/* Volume (USDT Millions) */}
      <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-left">
        <span className="text-xs sm:text-sm text-[#E2E8F0] font-mono">
          ${formatVolume(ticker.volume24h)}
        </span>
      </td>

      {/* RVOL Multiplier */}
      <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-left">
        <Badge
          variant={isHighRvol ? "violet" : "default"}
          className={cn(
            "text-[10px] font-mono px-1.5 sm:px-2 py-0.5",
            isHighRvol && "bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/40",
          )}
        >
          {ticker.rvol.toFixed(1)}x
        </Badge>
      </td>

      {/* Action: Analyze Button */}
      <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-center">
        <Button
          variant={isSelected ? "scanner" : "outline"}
          size="sm"
          className="h-7 px-2.5 sm:px-3 text-xs gap-1 font-semibold"
          onClick={(e) => {
            e.stopPropagation();
            handleRowClick();
          }}
        >
          {isSelected ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>مُحدد</span>
            </>
          ) : (
            <>
              <LineChart className="h-3.5 w-3.5" />
              <span>تحليل</span>
            </>
          )}
        </Button>
      </td>
    </tr>
  );
}
