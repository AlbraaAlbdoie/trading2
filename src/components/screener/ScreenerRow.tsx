// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Screener Table Row
// Individual coin row with price flash animation & analyze action
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React, { useEffect, useState } from "react";
import { BarChart3, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TickerData } from "@/lib/types";
import { cn, formatPrice, formatPercent, formatVolume } from "@/lib/utils";

interface ScreenerRowProps {
  ticker: TickerData;
  onAnalyze: (symbol: string) => void;
  isSelected: boolean;
}

export function ScreenerRow({ ticker, onAnalyze, isSelected }: ScreenerRowProps) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  // Flash animation on price change
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

  return (
    <tr
      className={cn(
        "group border-b border-[#1E293B]/50 transition-all duration-200 hover:bg-[#151C24]",
        isSelected && "bg-[#8B5CF6]/5 border-l-2 border-l-[#8B5CF6]",
        flash === "up" && "bg-[#10B981]/5",
        flash === "down" && "bg-[#F43F5E]/5",
      )}
    >
      {/* Symbol */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex items-center justify-center h-8 w-8 rounded-lg text-xs font-bold",
              isBullish ? "bg-[#10B981]/10 text-[#10B981]" : "bg-[#F43F5E]/10 text-[#F43F5E]",
            )}
          >
            {ticker.baseAsset.slice(0, 3)}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[#E2E8F0]">{ticker.baseAsset}</span>
            <span className="text-[10px] text-[#64748B]">{ticker.displayName}</span>
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="px-4 py-3 text-right">
        <span
          className={cn(
            "text-sm font-mono font-semibold transition-colors duration-300",
            flash === "up" && "text-[#10B981]",
            flash === "down" && "text-[#F43F5E]",
            !flash && "text-[#E2E8F0]",
          )}
        >
          ${formatPrice(ticker.markPrice)}
        </span>
      </td>

      {/* 24h Change */}
      <td className="px-4 py-3 text-right">
        <span
          className={cn(
            "text-sm font-semibold font-mono",
            isBullish ? "text-[#10B981]" : "text-[#F43F5E]",
          )}
        >
          {formatPercent(ticker.priceChange24h)}
        </span>
      </td>

      {/* Volume */}
      <td className="px-4 py-3 text-right">
        <span className="text-sm text-[#E2E8F0] font-mono">
          ${formatVolume(ticker.volume24h)}
        </span>
      </td>

      {/* RVOL */}
      <td className="px-4 py-3 text-right">
        <Badge
          variant={isHighRvol ? "violet" : "default"}
          className={cn("text-[10px] px-2 py-0.5", isHighRvol && "animate-pulse")}
        >
          {ticker.rvol.toFixed(1)}x
        </Badge>
      </td>

      {/* Action */}
      <td className="px-4 py-3 text-center">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs opacity-70 group-hover:opacity-100 transition-opacity"
          onClick={() => onAnalyze(ticker.symbol)}
        >
          <BarChart3 className="h-3 w-3" />
          <span className="hidden sm:inline ml-1">Analyze</span>
          <ChevronRight className="h-3 w-3 sm:hidden" />
        </Button>
      </td>
    </tr>
  );
}
