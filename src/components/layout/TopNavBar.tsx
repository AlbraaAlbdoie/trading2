// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Top Navigation Bar (Arabic RTL)
// العلامة التجارية + ألسنة الأسواق + نمط التداول + صحة السوق + أدوات التحكم + Supabase Auth
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
  Settings,
  BookOpen,
  FolderBookmark,
  User,
  LogOut,
  LogIn,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/store/useDashboardStore";
import { playTradeChime } from "@/hooks/useAudioAlert";
import { cn, formatPrice, formatPercent } from "@/lib/utils";

export function TopNavBar() {
  const {
    state,
    setActiveMarket,
    setTradeMode,
    setAudioEnabled,
    setIsSettingsOpen,
    setIsJournalOpen,
    setIsSavedSignalsOpen,
    setIsAuthModalOpen,
    signOutUser,
  } = useDashboardStore();

  const {
    activeMarket,
    tradeMode,
    btcHealth,
    audioEnabled,
    wsStatus,
    journalEntries,
    savedSignals,
    authUser,
  } = state;

  const handleAudioToggle = () => {
    const nextState = !audioEnabled;
    setAudioEnabled(nextState);
    if (nextState) {
      playTradeChime("high");
    }
  };

  const handleMarketChange = (market: "crypto" | "gold") => {
    setActiveMarket(market);
    if (audioEnabled) {
      playTradeChime("medium");
    }
  };

  const handleModeChange = (mode: "futures" | "spot") => {
    setTradeMode(mode);
    if (audioEnabled) {
      playTradeChime("low");
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#1E293B] bg-[#080C14]/95 backdrop-blur-xl">
      <div className="flex items-center justify-between px-3 lg:px-4 h-14 gap-2 lg:gap-3 overflow-x-auto">
        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/30">
              <Activity className="h-4 w-4 text-[#8B5CF6]" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold text-[#E2E8F0] tracking-wide">
                NEXUS ALPHA
              </span>
              <span className="text-[10px] text-[#8B5CF6] font-semibold hidden md:inline">
                ماسح السيولة الذكي
              </span>
            </div>
          </div>
          <div className="h-4 w-px bg-[#1E293B] hidden sm:block" />
        </div>

        {/* Primary Asset Tabs */}
        <div className="flex items-center gap-1 bg-[#0F1419] rounded-lg p-1 border border-[#1E293B] shrink-0">
          <MarketTabButton
            active={activeMarket === "crypto"}
            onClick={() => handleMarketChange("crypto")}
            icon={<Bitcoin className="h-3.5 w-3.5" />}
            label="سوق الكريبتو"
          />
          <MarketTabButton
            active={activeMarket === "gold"}
            onClick={() => handleMarketChange("gold")}
            icon={<CircleDollarSign className="h-3.5 w-3.5" />}
            label="الذهب (XAU/USD)"
            goldMode
          />
        </div>

        {/* Trade Mode Switch (Crypto only) */}
        {activeMarket === "crypto" && (
          <div className="flex items-center gap-1 bg-[#0F1419] rounded-lg p-1 border border-[#1E293B] shrink-0">
            <TradeModeButton
              active={tradeMode === "futures"}
              onClick={() => handleModeChange("futures")}
              label="عقود آجلة (FUTURES)"
            />
            <TradeModeButton
              active={tradeMode === "spot"}
              onClick={() => handleModeChange("spot")}
              label="سوق فوري (SPOT)"
            />
          </div>
        )}

        {/* BTC Health Guard */}
        <div className="hidden xl:flex items-center gap-3 bg-[#0F1419]/60 px-3 py-1 rounded-xl border border-[#1E293B]/70 shrink-0">
          <div className="flex items-center gap-2">
            <Bitcoin className="h-4 w-4 text-[#F59E0B]" />
            <span className="text-xs text-[#64748B]">البيتكوين:</span>
            <span className="text-sm font-mono text-[#E2E8F0]">
              {btcHealth.price > 0 ? `$${formatPrice(btcHealth.price)}` : "---"}
            </span>
            {btcHealth.price > 0 && (
              <span
                className={cn(
                  "text-xs font-semibold font-mono",
                  btcHealth.change24h >= 0 ? "text-[#10B981]" : "text-[#F43F5E]",
                )}
              >
                {formatPercent(btcHealth.change24h)}
              </span>
            )}
          </div>
          <HealthBadge health={btcHealth.health} />
        </div>

        {/* Controls Bar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 📂 Saved Signals Drawer Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSavedSignalsOpen(true)}
            className="h-8 px-2.5 text-xs text-[#E2E8F0] border-[#1E293B] hover:border-[#06B6D4] gap-1.5"
            title="التوصيات المحفوظة في قاعدة البيانات"
          >
            <FolderBookmark className="h-3.5 w-3.5 text-[#06B6D4]" />
            <span className="hidden sm:inline">التوصيات المحفوظة</span>
            {savedSignals.length > 0 && (
              <span className="h-4 min-w-4 px-1 rounded-full bg-[#06B6D4]/20 text-[#06B6D4] font-mono text-[10px] font-bold flex items-center justify-center">
                {savedSignals.length}
              </span>
            )}
          </Button>

          {/* Trade History Journal Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsJournalOpen(true)}
            className="h-8 px-2.5 text-xs text-[#E2E8F0] border-[#1E293B] hover:border-[#10B981] gap-1.5"
            title="سجل الصفقات وتحليلات الأداء"
          >
            <BookOpen className="h-3.5 w-3.5 text-[#10B981]" />
            <span className="hidden md:inline">سجل الصفقات</span>
            {journalEntries.length > 0 && (
              <span className="h-4 min-w-4 px-1 rounded-full bg-[#10B981]/20 text-[#10B981] font-mono text-[10px] font-bold flex items-center justify-center">
                {journalEntries.length}
              </span>
            )}
          </Button>

          {/* Settings Modal Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSettingsOpen(true)}
            className="h-8 px-2 text-xs text-[#E2E8F0] border-[#1E293B] hover:border-[#8B5CF6]"
            title="إعدادات الـ API والذكاء الاصطناعي"
          >
            <Settings className="h-3.5 w-3.5 text-[#8B5CF6]" />
            <span className="hidden xl:inline ml-1">الـ API</span>
          </Button>

          {/* Supabase User / Login Status */}
          {authUser ? (
            <div className="flex items-center gap-1.5 bg-[#0F1419] border border-[#1E293B] rounded-lg px-2 py-1">
              <div className="flex items-center gap-1 text-xs">
                <User className="h-3.5 w-3.5 text-[#10B981]" />
                <span className="font-mono text-[11px] text-[#E2E8F0] max-w-[100px] truncate hidden sm:inline">
                  {authUser.email.split("@")[0]}
                </span>
              </div>
              <button
                onClick={signOutUser}
                className="text-[#64748B] hover:text-[#F43F5E] p-0.5 rounded transition-colors cursor-pointer mr-1"
                title="تسجيل الخروج"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Button
              variant="scanner"
              size="sm"
              onClick={() => setIsAuthModalOpen(true)}
              className="h-8 px-2.5 text-xs font-bold gap-1"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>تسجيل الدخول</span>
            </Button>
          )}

          {/* Audio Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleAudioToggle}
            className="h-8 w-8 relative text-[#64748B] hover:text-[#E2E8F0]"
            title={audioEnabled ? "تعطيل التنبيهات الصوتية" : "تفعيل التنبيهات الصوتية"}
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
        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-200 cursor-pointer",
        active
          ? goldMode
            ? "bg-[#F59E0B]/20 text-[#F59E0B] shadow-inner border border-[#F59E0B]/30"
            : "bg-[#8B5CF6]/20 text-[#8B5CF6] shadow-inner border border-[#8B5CF6]/30"
          : "text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1E293B]/50",
      )}
    >
      {icon}
      <span>{label}</span>
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
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-all duration-200 cursor-pointer",
        active
          ? "bg-[#1E293B] text-[#E2E8F0] shadow-inner border border-[#334155]"
          : "text-[#64748B] hover:text-[#E2E8F0]",
      )}
    >
      <ArrowRightLeft className="h-3 w-3" />
      <span>{label}</span>
    </button>
  );
}

function HealthBadge({ health }: { health: string }) {
  const configs = {
    STABLE: { label: "مستقر - آمن للتداول", variant: "bullish" as const },
    CAUTION: { label: "تذبذب متوسط - بحذر", variant: "warning" as const },
    HIGH_RISK: { label: "تذبذب عنيف - خطر هبوط", variant: "danger" as const },
    UNKNOWN: { label: "جارٍ فحص السوق...", variant: "default" as const },
  };

  const config = configs[health as keyof typeof configs] || configs.UNKNOWN;

  return (
    <Badge variant={config.variant} className="text-[11px] font-bold">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full ml-1",
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
      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0F1419] border border-[#1E293B]"
      title={`حالة البث المباشر (WebSocket): ${isConnected ? "متصل" : "جارٍ إعادة الاتصال"}`}
    >
      {isConnected ? (
        <Wifi className="h-3.5 w-3.5 text-[#10B981]" />
      ) : (
        <WifiOff className="h-3.5 w-3.5 text-[#64748B]" />
      )}
      <span className="text-[10px] text-[#64748B] hidden 2xl:inline">
        {isConnected ? "بث حي" : "إعادة الاتصال"}
      </span>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isConnected ? "bg-[#10B981] animate-pulse" : "bg-[#64748B]",
        )}
      />
    </div>
  );
}
