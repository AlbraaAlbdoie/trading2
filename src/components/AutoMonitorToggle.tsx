// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Auto-Monitor Header Toggle (وضع المراقبة التلقائية)
// Background scans (5m, 15m, 30m), native push notifications & Supabase auto-save
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Radio, Loader2, Bell, BellRing, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardStore } from "@/store/useDashboardStore";
import { playTradeChime } from "@/hooks/useAudioAlert";
import {
  requestNotificationPermission,
  sendTradeSignalNotification,
  getNotificationPermission,
} from "@/lib/webNotifications";
import { supabase } from "@/lib/supabase";
import { AiTradeRecommendation } from "@/lib/types";
import { cn } from "@/lib/utils";

const INTERVAL_OPTIONS = [
  { value: 5, label: "5 دقائق" },
  { value: 15, label: "15 دقيقة" },
  { value: 30, label: "30 دقيقة" },
] as const;

export function AutoMonitorToggle() {
  const { state, addToast, saveCurrentSignal } = useDashboardStore();
  const { tickers, goldTicker, tradeMode, apiSettings, authUser } = state;

  const [isEnabled, setIsEnabled] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState<5 | 15 | 30>(5);
  const [isScanning, setIsScanning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(300);
  const [showDropdown, setShowDropdown] = useState(false);
  const [notificationState, setNotificationState] = useState<string>("default");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Check notification permission on mount
  useEffect(() => {
    setNotificationState(getNotificationPermission());
  }, []);

  // Scan cycle executor
  const executeScanCycle = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);

    try {
      // 1. Gather scan candidates: Top 3 cryptos by RVOL + Gold
      const candidates: Array<{
        symbol: string;
        market: "crypto" | "gold";
        price: number;
      }> = [...tickers]
        .sort((a, b) => b.volume24h * b.rvol - a.volume24h * a.rvol)
        .slice(0, 3)
        .map((c) => ({
          symbol: c.symbol,
          market: "crypto",
          price: c.markPrice,
        }));

      if (goldTicker && goldTicker.price > 0) {
        candidates.push({
          symbol: "XAUUSD",
          market: "gold",
          price: goldTicker.price,
        });
      }

      let detectedHighConfluence = 0;

      for (const asset of candidates) {
        try {
          const res = await fetch("/api/ai-analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              symbol: asset.symbol,
              market: asset.market,
              tradeMode,
              currentPrice: asset.price,
              apiSettings,
            }),
          });

          if (res.ok) {
            const rec: AiTradeRecommendation = await res.json();
            const score = rec.confluence_score || rec.confidence_score || 0;
            const isTrade =
              rec.status === "LONG" || rec.status === "SHORT" || rec.status === "SPOT_BUY";

            if (isTrade && score >= 80) {
              detectedHighConfluence++;
              // Play chime
              playTradeChime("high");

              // Send native web push notification
              sendTradeSignalNotification(rec);

              // Auto save to Supabase if user is logged in
              if (authUser) {
                try {
                  await supabase.from("saved_signals").insert([
                    {
                      user_id: authUser.id,
                      symbol: rec.symbol,
                      status: rec.status,
                      entry_price: rec.entry_price,
                      stop_loss: rec.stop_loss,
                      take_profit_1: rec.take_profit_1,
                      take_profit_2: rec.take_profit_2,
                      confidence_score: score,
                      reasoning_arabic: rec.reasoning_arabic,
                    },
                  ]);
                } catch (dbErr) {
                  console.warn("[AutoMonitor] DB auto-save failed:", dbErr);
                }
              }

              addToast(
                `🚨 رصدت المراقبة التلقائية فرصة مؤسساتية مؤكدة: ${rec.symbol} (${score}%)`,
                "success",
              );
            }
          }
        } catch (fetchErr) {
          console.warn("[AutoMonitor] Asset check error:", fetchErr);
        }
      }

      if (detectedHighConfluence === 0) {
        // Silent or gentle toast
        console.log("[AutoMonitor] Scan completed: No high-confluence setups found (stay in cash)");
      }
    } finally {
      setIsScanning(false);
      setSecondsRemaining(intervalMinutes * 60);
    }
  }, [
    isScanning,
    tickers,
    goldTicker,
    tradeMode,
    apiSettings,
    authUser,
    intervalMinutes,
    addToast,
  ]);

  // Interval & countdown controller
  useEffect(() => {
    if (!isEnabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    setSecondsRemaining(intervalMinutes * 60);

    // Initial scan when enabled
    executeScanCycle();

    // Countdown interval
    countdownRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          executeScanCycle();
          return intervalMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isEnabled, intervalMinutes, executeScanCycle]);

  const handleToggle = async () => {
    if (!isEnabled) {
      // Request notifications permission if not granted
      const perm = await requestNotificationPermission();
      setNotificationState(perm);
      if (perm === "granted") {
        addToast("تم تفعيل إشعارات الويب وسطح المكتب بنجاح! 🔔", "success");
      }
      setIsEnabled(true);
      addToast(
        `تم تفعيل وضع المراقبة التلقائية كل ${intervalMinutes} دقائق 📡`,
        "info",
      );
    } else {
      setIsEnabled(false);
      addToast("تم إيقاف وضع المراقبة التلقائية", "info");
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="relative inline-flex items-center gap-1">
      {/* Main Toggle Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggle}
        className={cn(
          "h-8 px-2 sm:px-2.5 text-xs font-semibold gap-1.5 transition-all duration-300",
          isEnabled
            ? "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
            : "bg-[#0A0D14] text-[#94A3B8] border-[#1E293B] hover:text-[#E2E8F0] hover:border-[#8B5CF6]/50",
        )}
        title="وضع المراقبة التلقائية المستمرة وإرسال إشعارات فورية بالصفقات القوية"
      >
        {isScanning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#10B981]" />
        ) : isEnabled ? (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]" />
          </span>
        ) : (
          <Radio className="h-3.5 w-3.5" />
        )}

        <span className="hidden sm:inline">📡 المراقبة التلقائية</span>
        <span className="sm:hidden">📡 مراقبة</span>

        {isEnabled && (
          <span className="font-mono text-[10px] text-[#A7F3D0] bg-[#10B981]/20 px-1 rounded">
            {formatCountdown(secondsRemaining)}
          </span>
        )}
      </Button>

      {/* Interval Selector Dropdown */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDropdown((v) => !v)}
          className="h-8 px-1.5 text-[11px] font-mono text-[#94A3B8] border-[#1E293B] bg-[#0A0D14] hover:text-[#E2E8F0]"
          title="تغيير فترة المراقبة التلقائية"
        >
          <span>{intervalMinutes}د</span>
          <ChevronDown className="h-3 w-3 ml-0.5 text-[#64748B]" />
        </Button>

        {showDropdown && (
          <div className="absolute left-0 mt-1.5 w-32 bg-[#0F141C] border border-[#1E293B] rounded-xl shadow-2xl py-1 z-50">
            <div className="px-2.5 py-1 text-[10px] text-[#64748B] font-bold border-b border-[#1E293B]">
              فترة الفحص الدوري:
            </div>
            {INTERVAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setIntervalMinutes(opt.value);
                  setSecondsRemaining(opt.value * 60);
                  setShowDropdown(false);
                }}
                className={cn(
                  "w-full text-right px-2.5 py-1.5 text-xs flex items-center justify-between hover:bg-[#1E293B]/50 transition-colors",
                  intervalMinutes === opt.value
                    ? "text-[#10B981] font-bold"
                    : "text-[#E2E8F0]",
                )}
              >
                <span>{opt.label}</span>
                {intervalMinutes === opt.value && (
                  <Check className="h-3 w-3 text-[#10B981]" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
