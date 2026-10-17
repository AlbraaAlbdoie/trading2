// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Top Navigation Bar
// Brand + Market Tabs + Trade Mode Toggle + BTC Health + Controls
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React from "react";
import {
  Activity,
  Bitcoin,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  CircleDollarSign,
  ArrowRightLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/store/useDashboardStore";
import { cn, formatPrice, formatPercent } from "@/lib/utils";
import type { MarketTab, TradeMode } from "@/lib/types";

export function TopNavBar() {
  const {
    state,
    setActiveMarket,
    setTradeMode,
    setAudioEnabled,
  } = useDashboardStore();

  const { activeMarket, tradeMode, btcHealth, audioEnabled, wsStatus } = state;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1E293B] bg-[#080C14]/95 backdrop-blur-xl">
      {/* ── Main Nav Row ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 h-14 gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#8B5CF6]" />
            <span className="text-sm font-bold text-[#E2E8F0] tracking-wide hidden sm:inline">
              NEXUS ALPHA
            </span>
          </div>
          <div className="h-4 w-px bg-[#1E293B] hidden sm:block" />
          <span className="text-xs text-[#64748B] hidden md:inline">
            Multi-Market Smart Money Screener
          </span>
        </div>

        {/* Market Tabs */}
        <div className="flex items-center gap-1 bg-[#0F1419] rounded-lg p-1 border border-[#1E293B]">
          <MarketTabButton
            active={activeMarket === "crypto"}
            onClick={() => setActiveMarket("crypto")}
            icon={<Bitcoin className="h-3.5 w-3.5" />}
            label="Crypto"
          />
          <MarketTabButton
            active={activeMarket === "gold"}
            onClick={() => setActiveMarket("gold")}
            icon={<CircleDollarSign className="h-3.5 w-3.5" />}
            label="Gold"
            goldMode
          />
        </div>

        {/* Trade Mode Toggle (Crypto only) */}
        {activeMarket === "crypto" && (
          <div className="flex items-center gap-1 bg-[#0F1419] rounded-lg p-1 border border-[#1E293B]">
            <TradeModeButton
              active={tradeMode === "futures"}
              onClick={() => setTradeMode("futures")}
              label="FUTURES"
            />
            <TradeModeButton
              active={tradeMode === "spot"}
              onClick={() => setTradeMode("spot")}
              label="SPOT"
            />
          </div>
        )}

        {/* BTC Health */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Bitcoin className="h-4 w-4 text-[#F59E0B]" />
            <span className="text-sm font-mono text-[#E2E8F0]">
              {btcHealth.price > 0 ? `$${formatPrice(btcHealth.price)}` : "---"}
            </span>
            {btcHealth.price > 0 && (
              <span
                className={cn(
                  "text-xs font-semibold",
                  btcHealth.change24h >= 0 ? "text-[#10B981]" : "text-[#F43F5E]",
                )}
              >
                {formatPercent(btcHealth.change24h)}
              </span>
            )}
          </div>
          <HealthBadge health={btcHealth.health} />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Audio Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="relative"
            title={audioEnabled ? "Mute alerts" : "Enable alerts"}
          >
            {audioEnabled ? (
              <Volume2 className="h-4 w-4 text-[#10B981]" />
            ) : (
              <VolumeX className="h-4 w-4 text-[#64748B]" />
            )}
          </Button>

          {/* WebSocket Status */}
          <WsStatusIndicator status={wsStatus} />
        </div>
      </div>
    </header>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function MarketTabButton({
  active,
  onClick,
  icon,
  label,
  goldMode,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  goldMode?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer",
        active
          ? goldMode
            ? "bg-[#F59E0B]/20 text-[#F59E0B] shadow-inner"
            : "bg-[#8B5CF6]/20 text-[#8B5CF6] shadow-inner"
          : "text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1E293B]/50",
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function TradeModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold tracking-wider transition-all duration-200 cursor-pointer",
        active
          ? "bg-[#1E293B] text-[#E2E8F0] shadow-inner"
          : "text-[#64748B] hover:text-[#E2E8F0]",
      )}
    >
      {label === "FUTURES" && <ArrowRightLeft className="h-3 w-3" />}
      {label}
    </button>
  );
}

function HealthBadge({ health }: { health: string }) {
  const configs = {
    STABLE: { label: "STABLE — SAFE TO TRADE", variant: "bullish" as const },
    CAUTION: { label: "CAUTION — MODERATE VOL", variant: "warning" as const },
    HIGH_RISK: { label: "HIGH VOL — DUMP RISK", variant: "danger" as const },
    UNKNOWN: { label: "LOADING...", variant: "default" as const },
  };

  const config = configs[health as keyof typeof configs] || configs.UNKNOWN;

  return (
    <Badge variant={config.variant} className="text-[10px]">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          health === "STABLE" && "bg-[#10B981] animate-pulse",
          health === "CAUTION" && "bg-[#F59E0B] animate-pulse",
          health === "HIGH_RISK" && "bg-[#F43F5E] animate-pulse",
          health === "UNKNOWN" && "bg-[#64748B]",
        )}
      />
      {config.label}
    </Badge>
  );
}

function WsStatusIndicator({ status }: { status: string }) {
  const isConnected = status === "connected";
  return (
    <div
      className="flex items-center gap-1.5"
      title={`WebSocket: ${status}`}
    >
      {isConnected ? (
        <Wifi className="h-4 w-4 text-[#10B981]" />
      ) : (
        <WifiOff className="h-4 w-4 text-[#64748B]" />
      )}
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          isConnected ? "bg-[#10B981] animate-pulse" : "bg-[#64748B]",
        )}
      />
    </div>
  );
}
