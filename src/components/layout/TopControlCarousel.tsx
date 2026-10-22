// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Swipeable Top Control Carousel (Mobile & Desktop)
// Reorganizes cluttered top bars into 5 logical sections with touch swipe on mobile,
// tab navigation, active indicators, and zero vertical-scroll blocking.
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  Radio,
  Key,
  Sparkles,
  ShieldCheck,
  Wallet,
  ChevronRight,
  ChevronLeft,
  Volume2,
  VolumeX,
  Bitcoin,
  CircleDollarSign,
  Bell,
  Settings,
  BookOpen,
  FolderBookmark,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AutoMonitorToggle } from "@/components/AutoMonitorToggle";
import { useDashboardStore } from "@/store/useDashboardStore";
import { playTradeChime } from "@/hooks/useAudioAlert";
import { formatPrice, cn } from "@/lib/utils";

const SECTIONS = [
  { id: 0, title: "المراقب الذكي", icon: Radio, shortTitle: "المراقب" },
  { id: 1, title: "إعدادات الـ API", icon: Key, shortTitle: "مفاتيح API" },
  { id: 2, title: "تشخيص الذكاء الاصطناعي", icon: Sparkles, shortTitle: "فحص AI" },
  { id: 3, title: "المخاطر والأسواق", icon: ShieldCheck, shortTitle: "المخاطر" },
  { id: 4, title: "Paper Trading والسجلات", icon: Wallet, shortTitle: "التداول التجريبي" },
] as const;

