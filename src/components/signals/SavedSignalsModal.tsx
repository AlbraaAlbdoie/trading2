// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Saved Signals Drawer / Modal (`التوصيات المحفوظة`)
// Fetches and displays signals saved to Supabase with delete action
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React from "react";
import {
  X,
  FolderBookmark,
  Trash2,
  LineChart,
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardStore } from "@/store/useDashboardStore";
import { formatPrice } from "@/lib/utils";
import { playTradeChime } from "@/hooks/useAudioAlert";
import type { SavedSignalItem } from "@/lib/types";

export function SavedSignalsModal() {
  const {
    state,
    setIsSavedSignalsOpen,
    deleteSavedSignal,
    setSelectedSymbol,
    runAiAnalysis,
  } = useDashboardStore();

  const { isSavedSignalsOpen, savedSignals, audioEnabled, authUser } = state;

  if (!isSavedSignalsOpen) return null;

  const handleInspectInChart = (symbol: string) => {
    setSelectedSymbol(symbol);
    runAiAnalysis(symbol);
    setIsSavedSignalsOpen(false);
    if (audioEnabled) {
      playTradeChime("high");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in" dir="rtl">
      <div className="relative w-full max-w-3xl rounded-2xl border border-[#1E293B] bg-[#0F1419] shadow-2xl p-6 text-right overflow-hidden flex flex-col max-h-[85vh]">
        {/* Top Glow */}
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-[#06B6D4] via-[#8B5CF6] to-[#10B981]" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1E293B] mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#06B6D4]/15 border border-[#06B6D4]/30">
              <FolderBookmark className="h-5 w-5 text-[#06B6D4]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#E2E8F0]">
                  التوصيات المحفوظة في قاعدة البيانات (Saved Signals)
                </h2>
                <Badge variant="violet" className="text-[10px] font-mono">
                  {savedSignals.length} توصية
                </Badge>
              </div>
              <p className="text-xs text-[#64748B]">
                {authUser ? `الحساب المتصل: ${authUser.email}` : "قاعدة بيانات Supabase"}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsSavedSignalsOpen(false)}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1E293B] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Signals List Container */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {savedSignals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 gap-2 text-center text-xs text-[#64748B]">
              <FolderBookmark className="h-10 w-10 text-[#1E293B]" />
              <p className="font-bold text-[#E2E8F0] text-sm">لا توجد توصيات محفوظة حتى الآن</p>
              <p className="max-w-xs leading-relaxed">
                اضغط على زر <span className="text-[#8B5CF6] font-bold">"📌 حفظ التوصية في قاعدة البيانات"</span> في بطاقة التحليل بالذكاء الاصطناعي لحفظ أي فرصة تداول هنا للرجوع إليها دائماً.
              </p>
            </div>
          ) : (
            savedSignals.map((signal) => {
              const isLong = signal.status === "LONG" || signal.status === "SPOT_BUY";

              return (
                <div
                  key={signal.id}
                  className="rounded-xl border border-[#1E293B] bg-[#080C14] p-4 transition-all hover:border-[#334155] space-y-3"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-1.5 rounded-lg ${
                          isLong
                            ? "bg-[#10B981]/20 text-[#10B981]"
                            : "bg-[#F43F5E]/20 text-[#F43F5E]"
                        }`}
                      >
                        {isLong ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                      </div>
                      <span className="text-sm font-bold font-mono text-[#E2E8F0]">
                        {signal.symbol}
                      </span>
                      <Badge
                        variant={isLong ? "bullish" : "bearish"}
                        className="text-[10px] font-bold"
                      >
                        {signal.status}
                      </Badge>
                      <span className="text-[10px] text-[#64748B] flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3" />
                        {new Date(signal.created_at).toLocaleDateString("ar-SA", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleInspectInChart(signal.symbol)}
                        className="h-7 px-2.5 text-xs gap-1 border-[#1E293B] hover:border-[#8B5CF6]"
                      >
                        <LineChart className="h-3.5 w-3.5 text-[#8B5CF6]" />
                        <span>فتح في الشارت</span>
                      </Button>

                      <button
                        onClick={() => deleteSavedSignal(signal.id)}
                        className="p-1.5 text-[#64748B] hover:text-[#F43F5E] hover:bg-[#F43F5E]/10 rounded-lg transition-colors cursor-pointer"
                        title="حذف التوصية"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Pricing Matrix */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-[#0F1419] p-2 rounded-lg border border-[#1E293B]">
                      <span className="text-[10px] text-[#64748B] block mb-0.5">سعر الدخول:</span>
                      <span className="font-mono font-bold text-[#E2E8F0]">
                        ${formatPrice(signal.entry_price)}
                      </span>
                    </div>

                    <div className="bg-[#0F1419] p-2 rounded-lg border border-[#F43F5E]/30">
                      <span className="text-[10px] text-[#F43F5E] block mb-0.5 font-semibold">
                        وقف الخسارة (SL):
                      </span>
                      <span className="font-mono font-bold text-[#F43F5E]">
                        ${formatPrice(signal.stop_loss)}
                      </span>
                    </div>

                    <div className="bg-[#0F1419] p-2 rounded-lg border border-[#10B981]/30">
                      <span className="text-[10px] text-[#10B981] block mb-0.5 font-semibold">
                        الهدف الأول (TP1):
                      </span>
                      <span className="font-mono font-bold text-[#10B981]">
                        ${formatPrice(signal.take_profit_1)}
                      </span>
                    </div>

                    <div className="bg-[#0F1419] p-2 rounded-lg border border-[#8B5CF6]/30">
                      <span className="text-[10px] text-[#8B5CF6] block mb-0.5 font-semibold">
                        العائد للمخاطرة:
                      </span>
                      <span className="font-mono font-bold text-[#8B5CF6]">
                        {signal.risk_reward_ratio}
                      </span>
                    </div>
                  </div>

                  {/* Reasoning snippet */}
                  {signal.reasoning_arabic && (
                    <p className="text-[11px] text-[#94A3B8] leading-relaxed bg-[#0F1419] p-2 rounded-lg border border-[#1E293B]/60 font-sans">
                      {signal.reasoning_arabic}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
