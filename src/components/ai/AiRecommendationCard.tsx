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
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/store/useDashboardStore";
import { formatPrice } from "@/lib/utils";
import { playTradeChime } from "@/hooks/useAudioAlert";

export function AiRecommendationCard() {
  const { state, runAiAnalysis, saveCurrentSignal } = useDashboardStore();
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
  const isNoTrade = rec.status === "NO_CLEAR_SETUP";

  return (
    <Card
      className={`relative overflow-hidden transition-all duration-300 ${
        isNoTrade
          ? "border-[#F59E0B]/40 bg-gradient-to-b from-[#12161A] to-[#0A0D12]"
          : isLong
            ? "border-[#10B981]/40 bg-gradient-to-b from-[#0F1E19] to-[#0A0D12] shadow-lg shadow-emerald-500/10"
            : "border-[#F43F5E]/40 bg-gradient-to-b from-[#1F1116] to-[#0A0D12] shadow-lg shadow-rose-500/10"
      }`}
    >
      {/* Top Accent Stripe */}
      <div
        className={`h-1 w-full ${
          isNoTrade
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
                isNoTrade
                  ? "bg-[#F59E0B]/20 text-[#F59E0B]"
                  : isLong
                    ? "bg-[#10B981]/20 text-[#10B981]"
                    : "bg-[#F43F5E]/20 text-[#F43F5E]"
              }`}
            >
              {isNoTrade ? (
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
                {isLong && (
                  <Badge variant="bullish" className="text-[10px] font-bold">
                    {rec.status === "SPOT_BUY" ? "تجميع سبوت (SPOT BUY)" : "شراء (LONG)"}
                  </Badge>
                )}
                {isShort && (
                  <Badge variant="bearish" className="text-[10px] font-bold">
                    بيع (SHORT)
                  </Badge>
                )}
                {isNoTrade && (
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
                rec.confidence_score >= 75
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
        {/* BTC Dump Alert if Present */}
        {rec.btc_warning && (
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-[#F43F5E]/15 border border-[#F43F5E]/30 text-xs text-[#F43F5E] font-semibold">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{rec.btc_warning}</span>
          </div>
        )}

        {/* Trade Levels (Only show if clear setup) */}
        {!isNoTrade && (
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
              <span className="text-[10px] text-[#F43F5E] block mb-0.5 font-semibold">وقف الخسارة (SL)</span>
              <span className="text-xs font-mono font-bold text-[#F43F5E]">
                ${formatPrice(rec.stop_loss)}
              </span>
            </div>

            {/* Take Profit 1 */}
            <div className="bg-[#080C14] p-2 rounded-xl border border-[#10B981]/30">
              <span className="text-[10px] text-[#10B981] block mb-0.5 font-semibold">الهدف الأول (TP1)</span>
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
        )}

        {/* Technical Reasoning in Arabic */}
        <div className="bg-[#080C14]/90 p-2.5 rounded-xl border border-[#1E293B]">
          <span className="text-[10px] text-[#8B5CF6] font-bold block mb-1 flex items-center gap-1">
            <Layers className="h-3 w-3" />
            التحليل الفني المؤسساتي (SMC Reasoning):
          </span>
          <p className="text-xs text-[#CBD5E1] leading-relaxed font-sans">
            {rec.reasoning_arabic}
          </p>
        </div>

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