export function TopControlCarousel() {
  const {
    state,
    setActiveMarket,
    setTradeMode,
    setAudioEnabled,
    setIsSettingsOpen,
    setIsJournalOpen,
    setIsSavedSignalsOpen,
    setIsPaperModalOpen,
    triggerTestSignalPipeline,
    testAiConnection,
    setActiveControlSection,
  } = useDashboardStore();

  const {
    activeMarket,
    tradeMode,
    audioEnabled,
    btcHealth,
    apiSettings,
    paperAccount,
    lastAiTestResult,
    isTestingAiConnection,
    activeControlSection,
    journalEntries,
    savedSignals,
  } = state;

  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [isSwipingHorizontally, setIsSwipingHorizontally] = useState(false);

  // Scroll to active section smoothly
  const scrollToSection = (index: number) => {
    setActiveControlSection(index);
    if (!carouselRef.current) return;
    const container = carouselRef.current;
    const items = container.querySelectorAll<HTMLElement>("[data-section-item]");
    if (items[index]) {
      items[index].scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  };

  // Listen to native scroll to sync active tab indicator
  const handleScroll = () => {
    if (!carouselRef.current) return;
    const container = carouselRef.current;
    const items = container.querySelectorAll<HTMLElement>("[data-section-item]");
    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;

    let closestIndex = 0;
    let minDistance = Infinity;

    items.forEach((item, idx) => {
      const itemRect = item.getBoundingClientRect();
      const itemCenter = itemRect.left + itemRect.width / 2;
      const distance = Math.abs(containerCenter - itemCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = idx;
      }
    });

    if (closestIndex !== activeControlSection) {
      setActiveControlSection(closestIndex);
    }
  };

  // Touch handlers that preserve vertical scroll while allowing horizontal swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
    setIsSwipingHorizontally(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;
    const diffX = e.touches[0].clientX - touchStartX;
    const diffY = e.touches[0].clientY - touchStartY;

    if (!isSwipingHorizontally && Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
      setIsSwipingHorizontally(true);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchEndX - touchStartX;

    // Threshold swipe distance (40px)
    if (Math.abs(diffX) > 40 && isSwipingHorizontally) {
      if (diffX < 0) {
        // Swiped Left in RTL -> Next section
        const next = Math.min(SECTIONS.length - 1, activeControlSection + 1);
        scrollToSection(next);
      } else {
        // Swiped Right in RTL -> Previous section
        const prev = Math.max(0, activeControlSection - 1);
        scrollToSection(prev);
      }
    }

    setTouchStartX(null);
    setTouchStartY(null);
    setIsSwipingHorizontally(false);
  };

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

  // Compute paper stats
  const totalOpenPositions = paperAccount.positions.length;
  const totalUnrealizedPnl = paperAccount.positions.reduce((s, p) => s + p.unrealizedPnl, 0);

  return (
    <div className="w-full bg-[#080C14]/95 border-b border-[#1E293B] relative select-none">
      {/* ── Top Section Selector / Navigation Dots (Mobile & Desktop) ── */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-1.5 border-b border-[#1E293B]/60 text-xs">
        {/* Navigation Tabs (Quick Switcher) */}
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-hide py-0.5">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeControlSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => scrollToSection(sec.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shrink-0 cursor-pointer",
                  isActive
                    ? "bg-[#8B5CF6]/20 text-[#C4B5FD] border border-[#8B5CF6]/40 shadow-sm shadow-violet-500/20"
                    : "text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1E293B]/40",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isActive ? "text-[#8B5CF6]" : "text-[#64748B]")} />
                <span className="hidden sm:inline">{sec.title}</span>
                <span className="sm:hidden">{sec.shortTitle}</span>
                {sec.id === 4 && totalOpenPositions > 0 && (
                  <span className="h-3.5 px-1 rounded-full bg-[#10B981]/20 text-[#10B981] font-mono text-[9px] font-bold flex items-center">
                    {totalOpenPositions}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Swipe Chevrons (Mobile Aid) */}
        <div className="flex items-center gap-1 shrink-0 mr-2 sm:hidden">
          <button
            onClick={() => scrollToSection(Math.max(0, activeControlSection - 1))}
            disabled={activeControlSection === 0}
            className="p-1 rounded text-[#64748B] hover:text-[#E2E8F0] disabled:opacity-30 cursor-pointer"
            title="القسم السابق"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="flex gap-1">
            {SECTIONS.map((sec) => (
              <div
                key={sec.id}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  activeControlSection === sec.id ? "w-3 bg-[#8B5CF6]" : "w-1.5 bg-[#334155]",
                )}
              />
            ))}
          </div>
          <button
            onClick={() => scrollToSection(Math.min(SECTIONS.length - 1, activeControlSection + 1))}
            disabled={activeControlSection === SECTIONS.length - 1}
            className="p-1 rounded text-[#64748B] hover:text-[#E2E8F0] disabled:opacity-30 cursor-pointer"
            title="القسم التالي"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Carousel Slider Container (Swipeable on Mobile, Responsive on Desktop) ── */}
      <div
        ref={carouselRef}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: "pan-y" }}
        className="flex items-center overflow-x-auto snap-x snap-mandatory scrollbar-hide py-2 px-3 sm:px-4 gap-3"
      >
        {/* ── Section 1: المراقب الذكي وحالة تشغيله ── */}
        <div
          data-section-item
          className="snap-center shrink-0 w-full sm:w-auto min-w-[280px] sm:min-w-0 flex items-center justify-between sm:justify-start gap-2 bg-[#0F1419] p-2 rounded-xl border border-[#1E293B]"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/30">
              <Radio className="h-4 w-4 text-[#3B82F6]" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#E2E8F0] block">المراقب الذكي (Cron)</span>
              <span className="text-[10px] text-[#64748B]">فحص آلي متكرر وإرسال صفقات</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AutoMonitorToggle />
          </div>
        </div>

        {/* ── Section 2: إعدادات ومفاتيح الـ API ── */}
        <div
          data-section-item
          className="snap-center shrink-0 w-full sm:w-auto min-w-[280px] sm:min-w-0 flex items-center justify-between sm:justify-start gap-2 bg-[#0F1419] p-2 rounded-xl border border-[#1E293B]"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/30">
              <Key className="h-4 w-4 text-[#8B5CF6]" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#E2E8F0] block">مفاتيح الـ API والتنبيهات</span>
              <div className="flex items-center gap-1.5 text-[10px] text-[#64748B]">
                <span className={apiSettings.geminiKey ? "text-[#10B981]" : "text-[#F59E0B]"}>
                  Gemini: {apiSettings.geminiKey ? "✓" : "خادم"}
                </span>
                <span>•</span>
                <span className={apiSettings.telegramBotToken ? "text-[#10B981]" : "text-[#64748B]"}>
                  Telegram: {apiSettings.telegramBotToken ? "✓" : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={triggerTestSignalPipeline}
              className="h-7 px-2 text-[11px] text-[#60A5FA] border-[#3B82F6]/40 hover:bg-[#3B82F6]/15 gap-1 cursor-pointer"
              title="اختبار الإشعار والصوت وصفقة تجريبية"
            >
              <Bell className="h-3 w-3 text-[#3B82F6]" />
              <span>إشعار تجريبي</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              className="h-7 px-2.5 text-[11px] text-[#E2E8F0] border-[#1E293B] hover:border-[#8B5CF6] gap-1 cursor-pointer"
            >
              <Settings className="h-3 w-3 text-[#8B5CF6]" />
              <span>الإعدادات</span>
            </Button>
          </div>
        </div>

        {/* ── Section 3: حالة خدمات الذكاء الاصطناعي واختبار الاتصال ── */}
        <div
          data-section-item
          className="snap-center shrink-0 w-full sm:w-auto min-w-[280px] sm:min-w-0 flex items-center justify-between sm:justify-start gap-2 bg-[#0F1419] p-2 rounded-xl border border-[#1E293B]"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#06B6D4]/15 border border-[#06B6D4]/30">
              <Sparkles className="h-4 w-4 text-[#06B6D4]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#E2E8F0]">خدمة الذكاء الاصطناعي</span>
                <Badge className="bg-[#06B6D4]/20 text-[#06B6D4] border-[#06B6D4]/40 text-[9px] px-1 py-0">
                  {apiSettings.selectedModel || "gemini-2.0-flash"}
                </Badge>
              </div>
              <span className="text-[10px] text-[#64748B]">
                {lastAiTestResult
                  ? `${lastAiTestResult.messageArabic} (${lastAiTestResult.latencyMs}ms)`
                  : "جاهز لاختبار سرعة الاستجابة"}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => testAiConnection()}
            disabled={isTestingAiConnection}
            className="h-7 px-2.5 text-[11px] border-[#06B6D4]/40 text-[#67E8F9] hover:bg-[#06B6D4]/20 gap-1.5 cursor-pointer font-semibold shrink-0"
          >
            {isTestingAiConnection ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-[#06B6D4]" />
                <span>فحص...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 text-[#06B6D4]" />
                <span>اختبار الاتصال</span>
              </>
            )}
          </Button>
        </div>

        {/* ── Section 4: إعدادات التحليل والمخاطر ── */}
        <div
          data-section-item
          className="snap-center shrink-0 w-full sm:w-auto min-w-[280px] sm:min-w-0 flex items-center justify-between sm:justify-start gap-2 bg-[#0F1419] p-2 rounded-xl border border-[#1E293B]"
        >
          {/* Market Tab Switch */}
          <div className="flex items-center gap-1 bg-[#080C14] rounded-lg p-0.5 border border-[#1E293B]">
            <button
              onClick={() => handleMarketChange("crypto")}
              className={cn(
                "px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer",
                activeMarket === "crypto"
                  ? "bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40"
                  : "text-[#64748B] hover:text-[#E2E8F0]",
              )}
            >
              <Bitcoin className="h-3 w-3" />
              <span>كريبتو</span>
            </button>
            <button
              onClick={() => handleMarketChange("gold")}
              className={cn(
                "px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer",
                activeMarket === "gold"
                  ? "bg-[#EAB308]/20 text-[#EAB308] border border-[#EAB308]/40"
                  : "text-[#64748B] hover:text-[#E2E8F0]",
              )}
            >
              <CircleDollarSign className="h-3 w-3" />
              <span>الذهب</span>
            </button>
          </div>

          {/* Trade Mode Switch (Crypto only) */}
          {activeMarket === "crypto" && (
            <div className="flex items-center gap-1 bg-[#080C14] rounded-lg p-0.5 border border-[#1E293B]">
              <button
                onClick={() => handleModeChange("futures")}
                className={cn(
                  "px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer",
                  tradeMode === "futures"
                    ? "bg-[#3B82F6]/20 text-[#60A5FA] border border-[#3B82F6]/40"
                    : "text-[#64748B] hover:text-[#E2E8F0]",
                )}
              >
                عقود
              </button>
              <button
                onClick={() => handleModeChange("spot")}
                className={cn(
                  "px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer",
                  tradeMode === "spot"
                    ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40"
                    : "text-[#64748B] hover:text-[#E2E8F0]",
                )}
              >
                سبوت
              </button>
            </div>
          )}

          {/* Audio Chime Button */}
          <button
            onClick={handleAudioToggle}
            className={cn(
              "p-1.5 rounded-lg border transition-all cursor-pointer",
              audioEnabled
                ? "bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40"
                : "bg-[#080C14] text-[#64748B] border-[#1E293B] hover:text-[#E2E8F0]",
            )}
            title={audioEnabled ? "التنبيهات الصوتية مفعلة" : "تفعيل التنبيهات الصوتية"}
          >
            {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </div>

        {/* ── Section 5: سجل آخر الفحوصات وحالة Paper Trading ── */}
        <div
          data-section-item
          className="snap-center shrink-0 w-full sm:w-auto min-w-[280px] sm:min-w-0 flex items-center justify-between sm:justify-start gap-2 bg-[#0F1419] p-2 rounded-xl border border-[#1E293B]"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#10B981]/15 border border-[#10B981]/30">
              <Wallet className="h-4 w-4 text-[#10B981]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#E2E8F0]">Paper Trading</span>
                <span className="font-mono text-[11px] text-[#10B981] font-bold">
                  ${formatPrice(paperAccount.balance)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[#64748B]">
                <span>
                  {totalOpenPositions > 0
                    ? `${totalOpenPositions} صفقات مفتوحة`
                    : "لا توجد صفقات"}
                </span>
                {totalOpenPositions > 0 && (
                  <span
                    className={cn(
                      "font-mono font-bold",
                      totalUnrealizedPnl >= 0 ? "text-[#10B981]" : "text-[#F43F5E]",
                    )}
                  >
                    ({totalUnrealizedPnl >= 0 ? "+" : ""}${totalUnrealizedPnl.toFixed(2)})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPaperModalOpen(true)}
              className="h-7 px-2.5 text-[11px] text-[#10B981] border-[#10B981]/40 hover:bg-[#10B981]/20 font-bold gap-1 cursor-pointer"
            >
              <Wallet className="h-3 w-3 text-[#10B981]" />
              <span>المحفظة</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsJournalOpen(true)}
              className="h-7 px-2 text-[11px] text-[#E2E8F0] border-[#1E293B] hover:border-[#10B981] gap-1 cursor-pointer"
              title="سجل الصفقات المكتملة"
            >
              <BookOpen className="h-3 w-3 text-[#10B981]" />
              <span className="hidden sm:inline">السجل</span>
              {journalEntries.length > 0 && (
                <span className="font-mono text-[9px] text-[#10B981]">
                  ({journalEntries.length})
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
