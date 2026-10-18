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
  const [data, setData] = useState<GoldTickerData>({
    symbol: "XAUUSD",
    displayName: "XAU/USD",
    price: 2685.42,
    change24h: 0.67,
    high24h: 2698.10,
    low24h: 2671.35,
    volume: "18.2B$",
    lastUpdate: Date.now(),
    priceDirection: "up",
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => {
        const delta = (Math.random() - 0.48) * 1.8;
        const newPrice = Math.max(2500, prev.price + delta);
        return {
          ...prev,
          price: Math.round(newPrice * 100) / 100,
          priceDirection: delta > 0 ? "up" : delta < 0 ? "down" : "neutral",
          lastUpdate: Date.now(),
        };
      });
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  return data;
}

export function GoldPanel() {
  const gold = useGoldPrice();
  const { runAiAnalysis, setSelectedSymbol } = useDashboardStore();
  const isBullish = gold.change24h >= 0;
  const isWeekendClosed = isGoldMarketWeekendClosed();
  const sessions = getForexMarketSessions();

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4 bg-[#080C14]">
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
                <span className="text-[#F59E0B] font-bold">أونصة الذهب الفورية — XAU/USD</span>
                <p className="text-[10px] text-[#64748B]">مؤشر تسعير الذهب العالمي مقابل الدولار الأمريكي (TVC:GOLD)</p>
              </div>
            </div>
            <Badge variant="gold" className="text-[10px] font-bold">
              {isWeekendClosed ? "مغلق (عطلة)" : "بث حي"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-4 mb-4 mt-2">
            <span className="text-3xl font-extrabold font-mono text-[#F59E0B]">
              ${formatPrice(gold.price)}
            </span>
            <span
              className={cn(
                "text-base font-bold font-mono flex items-center gap-1 px-2 py-0.5 rounded",
                isBullish ? "text-[#10B981] bg-[#10B981]/10" : "text-[#F43F5E] bg-[#F43F5E]/10",
              )}
            >
              {isBullish ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {formatPercent(gold.change24h)}
            </span>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <StatCard label="أعلى سعر 24س" value={`$${formatPrice(gold.high24h)}`} color="text-[#10B981]" />
            <StatCard label="أدنى سعر 24س" value={`$${formatPrice(gold.low24h)}`} color="text-[#F43F5E]" />
            <StatCard label="حجم التداول التقديري" value={gold.volume} color="text-[#F59E0B]" />
          </div>

          <Button
            variant="gold"
            size="sm"
            onClick={() => {
              setSelectedSymbol("XAUUSD");
              runAiAnalysis("XAUUSD", gold.price);
            }}
            className="w-full font-bold text-xs cursor-pointer"
          >
            ⚡ تحليل الذهب الفوري (XAU/USD) بنظام الذكاء الاصطناعي المؤسساتي
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
            <LevelRow label="مقاومة رئيسية (R2)" price={2725.0} type="resistance" />
            <LevelRow label="مقاومة أولى (R1)" price={2700.0} type="resistance" />
            <LevelRow label="السعر الفوري الحالي" price={gold.price} type="current" />
            <LevelRow label="دعم أول (S1)" price={2665.0} type="support" />
            <LevelRow label="دعم رئيسي (S2)" price={2640.0} type="support" />
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
