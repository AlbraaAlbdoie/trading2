// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Trade History Journal & Performance Analytics
// Interactive Outcome Tracking, Live Metrics Bar, and CSV Export
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  BookOpen,
  Download,
  Trash2,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BarChart2,
  Award,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardStore } from "@/store/useDashboardStore";
import { formatPrice } from "@/lib/utils";
import { playTradeChime } from "@/hooks/useAudioAlert";
import type { TradeOutcome, TradeJournalEntry } from "@/lib/types";

export function TradeJournalModal() {
  const {
    state,
    setIsJournalOpen,
    updateTradeOutcome,
    deleteJournalEntry,
    clearJournal,
    addToast,
  } = useDashboardStore();

  const { isJournalOpen, journalEntries, audioEnabled } = state;
  const [filterOutcome, setFilterOutcome] = useState<string>("ALL");

  // Performance Analytics Metrics
  const metrics = useMemo(() => {
    const total = journalEntries.length;
    const wins = journalEntries.filter((e) => e.outcome === "WIN").length;
    const losses = journalEntries.filter((e) => e.outcome === "LOSS").length;
    const pending = journalEntries.filter((e) => e.outcome === "PENDING").length;

    const completed = wins + losses;
    const winRate = completed > 0 ? Math.round((wins / completed) * 100) : 0;

    return { total, wins, losses, pending, winRate };
  }, [journalEntries]);

  // Filtered Entries
  const filteredEntries = useMemo(() => {
    if (filterOutcome === "ALL") return journalEntries;
    return journalEntries.filter((e) => e.outcome === filterOutcome);
  }, [journalEntries, filterOutcome]);

  if (!isJournalOpen) return null;

  const handleOutcomeChange = (id: string, outcome: TradeOutcome) => {
    updateTradeOutcome(id, outcome);
    if (audioEnabled) {
      playTradeChime(outcome === "WIN" ? "high" : outcome === "LOSS" ? "low" : "medium");
    }
    addToast(`تم تحديث حالة الصفقة إلى: ${outcome === "WIN" ? "ناجحة (WIN)" : outcome === "LOSS" ? "خاسرة (LOSS)" : "قيد الانتظار"}`, "info");
  };

  // Export to CSV Function
  const exportToCSV = () => {
    if (journalEntries.length === 0) {
      addToast("لا توجد صفقات لتصديرها", "info");
      return;
    }

    const headers = [
      "معرف الصفقة",
      "الرمز",
      "نوع الصفقة",
      "سعر الدخول",
      "وقف الخسارة",
      "الهدف الأول",
      "الهدف الثاني",
      "نسبة العائد للمخاطرة",
      "نسبة الثقة",
      "نتيجة الصفقة",
      "التاريخ والوقت",
      "النموذج المستخدم",
    ];

    const rows = journalEntries.map((e) => [
      e.id,
      e.symbol,
      e.type,
      e.entryPrice,
      e.stopLoss,
      e.takeProfit1,
      e.takeProfit2,
      `"${e.riskRewardRatio}"`,
      `${e.confidenceScore}%`,
      e.outcome,
      new Date(e.timestamp).toLocaleString("ar-SA"),
      `"${e.modelUsed || "AI SMC"}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `nexus_alpha_trades_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast("تم تصدير سجل الصفقات بنجاح بصيغة CSV!", "success");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" dir="rtl">
      <div className="relative w-full max-w-4xl rounded-2xl border border-[#1E293B] bg-[#0F1419] shadow-2xl p-6 text-right overflow-hidden flex flex-col max-h-[85vh]">
        {/* Top Glow */}
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-[#8B5CF6] via-[#06B6D4] to-[#10B981]" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1E293B] mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30">
              <BookOpen className="h-5 w-5 text-[#8B5CF6]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#E2E8F0]">
                سجل الصفقات الذكية وتحليلات الأداء (Trade Journal & Analytics)
              </h2>
              <p className="text-xs text-[#64748B]">
                توثيق آلي لكل التوصيات المولدة ومتابعة نسبة النجاح الحقيقية
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsJournalOpen(false)}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1E293B] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Metrics Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-4 shrink-0">
          <MetricCard
            title="إجمالي التوصيات"
            value={metrics.total.toString()}
            icon={<BarChart2 className="h-4 w-4 text-[#8B5CF6]" />}
            color="text-[#8B5CF6]"
          />
          <MetricCard
            title="نسبة النجاح (Win Rate)"
            value={`${metrics.winRate}%`}
            icon={<Award className="h-4 w-4 text-[#10B981]" />}
            color="text-[#10B981]"
          />
          <MetricCard
            title="صفقات ناجحة"
            value={metrics.wins.toString()}
            icon={<CheckCircle2 className="h-4 w-4 text-[#10B981]" />}
            color="text-[#10B981]"
          />
          <MetricCard
            title="صفقات خاسرة"
            value={metrics.losses.toString()}
            icon={<XCircle className="h-4 w-4 text-[#F43F5E]" />}
            color="text-[#F43F5E]"
          />
          <MetricCard
            title="قيد المتابعة"
            value={metrics.pending.toString()}
            icon={<Clock className="h-4 w-4 text-[#F59E0B]" />}
            color="text-[#F59E0B]"
          />
        </div>

        {/* Action Controls & Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-[#1E293B] shrink-0 text-xs">
          <div className="flex items-center gap-1.5 bg-[#080C14] p-1 rounded-lg border border-[#1E293B]">
            <Filter className="h-3.5 w-3.5 text-[#64748B] mr-1.5" />
            <FilterTab active={filterOutcome === "ALL"} onClick={() => setFilterOutcome("ALL")} label="الكل" />
            <FilterTab active={filterOutcome === "PENDING"} onClick={() => setFilterOutcome("PENDING")} label="قيد الانتظار" />
            <FilterTab active={filterOutcome === "WIN"} onClick={() => setFilterOutcome("WIN")} label="ناجحة" />
            <FilterTab active={filterOutcome === "LOSS"} onClick={() => setFilterOutcome("LOSS")} label="خاسرة" />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={journalEntries.length === 0}
              className="h-8 text-xs gap-1.5"
            >
              <Download className="h-3.5 w-3.5 text-[#06B6D4]" />
              <span>تصدير إلى CSV</span>
            </Button>

            {journalEntries.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm("هل أنت متأكد من رغبتك في مسح سجل الصفقات بالكامل؟")) {
                    clearJournal();
                    addToast("تم مسح السجل بالكامل", "info");
                  }
                }}
                className="h-8 text-xs text-[#F43F5E] hover:bg-[#F43F5E]/10"
              >
                <Trash2 className="h-3.5 w-3.5 ml-1" />
                مسح السجل
              </Button>
            )}
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto rounded-xl border border-[#1E293B] bg-[#080C14]">
          {filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-center text-xs text-[#64748B]">
              <BookOpen className="h-8 w-8 text-[#1E293B]" />
              <p className="font-semibold text-[#E2E8F0]">لا توجد صفقات مسجلة في هذا القسم</p>
              <p>ستظهر هنا تلقائياً أي توصية يولدها محرك الذكاء الاصطناعي (LONG / SHORT / SPOT BUY)</p>
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="sticky top-0 bg-[#0A0F16] text-[#64748B] border-b border-[#1E293B]">
                <tr>
                  <th className="px-3 py-2.5">الرمز والنوع</th>
                  <th className="px-3 py-2.5">سعر الدخول</th>
                  <th className="px-3 py-2.5">وقف الخسارة</th>
                  <th className="px-3 py-2.5">الهدف الأول</th>
                  <th className="px-3 py-2.5">R:R</th>
                  <th className="px-3 py-2.5">الثقة</th>
                  <th className="px-3 py-2.5 text-center">النتيجة الحالية</th>
                  <th className="px-3 py-2.5 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/40">
                {filteredEntries.map((trade) => {
                  const isLong = trade.type === "LONG" || trade.type === "SPOT_BUY";

                  return (
                    <tr key={trade.id} className="hover:bg-[#151C24]/50 transition-colors">
                      {/* Symbol & Type */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#E2E8F0]">{trade.symbol}</span>
                          <Badge
                            variant={isLong ? "bullish" : "bearish"}
                            className="text-[9px] px-1.5 py-0"
                          >
                            {trade.type}
                          </Badge>
                        </div>
                        <span className="text-[10px] text-[#64748B] block mt-0.5">
                          {new Date(trade.timestamp).toLocaleDateString("ar-SA", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>

                      {/* Entry */}
                      <td className="px-3 py-2.5 font-mono font-semibold text-[#E2E8F0]">
                        ${formatPrice(trade.entryPrice)}
                      </td>

                      {/* SL */}
                      <td className="px-3 py-2.5 font-mono text-[#F43F5E]">
                        ${formatPrice(trade.stopLoss)}
                      </td>

                      {/* TP1 */}
                      <td className="px-3 py-2.5 font-mono text-[#10B981]">
                        ${formatPrice(trade.takeProfit1)}
                      </td>

                      {/* R:R */}
                      <td className="px-3 py-2.5 font-mono text-[#8B5CF6]">
                        {trade.riskRewardRatio}
                      </td>

                      {/* Confidence */}
                      <td className="px-3 py-2.5 font-mono text-[#CBD5E1]">
                        {trade.confidenceScore}%
                      </td>

                      {/* Interactive Outcome Selector */}
                      <td className="px-3 py-2.5 text-center">
                        <div className="inline-flex items-center gap-1 bg-[#0F1419] p-1 rounded-lg border border-[#1E293B]">
                          <button
                            onClick={() => handleOutcomeChange(trade.id, "WIN")}
                            title="تحديد كناجحة"
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              trade.outcome === "WIN"
                                ? "bg-[#10B981] text-white shadow"
                                : "text-[#64748B] hover:text-[#10B981]"
                            }`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleOutcomeChange(trade.id, "LOSS")}
                            title="تحديد كخاسرة"
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              trade.outcome === "LOSS"
                                ? "bg-[#F43F5E] text-white shadow"
                                : "text-[#64748B] hover:text-[#F43F5E]"
                            }`}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleOutcomeChange(trade.id, "PENDING")}
                            title="قيد الانتظار"
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              trade.outcome === "PENDING"
                                ? "bg-[#F59E0B] text-black shadow font-bold"
                                : "text-[#64748B] hover:text-[#F59E0B]"
                            }`}
                          >
                            <Clock className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Delete Action */}
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => deleteJournalEntry(trade.id)}
                          className="text-[#64748B] hover:text-[#F43F5E] p-1 rounded transition-colors cursor-pointer"
                          title="حذف من السجل"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-[#080C14] border border-[#1E293B] rounded-xl p-2.5">
      <div className="flex items-center justify-between text-[#64748B] text-[10px] mb-1">
        <span>{title}</span>
        {icon}
      </div>
      <span className={`text-base font-bold font-mono ${color}`}>{value}</span>
    </div>
  );
}

function FilterTab({
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
      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
        active
          ? "bg-[#8B5CF6] text-white"
          : "text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1E293B]"
      }`}
    >
      {label}
    </button>
  );
}
