// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Auto-Monitor Header Toggle (وضع المراقبة التلقائية)
// Robust Countdown Timer (useRef + timestamp), Dropdown Layering & Persistent State
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Radio, Loader2, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/store/useDashboardStore";
import { playTradeChime } from "@/hooks/useAudioAlert";
import {
  requestNotificationPermission,
  sendTradeSignalNotification,
  getNotificationPermission,
} from "@/lib/webNotifications";
import { sendTelegramTradeAlert } from "@/lib/telegram";
import { DEFAULT_API_KEYS } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { AiTradeRecommendation } from "@/lib/types";
import { cn } from "@/lib/utils";

const INTERVAL_OPTIONS = [
  { value: 5, label: "5 دقائق" },
  { value: 15, label: "15 دقيقة" },
  { value: 30, label: "30 دقيقة" },
] as const;

export function AutoMonitorToggle() {
  const { state, addToast } = useDashboardStore();
  const { tickers, goldTicker, tradeMode, apiSettings, authUser } = state;

  // 1. Persistent State Initialization from localStorage
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("auto_monitor_active") === "true";
    }
    return false;
  });

  const [intervalMinutes, setIntervalMinutes] = useState<5 | 15 | 30>(() => {
    if (typeof window !== "undefined") {
      const saved = Number(localStorage.getItem("auto_monitor_interval"));
      if (saved === 5 || saved === 15 || saved === 30) return saved as 5 | 15 | 30;
    }
    return 5;
  });

  const [isScanning, setIsScanning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(intervalMinutes * 60);
  const [showDropdown, setShowDropdown] = useState(false);

  // Persistent Refs for Target Timestamp & Timer (Prevents reset on state/ticker ticks)
  const targetTimeRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  // Sync state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("auto_monitor_active", String(isEnabled));
      localStorage.setItem("auto_monitor_interval", String(intervalMinutes));
    } catch {}
  }, [isEnabled, intervalMinutes]);

  // Scan cycle executor
  const executeScanCycle = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);

    try {
      // Gather scan candidates: Top 3 cryptos by RVOL + Gold
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

              // Send Telegram trade alert
              const botToken = apiSettings.telegramBotToken || DEFAULT_API_KEYS.telegramBotToken;
              const chatId = apiSettings.telegramChatId || DEFAULT_API_KEYS.telegramChatId;
              if (botToken && chatId) {
                sendTelegramTradeAlert(botToken, chatId, rec).catch((tgErr) => {
                  console.warn("[AutoMonitor] Telegram alert dispatch notice:", tgErr);
                });
              }

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
                `🚨 رصدت المراقبة التلقائية فرصة مؤكدة: ${rec.symbol} (${score}%)`,
                "success",
              );
            }
          }
        } catch (fetchErr) {
          console.warn("[AutoMonitor] Asset check error:", fetchErr);
        }
      }

      if (detectedHighConfluence === 0) {
        console.log("[AutoMonitor] Scan completed: No high-confluence setups (stay in cash)");
      }
    } finally {
      setIsScanning(false);
    }
  }, [
    isScanning,
    tickers,
    goldTicker,
    tradeMode,
    apiSettings,
    authUser,
    addToast,
  ]);

  // Keep latest executeScanCycle in a stable ref to avoid restarting the timer when tickers change
  const executeScanCycleRef = useRef(executeScanCycle);
  useEffect(() => {
    executeScanCycleRef.current = executeScanCycle;
  }, [executeScanCycle]);

  // ── Bulletproof Countdown Controller (Issue 1 Fix) ──
  useEffect(() => {
    if (!isEnabled) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      targetTimeRef.current = null;
      setSecondsRemaining(intervalMinutes * 60);
      return;
    }

    // Initialize or recalculate target timestamp if not set
    if (!targetTimeRef.current || targetTimeRef.current <= Date.now()) {
      targetTimeRef.current = Date.now() + intervalMinutes * 60 * 1000;
      setSecondsRemaining(intervalMinutes * 60);
      // Run initial check on start
      executeScanCycleRef.current();
    }

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    countdownIntervalRef.current = setInterval(() => {
      if (!targetTimeRef.current) return;

      const remaining = Math.max(0, Math.ceil((targetTimeRef.current - Date.now()) / 1000));
      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        // Schedule next cycle timestamp
        targetTimeRef.current = Date.now() + intervalMinutes * 60 * 1000;
        setSecondsRemaining(intervalMinutes * 60);
        executeScanCycleRef.current();
      }
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [isEnabled, intervalMinutes]);

  const handleToggle = async () => {
    if (!isEnabled) {
      // Request notifications permission if not granted
      const perm = await requestNotificationPermission();
      if (perm === "granted") {
        addToast("تم تفعيل إشعارات الويب وسطح المكتب بنجاح! 🔔", "success");
      }
      targetTimeRef.current = Date.now() + intervalMinutes * 60 * 1000;
      setSecondsRemaining(intervalMinutes * 60);
      setIsEnabled(true);
      addToast(
        `🟢 المراقبة تعمل الآن (فحص تلقائي كل ${intervalMinutes} دقائق)`,
        "info",
      );
    } else {
      setIsEnabled(false);
      targetTimeRef.current = null;
      setSecondsRemaining(intervalMinutes * 60);
      addToast("تم إيقاف وضع المراقبة التلقائية", "info");
    }
  };

  const handleSelectInterval = (val: 5 | 15 | 30) => {
    setIntervalMinutes(val);
    targetTimeRef.current = Date.now() + val * 60 * 1000;
    setSecondsRemaining(val * 60);
    setShowDropdown(false);
    addToast(`تم ضبط فترة المراقبة التلقائية إلى ${val} دقائق`, "info");
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="relative z-50 inline-flex items-center gap-1">
      {/* Main Toggle Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggle}
        className={cn(
          "h-8 px-2 sm:px-2.5 text-xs font-semibold gap-1.5 transition-all duration-300 cursor-pointer",
          isEnabled
            ? "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
            : "bg-[#0A0D14] text-[#94A3B8] border-[#1E293B] hover:text-[#E2E8F0] hover:border-[#8B5CF6]/50",
        )}
        title={
          isEnabled
            ? `🟢 المراقبة تعمل الآن (فحص تلقائي كل ${intervalMinutes} دقائق) - باقي: ${formatCountdown(secondsRemaining)}`
            : `وضع المراقبة التلقائية المستمرة (فحص كل ${intervalMinutes} دقائق)`
        }
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

        <span className="hidden sm:inline">
          {isEnabled ? "📡 المراقبة تعمل" : "📡 المراقبة التلقائية"}
        </span>
        <span className="sm:hidden">{isEnabled ? "📡 نشط" : "📡 مراقبة"}</span>

        {isEnabled && (
          <span className="font-mono text-[10px] text-[#A7F3D0] bg-[#10B981]/25 px-1.5 py-0.5 rounded font-bold">
            {formatCountdown(secondsRemaining)}
          </span>
        )}
      </Button>

      {/* Interval Selector Dropdown with high z-index and click-outside (Issue 2 Fix) */}
      <div className="relative z-50" ref={dropdownRef}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDropdown((v) => !v)}
          className="h-8 px-1.5 text-[11px] font-mono text-[#94A3B8] border-[#1E293B] bg-[#0A0D14] hover:text-[#E2E8F0] cursor-pointer"
          title="تغيير فترة الفحص الدوري"
        >
          <span>{intervalMinutes}د</span>
          <ChevronDown className="h-3 w-3 ml-0.5 text-[#64748B]" />
        </Button>

        {showDropdown && (
          <div className="absolute left-0 mt-1.5 w-36 bg-[#0F141C] border border-[#1E293B] rounded-xl shadow-2xl py-1 z-50 backdrop-blur-xl animate-fade-in">
            <div className="px-2.5 py-1 text-[10px] text-[#64748B] font-bold border-b border-[#1E293B]">
              فترة الفحص الدوري:
            </div>
            {INTERVAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelectInterval(opt.value)}
                className={cn(
                  "w-full text-right px-2.5 py-1.5 text-xs flex items-center justify-between hover:bg-[#1E293B]/70 transition-colors cursor-pointer",
                  intervalMinutes === opt.value
                    ? "text-[#10B981] font-bold bg-[#10B981]/10"
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
