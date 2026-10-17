// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Right Sidebar (Reserved for Chart + AI Engine)
// Placeholder containers for Prompts 2 & 3
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React from "react";
import { BarChart3, Bot, Crosshair, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDashboardStore } from "@/store/useDashboardStore";
import { cn } from "@/lib/utils";

export function RightSidebar() {
  const { state } = useDashboardStore();
  const { selectedSymbol } = state;

  return (
    <div className="flex flex-col h-full bg-[#080C14] overflow-y-auto">
      {/* Selected Symbol Header */}
      {selectedSymbol ? (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1E293B] bg-[#0A0F16]">
          <Crosshair className="h-4 w-4 text-[#8B5CF6]" />
          <span className="text-sm font-bold text-[#E2E8F0]">{selectedSymbol}</span>
          <Badge variant="violet" className="text-[10px]">SELECTED</Badge>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1E293B] bg-[#0A0F16]">
          <ArrowRight className="h-4 w-4 text-[#64748B]" />
          <span className="text-xs text-[#64748B]">Select a coin to analyze</span>
        </div>
      )}

      {/* TradingView Chart Placeholder (Prompt 2) */}
      <div className="p-3">
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4 text-[#06B6D4]" />
              Multi-Timeframe Chart
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border border-dashed border-[#1E293B] bg-[#080C14]",
                "h-[280px] gap-3",
              )}
            >
              <BarChart3 className="h-10 w-10 text-[#1E293B]" />
              <div className="text-center">
                <p className="text-xs font-semibold text-[#64748B]">TradingView Chart</p>
                <p className="text-[10px] text-[#475569] mt-1">Coming in Prompt 2</p>
              </div>
              {selectedSymbol && (
                <Badge variant="default" className="text-[10px] mt-2">
                  Ready for {selectedSymbol}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Recommendation Engine Placeholder (Prompt 3) */}
      <div className="p-3 pt-0">
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bot className="h-4 w-4 text-[#8B5CF6]" />
              AI Recommendation Engine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border border-dashed border-[#1E293B] bg-[#080C14]",
                "h-[200px] gap-3",
              )}
            >
              <div className="relative">
                <Bot className="h-10 w-10 text-[#1E293B]" />
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#8B5CF6]/30 animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-[#64748B]">AI Analysis Engine</p>
                <p className="text-[10px] text-[#475569] mt-1">Coming in Prompt 3</p>
              </div>
              {selectedSymbol && (
                <Badge variant="violet" className="text-[10px] mt-2">
                  Queued: {selectedSymbol}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trade Safety Reminder */}
      <div className="p-3 pt-0 mt-auto">
        <div className="rounded-lg border border-[#1E293B] bg-[#0F1419]/50 p-3">
          <p className="text-[10px] text-[#64748B] leading-relaxed">
            <span className="text-[#F59E0B] font-bold">⚡ Safety First: </span>
            Always validate AI signals with your own analysis.
            Never risk more than 1-2% per trade. Set stop losses.
          </p>
        </div>
      </div>
    </div>
  );
}
