// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Gold (XAU/USD) Analysis Panel (Arabic RTL)
// لوحة التحليل المالي المتخصصة لأسعار ومستويات الذهب الفوري
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React, { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Clock,
  Shield,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/store/useDashboardStore";
import { cn, formatPrice, formatPercent, isGoldMarketWeekendClosed, getForexMarketSessions } from "@/lib/utils";
import type { GoldTickerData } from "@/lib/types";

function useGoldPrice(): GoldTickerData {
  const { updateGoldTicker } = useDashboardStore();
  const [data, setData] = useState<GoldTickerData>({
    symbol: "XAUUSD",
    displayName: "XAU/USD",
    price: 4148.50,
    change24h: -0.41,
    high24h: 4190.10,
    low24h: 4137.00,
    volume: "28.4B$",
    lastUpdate: Date.now(),
    priceDirection: "down",
  });

  useEffect(() => {
    let mounted = true;

    async function fetchLiveGold() {
      try {
        const res = await fetch("/api/gold-price");
        if (res.ok && mounted) {
          const fresh = await res.json();
          if (fresh && fresh.price > 0) {
            setData((prev) => {
              const direction =
                fresh.price > prev.price ? "up" : fresh.price < prev.price ? "down" : prev.priceDirection;
              const updated: GoldTickerData = {
                ...fresh,
                priceDirection: direction,
              };
              updateGoldTicker(updated);
              return updated;
            });
          }
        }
      } catch (err) {
        console.warn("[GoldPanel] Live price fetch error:", err);
      }
    }

    fetchLiveGold();
    const interval = setInterval(fetchLiveGold, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [updateGoldTicker]);

  return data;
}

export function GoldPanel() {
  const gold = useGoldPrice();
  const { runAiAnalysis, setSelectedSymbol } = useDashboardStore();
  const isBullish = gold.change24h >= 0;
  const isWeekendClosed = isGoldMarketWeekendClosed();
  const sessions = getForexMarketSessions();

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 sm:p-4 gap-3 sm:gap-4 bg-[#080C14]">
      {/* Weekend Closure Warning Banner */}
      {isWeekendClosed && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-xs text-[#F59E0B] animate-pulse">
          <AlertTriangle className="h-5 w-5 text-[#F59E0B] shrink-0" />
          <div>
            <span className="font-bold block">⚠️ سوق الذهب العالمي مغلق حالياً (عطلة نهاية الأسبوع)</span>
            <span className="text-[11px] text-[#CBD5E1]">
              يغلق سوق الفوركس والذهب من مساء الجمعة 21:00 UTC ويعاود الافتتاح مساء الأحد 22:00 UTC (11:00 مساءً بتوقيت مكة).
            </span>
          </div>
        </div>
      )}

      {/* Main Gold Price Card */}
      <Card className="border-[#F59E0B]/30 bg-gradient-to-br from-[#0F1419] via-[#1A1408] to-[#0F1419] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#F59E0B]/10 rounded-full blur-3xl pointer-events-none" />
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#F59E0B]/20 border border-[#F59E0B]/40">
                <DollarSign className="h-5 w-5 text-[#F59E0B]" />
              </div>
              <div>
                <span className="text-[#F59E0B] font-bold text-sm sm:text-base">أونصة الذهب الفورية — XAU/USD</span>
                <p className="text-[10px] text-[#64748B]">مؤشر تسعير الذهب العالمي مقابل الدولار الأمريكي (TVC:GOLD)</p>
              </div>
            </div>
            <Badge variant="gold" className="text-[10px] font-bold">
              {isWeekendClosed ? "مغلق (عطلة)" : "بث حي"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2 sm:gap-4 mb-3 sm:mb-4 mt-2 flex-wrap">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[#F59E0B]">
              ${formatPrice(gold.price)}
            </span>
            <span
              className={cn(
                "text-xs sm:text-base font-bold font-mono flex items-center gap-1 px-2 py-0.5 rounded",
                isBullish ? "text-[#10B981] bg-[#10B981]/10" : "text-[#F43F5E] bg-[#F43F5E]/10",
              )}
            >
              {isBullish ? (
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              )}
              {formatPercent(gold.change24h)}
            </span>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
            <StatCard label="أعلى 24س" value={`$${formatPrice(gold.high24h)}`} color="text-[#10B981]" />
            <StatCard label="أدنى 24س" value={`$${formatPrice(gold.low24h)}`} color="text-[#F43F5E]" />
            <StatCard label="حجم تقديري" value={gold.volume} color="text-[#F59E0B]" />
          </div>

          <Button
            variant="gold"
            size="sm"
            onClick={() => {
              setSelectedSymbol("XAUUSD");
              runAiAnalysis("XAUUSD", gold.price);
            }}
            className="w-full font-bold text-xs cursor-pointer py-2"
          >
            <span className="hidden sm:inline">⚡ تحليل الذهب الفوري (XAU/USD) بنظام الذكاء الاصطناعي المؤسساتي</span>
            <span className="sm:hidden">⚡ تحليل الذهب الفوري (XAU/USD) بالذكاء AI</span>
          </Button>
        </CardContent>
      </Card>

      {/* Gold Key Levels */}
      <Card className="border-[#1E293B]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xs font-bold text-[#E2E8F0]">
            <Layers className="h-4 w-4 text-[#F59E0B]" />
            المستويات الفنية المحورية للذهب (Key Price Levels)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <LevelRow label="مقاومة رئيسية (R2)" price={Math.round((gold.price + 36.5) * 100) / 100} type="resistance" />
            <LevelRow label="مقاومة أولى (R1)" price={Math.round((gold.price + 18.2) * 100) / 100} type="resistance" />
            <LevelRow label="السعر الفوري الحالي (TVC:GOLD)" price={gold.price} type="current" />
            <LevelRow label="دعم أول (S1)" price={Math.round((gold.price - 18.2) * 100) / 100} type="support" />
            <LevelRow label="دعم رئيسي (S2)" price={Math.round((gold.price - 36.5) * 100) / 100} type="support" />
          </div>
        </CardContent>
      </Card>

      {/* Global Forex Market Sessions */}
      <Card className="border-[#1E293B]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xs font-bold text-[#E2E8F0]">
              <Clock className="h-4 w-4 text-[#06B6D4]" />
              حالة الجلسات المالية العالمية (Forex Market Sessions)
            </CardTitle>
            {isWeekendClosed && (
              <Badge variant="warning" className="text-[9px] px-1.5 py-0 font-bold">
                عطلة نهاية الأسبوع
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-xs">
            {sessions.map((session) => (
              <SessionRow
                key={session.code}
                name={session.name}
                status={session.isActive ? "active" : "closed"}
                statusText={session.statusText}
                time={session.time}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Provider Disclaimer */}
      <div className="rounded-xl border border-[#F59E0B]/20 bg-[#F59E0B]/5 p-3">
        <div className="flex items-start gap-2 text-xs">
          <Shield className="h-4 w-4 text-[#F59E0B] mt-0.5 shrink-0" />
          <p className="text-[#64748B] text-[11px] leading-relaxed">
            الشارت المقابل في القائمة الجانبية متصل ببيانات TradingView الرسمية لأونصة الذهب (<span className="text-[#F59E0B] font-mono font-bold">TVC:GOLD</span>) لضمان تطابق تسعير السبوت بدقة 1:1.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-[#080C14] border border-[#1E293B] p-2.5 text-center">
      <p className="text-[10px] text-[#64748B] mb-1">{label}</p>
      <p className={cn("text-sm font-mono font-bold", color)}>{value}</p>
    </div>
  );
}

function LevelRow({
  label,
  price,
  type,
}: {
  label: string;
  price: number;
  type: "resistance" | "support" | "current";
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#1E293B]/40 last:border-0 text-xs">
      <span
        className={cn(
          "font-semibold",
          type === "current" && "text-[#F59E0B] font-bold",
          type === "resistance" && "text-[#F43F5E]",
          type === "support" && "text-[#10B981]",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-mono font-bold",
          type === "current" && "text-[#F59E0B] bg-[#F59E0B]/10 px-2 py-0.5 rounded",
          type === "resistance" && "text-[#F43F5E]",
          type === "support" && "text-[#10B981]",
        )}
      >
        ${formatPrice(price)}
      </span>
    </div>
  );
}

function SessionRow({
  name,
  status,
  statusText,
  time,
}: {
  name: string;
  status: "active" | "closed";
  statusText: string;
  time: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#1E293B]/30 last:border-0">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            status === "active" ? "bg-[#10B981] animate-pulse" : "bg-[#64748B]",
          )}
        />
        <span className="text-[#E2E8F0] font-medium">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[#64748B] font-mono">{time}</span>
        <Badge
          variant={status === "active" ? "bullish" : statusText.includes("عطلة") ? "warning" : "default"}
          className="text-[9px] px-1.5 py-0"
        >
          {statusText}
        </Badge>
      </div>
    </div>
  );
}
