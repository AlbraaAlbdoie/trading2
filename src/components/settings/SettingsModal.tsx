// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Settings Modal / Drawer
// Manage AI Providers, Models, and Secure API Keys with localStorage persistence
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Key,
  Eye,
  EyeOff,
  Check,
  Cpu,
  ShieldCheck,
  Sparkles,
  RotateCcw,
  Bell,
  BellRing,
  Send,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDashboardStore } from "@/store/useDashboardStore";
import { AI_MODELS, DEFAULT_API_KEYS } from "@/lib/constants";
import { playTradeChime } from "@/hooks/useAudioAlert";
import { testTelegramConnection } from "@/lib/telegram";
import type { AiModelOption, ApiSettingsConfig } from "@/lib/types";

export function SettingsModal() {
  const {
    state,
    setIsSettingsOpen,
    setApiSettings,
    addToast,
    triggerTestSignalPipeline,
    testAiConnection,
  } = useDashboardStore();
  const {
    isSettingsOpen,
    apiSettings,
    audioEnabled,
    lastAiTestResult,
    isTestingAiConnection,
  } = state;

  const [formData, setFormData] = useState<ApiSettingsConfig>(() => {
    return {
      ...DEFAULT_API_KEYS,
      ...apiSettings,
      telegramBotToken:
        apiSettings.telegramBotToken ||
        (typeof window !== "undefined"
          ? localStorage.getItem("telegram_bot_token") || DEFAULT_API_KEYS.telegramBotToken
          : DEFAULT_API_KEYS.telegramBotToken),
      telegramChatId:
        apiSettings.telegramChatId ||
        (typeof window !== "undefined"
          ? localStorage.getItem("telegram_chat_id") || DEFAULT_API_KEYS.telegramChatId
          : DEFAULT_API_KEYS.telegramChatId),
    };
  });

  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({
    gemini: false,
    groq: false,
    openRouter: false,
    gold: false,
    telegramToken: false,
  });
  const [isSaved, setIsSaved] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);

  if (!isSettingsOpen) return null;

  const handleTestAi = async () => {
    let currentKey = formData.geminiKey;
    if (formData.selectedModel.startsWith("groq")) {
      currentKey = formData.groqKey;
    } else if (
      formData.selectedModel === "claude-3.5-sonnet" ||
      formData.selectedModel === "gpt-4o"
    ) {
      currentKey = formData.openRouterKey;
    }

    await testAiConnection(currentKey, formData.selectedModel);
  };

  const toggleShow = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTestTelegram = async () => {
    const token = formData.telegramBotToken?.trim() || "";
    const chat = formData.telegramChatId?.trim() || "";

    if (!token || !chat) {
      addToast("يرجى إدخال رمز بوت تليجرام ومعرف المحادثة أولاً ⚠️", "error");
      return;
    }

    setIsTestingTelegram(true);
    try {
      const result = await testTelegramConnection(token, chat);
      if (result.success) {
        addToast("✅ تم إرسال رسالة الاختبار بنجاح إلى حسابك في تليجرام!", "success");
        if (audioEnabled) {
          playTradeChime("high");
        }
      } else {
        addToast(`❌ تعذر إرسال رسالة تليجرام: ${result.error || "تحقق من صحة الرمز والمعرف"}`, "error");
      }
    } catch (err) {
      addToast("حدث خطأ أثناء فحص اتصال تليجرام", "error");
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleSave = () => {
    setApiSettings(formData);
    try {
      if (formData.telegramBotToken) {
        localStorage.setItem("telegram_bot_token", formData.telegramBotToken);
      }
      if (formData.telegramChatId) {
        localStorage.setItem("telegram_chat_id", formData.telegramChatId);
      }
    } catch {}

    setIsSaved(true);
    if (audioEnabled) {
      playTradeChime("high");
    }
    setTimeout(() => {
      setIsSaved(false);
      setIsSettingsOpen(false);
    }, 800);
  };

  const handleResetDefaults = () => {
    setFormData(DEFAULT_API_KEYS);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
      <div
        className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-[#1E293B] bg-[#0F1419] shadow-2xl p-4 sm:p-6 text-right overflow-hidden"
        dir="rtl"
      >
        {/* Glow accent */}
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-[#8B5CF6] via-[#06B6D4] to-[#10B981]" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-[#1E293B] mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/20">
              <Key className="h-5 w-5 text-[#8B5CF6]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#E2E8F0]">
                إعدادات محرك الذكاء الاصطناعي ومفاتيح الـ API
              </h2>
              <p className="text-xs text-[#64748B]">
                تخصيص المفاتيح ومزود الذكاء الاصطناعي المباشر للتحليلات
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1E293B] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Model Selector */}
        <div className="space-y-4 flex-1 overflow-y-auto px-1 py-1">
          <div>
            <label className="block text-xs font-semibold text-[#E2E8F0] mb-2 flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-[#06B6D4]" />
              نموذج الذكاء الاصطناعي الافتراضي للتحليل الفوري:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AI_MODELS.map((model) => {
                const isSelected = formData.selectedModel === model.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        selectedModel: model.id,
                      }))
                    }
                    className={`flex flex-col text-right p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#8B5CF6]/15 border-[#8B5CF6] text-white shadow-md shadow-violet-500/20"
                        : "bg-[#080C14] border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-[#E2E8F0]"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold">{model.name}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-[#8B5CF6]" />}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#64748B]">
                      <span>{model.provider}</span>
                      <span className="text-[#8B5CF6] font-medium">{model.tag}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Real AI Connection Test Diagnostic Panel */}
            <div className="p-3 rounded-xl bg-[#080C14] border border-[#8B5CF6]/30 space-y-2 mt-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#E2E8F0]">
                  <Sparkles className="h-4 w-4 text-[#8B5CF6]" />
                  <span>فحص اتصال نموذج الذكاء الاصطناعي الفعلي</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={handleTestAi}
                  disabled={isTestingAiConnection}
                  className="h-7 px-3 text-xs border-[#8B5CF6]/50 text-[#C4B5FD] hover:bg-[#8B5CF6]/20 hover:border-[#8B5CF6] font-semibold gap-1.5 cursor-pointer"
                >
                  {isTestingAiConnection ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8B5CF6]" />
                      <span>جارٍ قياس الاستجابة...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-[#8B5CF6]" />
                      <span>اختبار الاتصال (Test Connection)</span>
                    </>
                  )}
                </Button>
              </div>

              {lastAiTestResult && (
                <div
                  className={`p-2.5 rounded-lg border text-xs font-mono transition-all ${
                    lastAiTestResult.ok
                      ? "bg-[#10B981]/10 border-[#10B981]/40 text-[#10B981]"
                      : lastAiTestResult.status === "RATE_LIMIT" || lastAiTestResult.status === "QUOTA_EXCEEDED"
                      ? "bg-[#F59E0B]/10 border-[#F59E0B]/40 text-[#F59E0B]"
                      : "bg-[#F43F5E]/10 border-[#F43F5E]/40 text-[#F43F5E]"
                  }`}
                >
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span>{lastAiTestResult.messageArabic}</span>
                    {lastAiTestResult.latencyMs > 0 && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-black/40">
                        ⚡ {lastAiTestResult.latencyMs}ms
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#94A3B8] pt-1 border-t border-white/10 font-sans">
                    <span>المزود: {lastAiTestResult.provider} ({lastAiTestResult.model})</span>
                    <span>{lastAiTestResult.balanceInfo}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* API Keys Inputs */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-semibold text-[#64748B] flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
              مفاتيح التزويد (مشفرة ومحفوظة محلياً في متصفحك):
            </h3>

            {/* Google Gemini */}
            <ApiKeyField
              label="Google Gemini API Key"
              provider="Google AI Studio (Gemini 2.0 Flash)"
              value={formData.geminiKey}
              show={showKeys.gemini}
              onToggleShow={() => toggleShow("gemini")}
              onChange={(val) => setFormData((prev) => ({ ...prev, geminiKey: val }))}
            />

            {/* Groq API */}
            <ApiKeyField
              label="Groq Cloud API Key"
              provider="Groq Llama 3.3 (فائق السرعة)"
              value={formData.groqKey}
              show={showKeys.groq}
              onToggleShow={() => toggleShow("groq")}
              onChange={(val) => setFormData((prev) => ({ ...prev, groqKey: val }))}
            />

            {/* OpenRouter API */}
            <ApiKeyField
              label="OpenRouter API Key"
              provider="Claude 3.5 Sonnet / GPT-4o"
              value={formData.openRouterKey}
              show={showKeys.openRouter}
              onToggleShow={() => toggleShow("openRouter")}
              onChange={(val) => setFormData((prev) => ({ ...prev, openRouterKey: val }))}
            />

            {/* Gold API */}
            <ApiKeyField
              label="Gold Data API Key (XAU/USD)"
              provider="موجز أسعار الذهب الفوري"
              value={formData.goldKey}
              show={showKeys.gold}
              onToggleShow={() => toggleShow("gold")}
              onChange={(val) => setFormData((prev) => ({ ...prev, goldKey: val }))}
            />

            {/* Telegram Bot Integration Section */}
            <div className="bg-[#080C14] p-3 rounded-xl border border-[#06B6D4]/30 space-y-2.5 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#22D3EE]">
                  <Send className="h-4 w-4 text-[#06B6D4]" />
                  <span>تنبيهات بوت تليجرام الفورية (Telegram Bot):</span>
                </div>
                <Badge className="bg-[#06B6D4]/15 text-[#22D3EE] border-[#06B6D4]/30 text-[10px]">
                  إشارات حية
                </Badge>
              </div>

              {/* Bot Token Field */}
              <ApiKeyField
                label="رمز بوت تليجرام (Telegram Bot Token)"
                provider="BotFather API Token"
                value={formData.telegramBotToken || ""}
                show={showKeys.telegramToken}
                onToggleShow={() => toggleShow("telegramToken")}
                onChange={(val) => {
                  setFormData((prev) => ({ ...prev, telegramBotToken: val }));
                  try {
                    localStorage.setItem("telegram_bot_token", val);
                  } catch {}
                }}
              />

              {/* Chat ID Field */}
              <div className="bg-[#080C14] p-2.5 rounded-xl border border-[#1E293B]">
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <span className="font-semibold text-[#E2E8F0]">معرف المحادثة (Telegram Chat ID)</span>
                  <span className="text-[10px] text-[#64748B] font-mono">User/Channel ID</span>
                </div>
                <input
                  type="text"
                  value={formData.telegramChatId || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => ({ ...prev, telegramChatId: val }));
                    try {
                      localStorage.setItem("telegram_chat_id", val);
                    } catch {}
                  }}
                  placeholder="مثال: 1646239738"
                  className="w-full bg-[#0F1419] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-[#E2E8F0] font-mono focus:border-[#06B6D4] focus:outline-none"
                />
              </div>

              {/* Test Telegram Connection Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isTestingTelegram}
                onClick={handleTestTelegram}
                className="w-full h-9 bg-[#06B6D4]/10 hover:bg-[#06B6D4]/20 border-[#06B6D4]/40 text-[#22D3EE] hover:text-[#67E8F9] font-bold text-xs gap-2 transition-all cursor-pointer shadow-md"
              >
                {isTestingTelegram ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#06B6D4]" />
                ) : (
                  <Send className="h-4 w-4 text-[#06B6D4]" />
                )}
                <span>🧪 اختبار اتصال بوت تليجرام (Test Connection)</span>
              </Button>
            </div>

            {/* Notification & Audio Pipeline Diagnostic Section */}
            <div className="bg-[#080C14] p-3 rounded-xl border border-[#3B82F6]/30 space-y-2.5 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#60A5FA]">
                  <BellRing className="h-4 w-4 text-[#3B82F6]" />
                  <span>فحص دورة الإشعارات والتنبيه الصوتي وقاعدة البيانات:</span>
                </div>
                <Badge className="bg-[#3B82F6]/15 text-[#60A5FA] border-[#3B82F6]/30 text-[10px]">
                  أداة فحص تجريبية
                </Badge>
              </div>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                اضغط على الزر أدناه لتجربة طلب إذن الإشعارات، تشغيل نغمة الصفقات، إرسال إشعار فوري لسطح المكتب / الهاتف (SOLUSDT 90%)، وحفظ الصفقة التجريبية في Supabase فوراً.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={triggerTestSignalPipeline}
                className="w-full h-9 bg-[#1E293B]/40 hover:bg-[#3B82F6]/20 border-[#3B82F6]/50 text-[#60A5FA] hover:text-[#93C5FD] font-bold text-xs gap-2 transition-all cursor-pointer shadow-md"
              >
                <Bell className="h-4 w-4 text-[#3B82F6] animate-pulse" />
                <span>🔔 اختبار الإشعار والصوت (Test Notification)</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between pt-3 sm:pt-4 mt-3 border-t border-[#1E293B] gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetDefaults}
            className="text-xs text-[#64748B] hover:text-[#E2E8F0] justify-center"
          >
            <RotateCcw className="h-3.5 w-3.5 ml-1.5" />
            استعادة الافتراضي
          </Button>

          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsOpen(false)}
              className="text-xs"
            >
              إلغاء
            </Button>
            <Button
              variant="scanner"
              size="sm"
              onClick={handleSave}
              className="text-xs px-5"
            >
              {isSaved ? (
                <>
                  <Check className="h-3.5 w-3.5 ml-1.5" />
                  تم الحفظ بنجاح!
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 ml-1.5" />
                  حفظ الإعدادات
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiKeyField({
  label,
  provider,
  value,
  show,
  onToggleShow,
  onChange,
}: {
  label: string;
  provider: string;
  value: string;
  show: boolean;
  onToggleShow: () => void;
  onChange: (val: string) => void;
}) {
  return (
    <div className="bg-[#080C14] p-2.5 rounded-xl border border-[#1E293B]">
      <div className="flex items-center justify-between mb-1.5 text-xs">
        <span className="font-semibold text-[#E2E8F0]">{label}</span>
        <span className="text-[10px] text-[#64748B] font-mono">{provider}</span>
      </div>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="أدخل المفتاح هنا..."
          className="w-full bg-[#0F1419] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-[#E2E8F0] font-mono pl-9 focus:border-[#8B5CF6] focus:outline-none"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#E2E8F0] transition-colors cursor-pointer"
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
