// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — AI Trade Recommendation Card (SMC & Multi-Timeframe)
// Glassmorphism, Arabic Typography, Risk Sizing Calculator & Status Glows
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React, { useState } from "react";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ShieldCheck,
  Calculator,
  RefreshCw,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Cpu,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  BookmarkPlus,
  Loader2,
  Database,
  Crosshair,
  AlertTriangle,
  Wallet,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/store/useDashboardStore";
import { formatPrice, cn } from "@/lib/utils";
import { playTradeChime } from "@/hooks/useAudioAlert";

export function AiRecommendationCard() {
  const {
    state,
    runAiAnalysis,
    saveCurrentSignal,
    openPaperTrade,
    setIsPaperModalOpen,
  } = useDashboardStore();
  const {
    aiRecommendation: rec,
    isAiAnalyzing,
    isAutoScanning,
    autoScanProgress,
    selectedSymbol,
    audioEnabled,
    isSavingSignal,
  } = state;

  // Risk Calculator State
  const [showRiskCalc, setShowRiskCalc] = useState(false);
  const [portfolioSize, setPortfolioSize] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0); // 1%

  const handleRefreshAnalysis = () => {
    if (audioEnabled) {
      playTradeChime("high");
    }
    runAiAnalysis();
  };

  // Loading / Scanning State
  if (isAiAnalyzing || isAutoScanning) {
    return (
      <Card className="border-[#8B5CF6]/40 bg-[#0F1419]/90 relative overflow-hidden animate-pulse">
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-[#8B5CF6] via-[#06B6D4] to-[#10B981] animate-pulse" />
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center text-center gap-3">
            <div className="relative">
              <RefreshCw className="h-8 w-8 text-[#8B5CF6] animate-spin" />
              <Sparkles className="h-4 w-4 text-[#06B6D4] absolute -top-1 -right-1 animate-ping" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#E2E8F0]">
                {isAutoScanning
                  ? "محرك المسح الشامل AI ALPHA قيد التشغيل..."
                  : `تحليل أصل (${selectedSymbol}) عبر مفاهيم SMC...`}
              </h4>
              <p className="text-xs text-[#64748B] mt-1 font-mono">
                {autoScanProgress || "استخراج كتل الأوامر (OB) والفجوات السعرية (FVG) وتدفق السيولة"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Initial State before first analysis
  if (!rec) {
    return (
      <Card className="border-dashed border-[#8B5CF6]/30 bg-[#0F1419]/80">
        <CardContent className="p-5">
          <div className="flex flex-col items-center justify-center text-center gap-3">
            <div className="p-3 rounded-2xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20">
              <Sparkles className="h-6 w-6 text-[#8B5CF6]" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#E2E8F0]">
                جاهز لتحليل ({selectedSymbol}) بنظام الأموال الذكية (SMC)
              </h4>
              <p className="text-[11px] text-[#64748B] mt-1 max-w-xs leading-relaxed">
                اضغط على الزر أدناه لبدء فحص الفريمات المتعددة وتحديد نقاط الدخول والأهداف وفق قواعد إدارة المخاطر الصارمة.
              </p>
            </div>
            <Button
              variant="scanner"
              size="sm"
              onClick={handleRefreshAnalysis}
              className="mt-1 font-bold text-xs"
            >
              <Cpu className="h-3.5 w-3.5 ml-1.5" />
              بدء التحليل الفوري بالذكاء الاصطناعي
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate Risk Sizing Metrics
  const entry = rec.entry_price || 1;
  const sl = rec.stop_loss || entry * 0.98;
  const stopDistancePct = Math.max(0.1, Math.abs(entry - sl) / entry);
  const dollarRisk = (portfolioSize * riskPercent) / 100;
  const recommendedPositionSize = dollarRisk / stopDistancePct;
  const leverageRatio = Math.min(25, Math.max(1, Math.round(recommendedPositionSize / portfolioSize)));

  const isLong = rec.status === "LONG" || rec.status === "SPOT_BUY";
  const isShort = rec.status === "SHORT";
  const isMarketClosed = rec.status === "MARKET_CLOSED";
  const isNoTrade = rec.status === "NO_CLEAR_SETUP" || isMarketClosed;

  return (
    <Card
      className={`relative overflow-hidden transition-all duration-300 ${
        isMarketClosed
          ? "border-[#F59E0B]/50 bg-gradient-to-b from-[#1C150A] to-[#0A0D12] shadow-lg shadow-amber-500/10"
          : isNoTrade
            ? "border-[#F59E0B]/40 bg-gradient-to-b from-[#12161A] to-[#0A0D12]"
            : isLong
              ? "border-[#10B981]/40 bg-gradient-to-b from-[#0F1E19] to-[#0A0D12] shadow-lg shadow-emerald-500/10"
              : "border-[#F43F5E]/40 bg-gradient-to-b from-[#1F1116] to-[#0A0D12] shadow-lg shadow-rose-500/10"
      }`}
    >
      {/* Top Accent Stripe */}
      <div
        className={`h-1 w-full ${
          isMarketClosed
            ? "bg-gradient-to-r from-[#F59E0B] via-[#F43F5E] to-[#F59E0B]"
            : isNoTrade
              ? "bg-[#F59E0B]"
              : isLong
                ? "bg-[#10B981]"
                : "bg-[#F43F5E]"
        }`}
      />

      <CardHeader className="p-3.5 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-lg ${
                isMarketClosed
                  ? "bg-[#F59E0B]/20 text-[#F59E0B]"
                  : isNoTrade
                    ? "bg-[#F59E0B]/20 text-[#F59E0B]"
                    : isLong
                      ? "bg-[#10B981]/20 text-[#10B981]"
                      : "bg-[#F43F5E]/20 text-[#F43F5E]"
              }`}
            >
              {isMarketClosed ? (
                <AlertTriangle className="h-4 w-4" />
              ) : isNoTrade ? (
                <ShieldAlert className="h-4 w-4" />
              ) : isLong ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#E2E8F0] font-mono">
                  {rec.symbol}
                </span>
                {/* Status Badge */}
                {isMarketClosed && (
                  <Badge variant="warning" className="text-[10px] font-bold bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40 animate-pulse">
                    سوق مغلق (عطلة نهاية الأسبوع)
                  </Badge>
                )}
                {!isMarketClosed && isLong && (
                  <Badge variant="bullish" className="text-[10px] font-bold">
                    {rec.status === "SPOT_BUY" ? "تجميع سبوت (SPOT BUY)" : "شراء (LONG)"}
                  </Badge>
                )}
                {!isMarketClosed && isShort && (
                  <Badge variant="bearish" className="text-[10px] font-bold">
                    بيع (SHORT)
                  </Badge>
                )}
                {!isMarketClosed && isNoTrade && (
                  <Badge variant="warning" className="text-[10px] font-bold animate-pulse">
                    البقاء خارج السوق (STAY IN CASH)
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-[#64748B] flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" />
                <span>توافق الفريمات: {rec.timeframe_confluence}</span>
              </p>
            </div>
          </div>

          {/* Confidence Score */}
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#64748B]">نسبة الثقة:</span>
            <span
              className={`text-sm font-bold font-mono ${
                isMarketClosed
                  ? "text-[#64748B]"
                  : rec.confidence_score >= 75
                    ? "text-[#10B981]"
                    : rec.confidence_score >= 50
                      ? "text-[#F59E0B]"
                      : "text-[#F43F5E]"
              }`}
            >
              {rec.confidence_score}%
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3.5 pt-1 space-y-3">
        {/* Source Provenance Transparency Bar */}
        {rec.ai_source_type === "AI_SUCCESS" ? (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 text-xs">
            <div className="flex items-center gap-1.5 text-[#10B981] font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>تحليل بالذكاء الاصطناعي ({rec.model_used})</span>
            </div>
            {typeof rec.ai_latency_ms === "number" && (
              <span className="font-mono text-[10px] text-[#6EE7B7] px-1.5 py-0.5 rounded bg-black/40">
                استجابة: {rec.ai_latency_ms}ms ⚡
              </span>
            )}
          </div>
        ) : rec.ai_source_type === "FALLBACK_DETERMINISTIC" ? (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/30 text-xs">
            <div className="flex items-center gap-1.5 text-[#60A5FA] font-semibold">
              <Cpu className="h-3.5 w-3.5" />
              <span>تحليل بالمحرك الرياضي الحتمي — لم تُستخدم استجابة AI</span>
            </div>
            <span className="text-[10px] text-[#93C5FD]">
              {rec.ai_error_reason || "توفير الاستهلاك: السوق غير مؤهل"}
            </span>
          </div>
        ) : rec.ai_source_type ? (
          <div className="p-2.5 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-xs space-y-1">
            <div className="flex items-center justify-between text-[#F59E0B] font-bold">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>تحليل بالمحرك الحتمي — تعذّر تحليل AI</span>
              </div>
              <Badge variant="warning" className="text-[9px] px-1.5 py-0">
                بديل رياضي داخلي
              </Badge>
            </div>
            <p className="text-[11px] text-[#CBD5E1] mr-5">
              {rec.ai_error_reason || "حدث خطأ في الاتصال بالذكاء الاصطناعي، والنتيجة الحالية مبنية بالكامل على التحليل الرياضي الداخلي."}
            </p>
          </div>
        ) : null}

        {/* Market Closed Banner Notice */}
        {isMarketClosed && (
          <div className="p-3 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-[#F59E0B]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>تنبيه حارس عطلة السوق (Market Guard):</span>
            </div>
            <p className="text-[11px] text-[#CBD5E1] leading-relaxed">
              {rec.reasoning_arabic}
            </p>
          </div>
        )}

        {/* BTC Dump Alert if Present */}
        {!isMarketClosed && rec.btc_warning && (
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-[#F43F5E]/15 border border-[#F43F5E]/30 text-xs text-[#F43F5E] font-semibold">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{rec.btc_warning}</span>
          </div>
        )}

        {/* ── NO_CLEAR_SETUP: Institutional "Stay in Cash" Amber Card ── */}
        {!isMarketClosed && rec.status === "NO_CLEAR_SETUP" && (
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#F59E0B]/15 via-[#1E190E] to-[#0A0D12] border border-[#F59E0B]/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#F59E0B]/20 text-[#F59E0B]">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#F59E0B] block">
                    قرار مدير المخاطر: البقاء كاش خارج السوق (STAY IN CASH)
                  </span>
                  <span className="text-[10px] text-[#94A3B8]">
                    حماية رأس المال — السوق في حالة تشتت أو سيولة غير مؤكدة
                  </span>
                </div>
              </div>
              <Badge variant="warning" className="text-[10px] font-bold">
                عدم تداول
              </Badge>
            </div>

            {/* Quantitative Diagnostics Matrix */}
            {rec.quant_matrix && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#080C14]/90 p-2.5 rounded-lg border border-[#1E293B] text-[11px] font-mono">
                <div>
                  <span className="text-[#64748B] text-[9px] block">الاتجاه (1H Trend):</span>
                  <span
                    className={`font-bold ${
                      rec.quant_matrix.trend === "STRONG_BULLISH"
                        ? "text-[#10B981]"
                        : rec.quant_matrix.trend === "STRONG_BEARISH"
                          ? "text-[#F43F5E]"
                          : "text-[#F59E0B]"
                    }`}
                  >
                    {rec.quant_matrix.trend === "STRONG_BULLISH"
                      ? "صاعد قوي ↗"
                      : rec.quant_matrix.trend === "STRONG_BEARISH"
                        ? "هابط قوي ↘"
                        : "عرضي متذبذب ↔"}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] text-[9px] block">حجم السيولة (RVOL):</span>
                  <span
                    className={`font-bold ${
                      rec.quant_matrix.rvol >= 1.2 ? "text-[#10B981]" : "text-[#F43F5E]"
                    }`}
                  >
                    {rec.quant_matrix.rvol.toFixed(2)}x {rec.quant_matrix.rvol < 1.2 ? "(ضعيف)" : "(مؤكد)"}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] text-[9px] block">تقلب الـ ATR (15M):</span>
                  <span className="text-[#06B6D4] font-bold">
                    ${formatPrice(rec.quant_matrix.atr14)}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] text-[9px] block">نطاق السوينغ (20 شمعة):</span>
                  <span className="text-[#E2E8F0] font-bold">
                    ${formatPrice(rec.quant_matrix.lowestLow20)} - ${formatPrice(rec.quant_matrix.highestHigh20)}
                  </span>
                </div>
              </div>
            )}

            {/* Detailed Arabic Rejection Reasoning */}
            <div className="p-2.5 rounded-lg bg-[#080C14]/80 border border-[#F59E0B]/20 text-xs">
              <span className="text-[10px] text-[#F59E0B] font-bold block mb-1">
                سبب الامتناع المؤسساتي عن الدخول:
              </span>
              <p className="text-[#E2E8F0] text-[11px] leading-relaxed">
                {rec.reasoning_arabic}
              </p>
            </div>

            {/* Interactive Scenario Plan Card (خطة التحرك القادمة) */}
            {rec.scenario_plan && (
              <div className="p-3 rounded-xl bg-[#0F172A]/80 border border-[#8B5CF6]/40 shadow-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#A78BFA]">
                    <Target className="h-4 w-4 text-[#8B5CF6]" />
                    <span>خطة التحرك القادمة (Scenario Plan):</span>
                  </div>
                  <Badge
                    className={cn(
                      "text-[10px] px-2 py-0.5 font-bold border",
                      rec.scenario_plan.market_bias === "صاعد منتظر"
                        ? "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30"
                        : rec.scenario_plan.market_bias === "هابط منتظر"
                        ? "bg-[#F43F5E]/15 text-[#F43F5E] border-[#F43F5E]/30"
                        : "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30",
                    )}
                  >
                    {rec.scenario_plan.market_bias}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-[#080C14] p-2 rounded-lg border border-[#1E293B]">
                    <span className="text-[10px] text-[#64748B] block">مستوى اختراق القمة:</span>
                    <span className="text-[#10B981] font-bold">
                      ${formatPrice(rec.scenario_plan.trigger_breakout_high)}
                    </span>
                  </div>
                  <div className="bg-[#080C14] p-2 rounded-lg border border-[#1E293B]">
                    <span className="text-[10px] text-[#64748B] block">مستوى كسر القاع:</span>
                    <span className="text-[#F43F5E] font-bold">
                      ${formatPrice(rec.scenario_plan.trigger_breakout_low)}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-[#CBD5E1] bg-[#080C14]/60 p-2 rounded-lg border border-[#1E293B]/60 leading-relaxed">
                  {rec.scenario_plan.next_action_arabic}
                </p>
              </div>
            )}

            {/* Conditional Triggers & Action Plan (خطة الدخول المشروطة) */}
            {rec.conditional_trigger && (
              <div className="p-3 rounded-xl bg-[#0B0F19] border border-[#3B82F6]/30 shadow-lg space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#60A5FA]">
                    <Crosshair className="h-4 w-4 text-[#3B82F6]" />
                    <span>خطة وسيناريوهات الدخول المشروطة (Trigger Plan):</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-[#1E293B] text-[#94A3B8]">
                    {rec.conditional_trigger.expected_bias === "BULLISH_BREAKOUT"
                      ? "ميول صعودي بعد كسر المقاومة"
                      : rec.conditional_trigger.expected_bias === "BEARISH_BREAKDOWN"
                      ? "ميول هبوطي بعد كسر الدعم"
                      : "نطاق عرضي محايد"}
                  </span>
                </div>

                <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                  {rec.conditional_trigger.summary_arabic}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono">
                  {/* Bullish Trigger Scenario */}
                  <div className="bg-[#0D1524] p-2.5 rounded-lg border border-[#10B981]/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-[#10B981]">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        <span>سيناريو الشراء (LONG)</span>
                      </div>
                      <Badge className="bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30 text-[9px] px-1.5 py-0">
                        كسر القمة
                      </Badge>
                    </div>
                    <div className="text-[10px] space-y-1 text-[#CBD5E1]">
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">شرط التفعيل:</span>
                        <span className="font-bold text-[#E2E8F0]">
                          ${formatPrice(rec.conditional_trigger.bullish_trigger.price)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">الهدف المتوقع:</span>
                        <span className="font-bold text-[#10B981]">
                          ${formatPrice(rec.conditional_trigger.bullish_trigger.target)}
                        </span>
                      </div>
                      <div className="text-[9px] text-[#94A3B8] pt-1 border-t border-[#1E293B] leading-tight">
                        {rec.conditional_trigger.bullish_trigger.condition}
                      </div>
                    </div>
                  </div>

                  {/* Bearish Trigger Scenario */}
                  <div className="bg-[#1A0F17] p-2.5 rounded-lg border border-[#F43F5E]/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-[#F43F5E]">
                        <ArrowDownRight className="h-3.5 w-3.5" />
                        <span>سيناريو البيع (SHORT)</span>
                      </div>
                      <Badge className="bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/30 text-[9px] px-1.5 py-0">
                        كسر القاع
                      </Badge>
                    </div>
                    <div className="text-[10px] space-y-1 text-[#CBD5E1]">
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">شرط التفعيل:</span>
                        <span className="font-bold text-[#E2E8F0]">
                          ${formatPrice(rec.conditional_trigger.bearish_trigger.price)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">الهدف المتوقع:</span>
                        <span className="font-bold text-[#F43F5E]">
                          ${formatPrice(rec.conditional_trigger.bearish_trigger.target)}
                        </span>
                      </div>
                      <div className="text-[9px] text-[#94A3B8] pt-1 border-t border-[#1E293B] leading-tight">
                        {rec.conditional_trigger.bearish_trigger.condition}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[10px] text-[#94A3B8] bg-[#0A0D12] p-2 rounded-lg border border-[#1E293B]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#10B981] shrink-0" />
              <span>القاعدة الذهبية: في 80% - 90% من ظروف السوق، الامتناع عن التداول هو العامل الأساسي لنمو المحفظة.</span>
            </div>
          </div>
        )}

        {/* Trade Levels (Only show if clear setup) */}
        {!isNoTrade && (
          <div className="space-y-2">
            {/* Quantitative Indicator Pills */}
            {rec.quant_matrix && (
              <div className="flex items-center justify-between bg-[#080C14] px-2.5 py-1.5 rounded-lg border border-[#1E293B] text-[10px] font-mono">
                <span className="text-[#64748B]">
                  الاتجاه:{" "}
                  <strong className={rec.quant_matrix.trend === "STRONG_BULLISH" ? "text-[#10B981]" : "text-[#F43F5E]"}>
                    {rec.quant_matrix.trend}
                  </strong>
                </span>
                <span className="text-[#64748B]">
                  RVOL: <strong className="text-[#10B981]">{rec.quant_matrix.rvol.toFixed(2)}x</strong>
                </span>
                <span className="text-[#64748B]">
                  ATR: <strong className="text-[#06B6D4]">${formatPrice(rec.quant_matrix.atr14)}</strong>
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Entry Price */}
              <div className="bg-[#080C14] p-2 rounded-xl border border-[#1E293B]">
                <span className="text-[10px] text-[#64748B] block mb-0.5">سعر الدخول المقترح</span>
                <span className="text-xs font-mono font-bold text-[#E2E8F0]">
                  ${formatPrice(rec.entry_price)}
                </span>
              </div>

              {/* Stop Loss */}
              <div className="bg-[#080C14] p-2 rounded-xl border border-[#F43F5E]/30">
                <span className="text-[10px] text-[#F43F5E] block mb-0.5 font-semibold">وقف الخسارة (1.5*ATR)</span>
                <span className="text-xs font-mono font-bold text-[#F43F5E]">
                  ${formatPrice(rec.stop_loss)}
                </span>
              </div>

              {/* Take Profit 1 */}
              <div className="bg-[#080C14] p-2 rounded-xl border border-[#10B981]/30">
                <span className="text-[10px] text-[#10B981] block mb-0.5 font-semibold">الهدف الأول (2.0*ATR)</span>
                <span className="text-xs font-mono font-bold text-[#10B981]">
                  ${formatPrice(rec.take_profit_1)}
                </span>
              </div>

              {/* Risk/Reward */}
              <div className="bg-[#080C14] p-2 rounded-xl border border-[#8B5CF6]/30">
                <span className="text-[10px] text-[#8B5CF6] block mb-0.5 font-semibold">العائد للمخاطرة (R:R)</span>
                <span className="text-xs font-mono font-bold text-[#8B5CF6]">
                  {rec.risk_reward_ratio}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Technical Reasoning in Arabic */}
        {!isNoTrade && (
          <div className="bg-[#080C14]/90 p-2.5 rounded-xl border border-[#1E293B]">
            <span className="text-[10px] text-[#8B5CF6] font-bold block mb-1 flex items-center gap-1">
              <Layers className="h-3 w-3" />
              التحليل الفني المؤسساتي (Quantitative Reasoning):
            </span>
            <p className="text-xs text-[#CBD5E1] leading-relaxed font-sans">
              {rec.reasoning_arabic}
            </p>
          </div>
        )}

        {/* 🎯 Bullet Strategy Section (استراتيجية بولت) */}
        {rec.bullet_signal && (
          <div className="bg-[#080C14]/90 p-2.5 rounded-xl border border-[#8B5CF6]/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Crosshair className="h-3.5 w-3.5 text-[#8B5CF6]" />
                <span className="text-xs font-bold text-[#E2E8F0]">
                  استراتيجية بولت (Bullet Strategy)
                </span>
              </div>
              {rec.bullet_signal.direction === "LONG" && (
                <Badge variant="bullish" className="text-[10px] font-bold">
                  🎯 شراء بولت (LONG)
                </Badge>
              )}
              {rec.bullet_signal.direction === "SHORT" && (
                <Badge variant="bearish" className="text-[10px] font-bold">
                  🎯 بيع بولت (SHORT)
                </Badge>
              )}
              {rec.bullet_signal.direction === "NONE" && (
                <Badge variant="default" className="text-[10px] font-mono text-[#64748B]">
                  لا يوجد نموذج (NO SETUP)
                </Badge>
              )}
            </div>

            {rec.bullet_signal.metrics && (
              <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono bg-[#0F1419] p-2 rounded-lg border border-[#1E293B]">
                <div>
                  <span className="text-[#64748B] block text-[9px]">قناة EMA21</span>
                  <span className="text-[#06B6D4] font-bold">
                    ${formatPrice(rec.bullet_signal.metrics.ema21_low)} - ${formatPrice(rec.bullet_signal.metrics.ema21_high)}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[9px]">متوسط EMA144</span>
                  <span className="text-[#F59E0B] font-bold">
                    ${formatPrice(rec.bullet_signal.metrics.ema144)}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[9px]">تقاطع MACD</span>
                  <span
                    className={`font-bold ${
                      rec.bullet_signal.metrics.macdCross === "BULLISH"
                        ? "text-[#10B981]"
                        : rec.bullet_signal.metrics.macdCross === "BEARISH"
                          ? "text-[#F43F5E]"
                          : "text-[#64748B]"
                    }`}
                  >
                    {rec.bullet_signal.metrics.macdCross === "BULLISH"
                      ? "إيجابي ↗"
                      : rec.bullet_signal.metrics.macdCross === "BEARISH"
                        ? "سلبي ↘"
                        : "محايد ↔"}
                  </span>
                </div>
              </div>
            )}

            {rec.bullet_signal.targetPrice && rec.bullet_signal.status === "VALID" && (
              <div className="flex items-center justify-between text-[11px] px-1 text-[#CBD5E1]">
                <span>الهدف المحسوب (EMA144 / Swing):</span>
                <span className="font-mono font-bold text-[#10B981]">
                  ${formatPrice(rec.bullet_signal.targetPrice)}
                </span>
              </div>
            )}

            {rec.bullet_signal.reasoning_arabic && (
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                {rec.bullet_signal.reasoning_arabic}
              </p>
            )}
          </div>
        )}

        {/* 🚀 Paper Trading Execution Action Button */}
        {!isNoTrade && (
          <div className="flex items-center gap-2">
            <Button
              variant="scanner"
              size="sm"
              onClick={() => openPaperTrade(rec, 1000)}
              className="flex-1 font-bold text-xs py-2 bg-[#10B981] hover:bg-[#059669] text-white shadow-md shadow-emerald-500/20 cursor-pointer gap-1.5"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>تنفيذ صفقة تجريبية ($1,000 Paper Trade)</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPaperModalOpen(true)}
              className="h-8 px-2.5 text-xs text-[#10B981] border-[#10B981]/40 hover:bg-[#10B981]/10 cursor-pointer"
              title="عرض محفظة التداول التجريبي"
            >
              المحفظة
            </Button>
          </div>
        )}

        {/* 📌 Save Signal Action Button */}
        {!isNoTrade && (
          <Button
            variant="scanner"
            size="sm"
            onClick={saveCurrentSignal}
            disabled={isSavingSignal}
            className="w-full font-bold text-xs py-2 shadow-md shadow-violet-500/20 cursor-pointer"
          >
            {isSavingSignal ? (
              <>
                <Loader2 className="h-3.5 w-3.5 ml-2 animate-spin" />
                جارٍ حفظ التوصية في Supabase...
              </>
            ) : (
              <>
                <BookmarkPlus className="h-3.5 w-3.5 ml-2" />
                📌 حفظ التوصية في قاعدة البيانات
              </>
            )}
          </Button>
        )}

        {/* Risk Management & Position Sizing Calculator Toggle */}
        {!isNoTrade && (
          <div className="border-t border-[#1E293B]/60 pt-2">
            <button
              onClick={() => setShowRiskCalc(!showRiskCalc)}
              className="w-full flex items-center justify-between text-xs font-semibold text-[#64748B] hover:text-[#E2E8F0] transition-colors py-1 cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-[#06B6D4]">
                <Calculator className="h-3.5 w-3.5" />
                <span>حاسبة حجم العقد وإدارة المخاطر (Position Sizing)</span>
              </div>
              {showRiskCalc ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showRiskCalc && (
              <div className="mt-2.5 p-3 rounded-xl bg-[#080C14] border border-[#1E293B] space-y-2.5 animate-fade-in text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#64748B] block mb-1">
                      حجم المحفظة الكلي ($):
                    </label>
                    <input
                      type="number"
                      value={portfolioSize}
                      onChange={(e) => setPortfolioSize(Math.max(10, parseFloat(e.target.value) || 0))}
                      className="w-full bg-[#0F1419] border border-[#1E293B] rounded-lg px-2.5 py-1 text-xs font-mono text-[#E2E8F0]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#64748B] block mb-1">
                      نسبة المخاطرة المقبولة (%):
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={riskPercent}
                      onChange={(e) => setRiskPercent(Math.max(0.1, parseFloat(e.target.value) || 0))}
                      className="w-full bg-[#0F1419] border border-[#1E293B] rounded-lg px-2.5 py-1 text-xs font-mono text-[#E2E8F0]"
                    />
                  </div>
                </div>

                {/* Sizing Recommendations */}
                <div className="p-2 rounded-lg bg-[#0F1419] border border-[#1E293B] flex items-center justify-between text-[11px]">
                  <div>
                    <span className="text-[#64748B] block">المبلغ المعرض للمخاطرة:</span>
                    <span className="text-[#F43F5E] font-bold font-mono">${dollarRisk.toFixed(0)}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block">حجم المركز الموصى به:</span>
                    <span className="text-[#10B981] font-bold font-mono">${recommendedPositionSize.toFixed(0)}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block">الرافعة المقترحة:</span>
                    <span className="text-[#8B5CF6] font-bold font-mono">{leverageRatio}x</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Card Footer: Model Badge & Refresh Button */}
        <div className="flex items-center justify-between pt-1 border-t border-[#1E293B]/40 text-[10px] text-[#64748B]">
          <div className="flex items-center gap-1.5 font-mono">
            <Cpu className="h-3 w-3 text-[#8B5CF6]" />
            <span>{rec.model_used || "SMC AI Engine"}</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshAnalysis}
            className="h-6 px-2 text-[10px] text-[#64748B] hover:text-[#E2E8F0]"
          >
            <RefreshCw className="h-3 w-3 ml-1" />
            إعادة التحليل
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
