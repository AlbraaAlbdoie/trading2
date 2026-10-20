// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Auto-Monitor Header Toggle (وضع المراقبة الخادمي والآلي)
// Phase 2: Triggers server-side market scans, monitors scheduled runs,
// displays server execution state, and eliminates heavy client-side loops.
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Radio, Loader2, ChevronDown, Check, Zap, Server, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/store/useDashboardStore";
import { playTradeChime } from "@/hooks/useAudioAlert";
import { requestNotificationPermission } from "@/lib/webNotifications";
import { cn } from "@/lib/utils";

const INTERVAL_OPTIONS = [
  { value: 5, label: "5 دقائق" },
  { value: 15, label: "15 دقيقة" },
  { value: 30, label: "30 دقيقة" },
] as const;

interface LastRunInfo {
  symbols_scanned: number;
  opportunities_found: number;
  alerts_dispatched: number;
  duration_ms: number;
  status: string;
  created_at: string;
}

export function AutoMonitorToggle() {
  const { addToast } = useDashboardStore();

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
  const [lastRun, setLastRun] = useState<LastRunInfo | null>(null);

  // Persistent Refs for Target Timestamp & Timer
  const targetTimeRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Fetch latest server monitor run status
  const fetchMonitorStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/cron/market-scan?status=1");
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.lastRun) {
          setLastRun(data.lastRun);
        }
      }
    } catch {
      // Quiet fail if offline
    }
  }, []);

  // Poll status on mount and every 30 seconds
  useEffect(() => {
    fetchMonitorStatus();
    const statusInterval = setInterval(fetchMonitorStatus, 30000);
    return () => clearInterval(statusInterval);
  }, [fetchMonitorStatus]);

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

  // Phase 2: Execute Scan via the Server-Side Scheduled Route
  const executeServerScan = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);

    try {
      const res = await fetch("/api/cron/market-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.alerts_dispatched > 0) {
            playTradeChime("high");
            addToast(
              `🚨 تم رصد وإرسال ${data.alerts_dispatched} تنبيه تداول جديد إلى تليجرام!`,
              "success",
            );
          } else if (data.opportunities_found > 0) {
            addToast(
              `📡 اكتمل الفحص: رُصدت ${data.opportunities_found} فرصة قيد المراقبة (تنتظر الزناد).`,
              "info",
            );
          }
        }
      }
      // Refresh status after scan
      await fetchMonitorStatus();
    } catch (err) {
      console.warn("[AutoMonitor] Server scan trigger error:", err);
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, addToast, fetchMonitorStatus]);

  const executeServerScanRef = useRef(executeServerScan);
  useEffect(() => {
    executeServerScanRef.current = executeServerScan;
  }, [executeServerScan]);

  // Bulletproof Countdown Controller
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

    if (!targetTimeRef.current || targetTimeRef.current <= Date.now()) {
      targetTimeRef.current = Date.now() + intervalMinutes * 60 * 1000;
      setSecondsRemaining(intervalMinutes * 60);
      // Run initial check on start
      executeServerScanRef.current();
    }

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    countdownIntervalRef.current = setInterval(() => {
      if (!targetTimeRef.current) return;

      const remaining = Math.max(0, Math.ceil((targetTimeRef.current - Date.now()) / 1000));
      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        targetTimeRef.current = Date.now() + intervalMinutes * 60 * 1000;
        setSecondsRemaining(intervalMinutes * 60);
        executeServerScanRef.current();
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
      const perm = await requestNotificationPermission();
      if (perm === "granted") {
        addToast("تم تفعيل إشعارات الويب وسطح المكتب بنجاح! 🔔", "success");
      }
      targetTimeRef.current = Date.now() + intervalMinutes * 60 * 1000;
      setSecondsRemaining(intervalMinutes * 60);
      setIsEnabled(true);
      addToast(
        `🟢 تم تفعيل المراقبة الآلية (فحص كل ${intervalMinutes} دقيقة)`,
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
    addToast(`تم ضبط فترة المراقبة إلى ${val} دقائق`, "info");
  };

  const handleManualScanNow = async () => {
    setShowDropdown(false);
    addToast("جاري تنفيذ فحص فوري خادمي للسوق... ⏳", "info");
    await executeServerScan();
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const formatLastRunTime = (isoString?: string) => {
    if (!isoString) return "لا توجد بيانات سابقة";
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return isoString;
    }
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
            ? `🟢 المراقبة تعمل (فحص خادمي كل ${intervalMinutes} دقائق) - الفحص القادم بعد: ${formatCountdown(secondsRemaining)}`
            : `تفعيل وضع المراقبة الخادمي (فحص كل ${intervalMinutes} دقائق)`
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

      {/* Interval Selector & Status Dropdown */}
      <div className="relative z-50" ref={dropdownRef}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDropdown((v) => !v)}
          className="h-8 px-1.5 text-[11px] font-mono text-[#94A3B8] border-[#1E293B] bg-[#0A0D14] hover:text-[#E2E8F0] cursor-pointer"
          title="خيارات الفحص وحالة المراقبة الخادمية"
        >
          <span>{intervalMinutes}د</span>
          <ChevronDown className="h-3 w-3 ml-0.5 text-[#64748B]" />
        </Button>

        {showDropdown && (
          <div className="absolute left-0 mt-1.5 w-56 bg-[#0F141C] border border-[#1E293B] rounded-xl shadow-2xl py-1.5 z-50 backdrop-blur-xl animate-fade-in text-xs">
            {/* Header */}
            <div className="px-3 py-1 text-[10px] text-[#64748B] font-bold border-b border-[#1E293B] flex items-center justify-between">
              <span>خيارات المراقبة الخادمية:</span>
              <Server className="h-3 w-3 text-[#10B981]" />
            </div>

            {/* Quick Trigger Button */}
            <div className="p-1.5 border-b border-[#1E293B]">
              <button
                type="button"
                onClick={handleManualScanNow}
                disabled={isScanning}
                className="w-full py-1.5 px-2 bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#10B981] border border-[#10B981]/30 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isScanning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                <span>فحص خادمي فوري الآن</span>
              </button>
            </div>

            {/* Interval Options */}
            <div className="px-2.5 py-1 text-[10px] text-[#64748B] font-bold">
              فترة التكرار التلقائي:
            </div>
            {INTERVAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelectInterval(opt.value)}
                className={cn(
                  "w-full text-right px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[#1E293B]/70 transition-colors cursor-pointer",
                  intervalMinutes === opt.value
                    ? "text-[#10B981] font-bold bg-[#10B981]/10"
                    : "text-[#E2E8F0]",
                )}
              >
                <span>{opt.label}</span>
                {intervalMinutes === opt.value && (
                  <Check className="h-3.5 w-3.5 text-[#10B981]" />
                )}
              </button>
            ))}

            {/* Last Execution Run Info */}
            {lastRun && (
              <div className="mt-1 pt-1.5 px-3 py-1.5 bg-[#090C11] border-t border-[#1E293B] text-[10px] text-[#94A3B8] space-y-0.5">
                <div className="flex items-center justify-between text-[#64748B]">
                  <span className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" /> آخر فحص:
                  </span>
                  <span className="font-mono text-[#E2E8F0]">
                    {formatLastRunTime(lastRun.created_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>العملات المفحوصة:</span>
                  <span className="font-mono font-bold text-[#E2E8F0]">
                    {lastRun.symbols_scanned}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>الفرص المكتشفة:</span>
                  <span className="font-mono font-bold text-[#10B981]">
                    {lastRun.opportunities_found}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
