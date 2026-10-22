// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Paper Trading Execution Modal (التداول التجريبي برصيد افتراضي)
// Real-time PnL, auto SL/TP simulation, fee & slippage deductions, portfolio overview
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React, { useState } from "react";
import {
  X,
  Wallet,
  TrendingUp,
  TrendingDown,
  RefreshCcw,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Cpu,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardStore } from "@/store/useDashboardStore";
import { formatPrice } from "@/lib/utils";

export function PaperTradingModal() {
  const {
    state,
    setIsPaperModalOpen,
    closePaperPosition,
    resetPaperAccount,
  } = useDashboardStore();
  const { paperAccount, isPaperModalOpen } = state;

  const [activeTab, setActiveTab] = useState<"positions" | "history">("positions");

  if (!isPaperModalOpen) return null;

  const totalRealizedPnl = paperAccount.history.reduce((sum, h) => sum + h.pnl, 0);
  const totalFeesPaid =
    paperAccount.history.reduce((sum, h) => sum + h.totalFees, 0) +
    paperAccount.positions.reduce((sum, p) => sum + p.feesPaid, 0);

  const winningTrades = paperAccount.history.filter((h) => h.pnl > 0).length;
  const winRate =
    paperAccount.history.length > 0
      ? Math.round((winningTrades / paperAccount.history.length) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-[#1E293B] bg-[#0F1419] shadow-2xl p-4 sm:p-6 text-right overflow-hidden"
        dir="rtl"
      >
        {/* Glow accent */}
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-[#10B981] via-[#06B6D4] to-[#8B5CF6]" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-[#1E293B] mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#10B981]/15 border border-[#10B981]/30">
              <Wallet className="h-5 w-5 text-[#10B981]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#E2E8F0]">
                  وضع التداول التجريبي (Paper Trading)
                </h2>
                <Badge className="bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40 text-[10px]">
                  رصيد افتراضي آمن
                </Badge>
              </div>
              <p className="text-xs text-[#64748B]">
                محاكاة واقعية للتداول تشمل خصم رسوم الصانع/الآخذ (0.08%) والانزلاق السعري (0.04%)
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsPaperModalOpen(false)}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1E293B] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Summary Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 shrink-0">
          <div className="p-2.5 rounded-xl bg-[#080C14] border border-[#1E293B]">
            <span className="text-[10px] text-[#64748B] block mb-0.5">القيمة الإجمالية (Equity)</span>
            <span className="text-sm sm:text-base font-bold font-mono text-[#E2E8F0]">
              ${formatPrice(paperAccount.equity)}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#080C14] border border-[#1E293B]">
            <span className="text-[10px] text-[#64748B] block mb-0.5">الرصيد المتاح (Cash)</span>
            <span className="text-sm sm:text-base font-bold font-mono text-[#06B6D4]">
              ${formatPrice(paperAccount.balance)}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#080C14] border border-[#1E293B]">
            <span className="text-[10px] text-[#64748B] block mb-0.5">الأرباح المحققة (PnL)</span>
            <span
              className={`text-sm sm:text-base font-bold font-mono ${
                totalRealizedPnl >= 0 ? "text-[#10B981]" : "text-[#F43F5E]"
              }`}
            >
              {totalRealizedPnl >= 0 ? "+" : ""}${formatPrice(totalRealizedPnl)}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#080C14] border border-[#1E293B]">
            <span className="text-[10px] text-[#64748B] block mb-0.5">نسبة الفوز / الرسوم</span>
            <span className="text-xs font-bold font-mono text-[#E2E8F0] block">
              {winRate}% فوز
            </span>
            <span className="text-[9px] text-[#64748B]">عمولات: ${totalFeesPaid.toFixed(2)}</span>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-[#1E293B] pb-2 mb-3 shrink-0">
          <button
            onClick={() => setActiveTab("positions")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "positions"
                ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40"
                : "text-[#64748B] hover:text-[#E2E8F0]"
            }`}
          >
            الصفقات المفتوحة ({paperAccount.positions.length})
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "history"
                ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40"
                : "text-[#64748B] hover:text-[#E2E8F0]"
            }`}
          >
            سجل الصفقات المغلقة ({paperAccount.history.length})
          </button>
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
          {activeTab === "positions" ? (
            paperAccount.positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-[#64748B]">
                <Receipt className="h-10 w-10 mb-2 opacity-40 text-[#10B981]" />
                <p className="text-xs font-semibold text-[#94A3B8]">لا توجد صفقات مفتوحة حالياً</p>
                <p className="text-[11px] mt-1">
                  يمكنك فتح صفقة تجريبية مباشرة من بطاقة التحليل الذكي أو من شريط التحكم العلوي.
                </p>
              </div>
            ) : (
              paperAccount.positions.map((pos) => {
                const isLong = pos.direction === "LONG" || pos.direction === "SPOT_BUY";
                const isProfitable = pos.unrealizedPnl >= 0;

                return (
                  <div
                    key={pos.id}
                    className="p-3 rounded-xl bg-[#080C14] border border-[#1E293B] hover:border-[#334155] transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#E2E8F0] font-mono">
                          {pos.symbol}
                        </span>
                        <Badge
                          className={`text-[9px] px-1.5 py-0 ${
                            isLong
                              ? "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30"
                              : "bg-[#F43F5E]/15 text-[#F43F5E] border-[#F43F5E]/30"
                          }`}
                        >
                          {pos.direction}
                        </Badge>
                        <span className="text-[10px] text-[#64748B]">
                          حجم: ${pos.amount.toFixed(0)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-left font-mono">
                          <span
                            className={`text-xs font-bold block ${
                              isProfitable ? "text-[#10B981]" : "text-[#F43F5E]"
                            }`}
                          >
                            {isProfitable ? "+" : ""}${pos.unrealizedPnl.toFixed(2)} (
                            {isProfitable ? "+" : ""}
                            {pos.unrealizedPnlPct.toFixed(2)}%)
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => closePaperPosition(pos.id, "MANUAL_CLOSE")}
                          className="h-6 px-2 text-[10px] border-[#F43F5E]/40 text-[#F43F5E] hover:bg-[#F43F5E]/20 cursor-pointer"
                        >
                          إغلاق يدوي
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono bg-[#0D131C] p-2 rounded-lg border border-[#1E293B]/60 text-[#CBD5E1]">
                      <div>
                        <span className="text-[#64748B] block">سعر الدخول:</span>
                        <span>${formatPrice(pos.entryPrice)}</span>
                      </div>
                      <div>
                        <span className="text-[#64748B] block">السعر الحالي:</span>
                        <span>${formatPrice(pos.currentPrice)}</span>
                      </div>
                      <div>
                        <span className="text-[#64748B] block">وقف الخسارة:</span>
                        <span className="text-[#F43F5E]">${formatPrice(pos.stopLoss)}</span>
                      </div>
                      <div>
                        <span className="text-[#64748B] block">الهدف 1 / 2:</span>
                        <span className="text-[#10B981]">
                          ${formatPrice(pos.takeProfit1)} / ${formatPrice(pos.takeProfit2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : paperAccount.history.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-[#64748B]">
              <Clock className="h-10 w-10 mb-2 opacity-40 text-[#06B6D4]" />
              <p className="text-xs font-semibold text-[#94A3B8]">لا يوجد سجل صفقات مغلقة بعد</p>
              <p className="text-[11px] mt-1">
                عند لمس وقف الخسارة أو الأهداف أو الإغلاق اليدوي، سيتم حفظ تفاصيل الصفقة وصافي أرباحها هنا.
              </p>
            </div>
          ) : (
            paperAccount.history.map((hist) => {
              const isWin = hist.pnl > 0;
              return (
                <div
                  key={hist.id}
                  className="p-2.5 rounded-xl bg-[#080C14] border border-[#1E293B] text-xs font-mono"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[#E2E8F0]">{hist.symbol}</span>
                      <Badge
                        className={`text-[9px] px-1 py-0 ${
                          hist.direction === "SHORT"
                            ? "bg-[#F43F5E]/15 text-[#F43F5E]"
                            : "bg-[#10B981]/15 text-[#10B981]"
                        }`}
                      >
                        {hist.direction}
                      </Badge>
                      <Badge variant="default" className="text-[9px] px-1 py-0 border-[#1E293B] bg-[#1E293B]/40 text-[#94A3B8]">
                        {hist.closeReason}
                      </Badge>
                    </div>

                    <div className="text-left font-bold">
                      <span className={isWin ? "text-[#10B981]" : "text-[#F43F5E]"}>
                        {isWin ? "+" : ""}${hist.pnl.toFixed(2)} ({isWin ? "+" : ""}
                        {hist.pnlPct.toFixed(2)}%)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#64748B] mt-1.5 pt-1.5 border-t border-[#1E293B]/50">
                    <span>
                      دخول: ${formatPrice(hist.entryPrice)} ← خروج: ${formatPrice(hist.exitPrice)}
                    </span>
                    <span>عمولات مخصومة: ${hist.totalFees.toFixed(2)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#1E293B] shrink-0 text-xs">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetPaperAccount}
            className="h-8 px-2.5 text-xs text-[#F43F5E] hover:bg-[#F43F5E]/10 gap-1 cursor-pointer"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            <span>إعادة ضبط المحفظة ($10,000)</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaperModalOpen(false)}
            className="h-8 px-4 text-xs font-semibold"
          >
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
}
