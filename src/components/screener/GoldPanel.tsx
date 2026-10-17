// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Gold (XAU/USD) Screener Panel
// Dedicated gold analysis view when Gold tab is active
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
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatPrice, formatPercent } from "@/lib/utils";
import type { GoldTickerData } from "@/lib/types";

/** Simulated gold data — in production, connect to a Forex API (OANDA, Twelve Data, etc.) */
function useGoldPrice(): GoldTickerData {
  const [data, setData] = useState<GoldTickerData>({
    symbol: "XAUUSD",
    displayName: "XAU/USD",
    price: 2685.42,
    change24h: 0.67,
    high24h: 2698.10,
    low24h: 2671.35,
    volume: "18.2B",
    lastUpdate: Date.now(),
    priceDirection: "up",
  });

  useEffect(() => {
    // Simulate slight price ticks for demo
    const interval = setInterval(() => {
      setData((prev) => {
        const delta = (Math.random() - 0.48) * 2.5; // slight bullish bias for gold
        const newPrice = Math.max(2500, prev.price + delta);
        return {
          ...prev,
          price: Math.round(newPrice * 100) / 100,
          priceDirection: delta > 0 ? "up" : delta < 0 ? "down" : "neutral",
          lastUpdate: Date.now(),
        };
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return data;
}

export function GoldPanel() {
  const gold = useGoldPrice();
  const isBullish = gold.change24h >= 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      {/* Main Gold Price Card */}
      <Card className="border-[#F59E0B]/20 bg-gradient-to-br from-[#0F1419] to-[#1A1408]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-[#F59E0B]" />
            <span className="text-[#F59E0B]">Gold — XAU/USD</span>
            <Badge variant="gold" className="text-[10px] ml-auto">
              LIVE
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-4 mb-4">
            <span className="text-3xl font-bold font-mono text-[#F59E0B]">
              ${formatPrice(gold.price)}
            </span>
            <span
              className={cn(
                "text-lg font-semibold font-mono flex items-center gap-1",
                isBullish ? "text-[#10B981]" : "text-[#F43F5E]",
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
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="24h High" value={`$${formatPrice(gold.high24h)}`} color="text-[#10B981]" />
            <StatCard label="24h Low" value={`$${formatPrice(gold.low24h)}`} color="text-[#F43F5E]" />
            <StatCard label="Volume" value={gold.volume} color="text-[#F59E0B]" />
          </div>
        </CardContent>
      </Card>

      {/* Gold Analysis Sections (Placeholders) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart3 className="h-4 w-4 text-[#F59E0B]" />
            Key Levels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <LevelRow label="Resistance 2" price={2720.00} type="resistance" />
            <LevelRow label="Resistance 1" price={2700.00} type="resistance" />
            <LevelRow label="Current Price" price={gold.price} type="current" />
            <LevelRow label="Support 1" price={2660.00} type="support" />
            <LevelRow label="Support 2" price={2640.00} type="support" />
          </div>
        </CardContent>
      </Card>

      {/* Market Sessions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-[#06B6D4]" />
            Market Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-xs">
            <SessionRow name="London" status="active" time="08:00 - 16:00 GMT" />
            <SessionRow name="New York" status="active" time="13:00 - 22:00 GMT" />
            <SessionRow name="Tokyo" status="closed" time="00:00 - 09:00 GMT" />
            <SessionRow name="Sydney" status="closed" time="22:00 - 07:00 GMT" />
          </div>
        </CardContent>
      </Card>

      {/* Safety Note */}
      <div className="rounded-lg border border-[#F59E0B]/20 bg-[#F59E0B]/5 p-3">
        <div className="flex items-start gap-2">
          <Shield className="h-4 w-4 text-[#F59E0B] mt-0.5 shrink-0" />
          <p className="text-[10px] text-[#64748B] leading-relaxed">
            Gold prices are simulated for demo purposes. Connect to a live Forex API
            (OANDA, Twelve Data, or Alpha Vantage) for production use.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-[#080C14] border border-[#1E293B] p-2.5 text-center">
      <p className="text-[10px] text-[#64748B] mb-1">{label}</p>
      <p className={cn("text-sm font-mono font-semibold", color)}>{value}</p>
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
    <div className="flex items-center justify-between py-1.5 border-b border-[#1E293B]/50 last:border-0">
      <span
        className={cn(
          "text-xs font-medium",
          type === "current" && "text-[#F59E0B] font-bold",
          type === "resistance" && "text-[#F43F5E]",
          type === "support" && "text-[#10B981]",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-xs font-mono",
          type === "current" && "text-[#F59E0B] font-bold",
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
  time,
}: {
  name: string;
  status: "active" | "closed";
  time: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            status === "active" ? "bg-[#10B981] animate-pulse" : "bg-[#64748B]",
          )}
        />
        <span className="text-[#E2E8F0] font-medium">{name}</span>
      </div>
      <span className="text-[#64748B] font-mono">{time}</span>
    </div>
  );
}
