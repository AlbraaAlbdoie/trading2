// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Settings Modal / Drawer
// Manage AI Providers, Models, and Secure API Keys with localStorage persistence
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDashboardStore } from "@/store/useDashboardStore";
import { AI_MODELS, DEFAULT_API_KEYS } from "@/lib/constants";
import { playTradeChime } from "@/hooks/useAudioAlert";
import type { AiModelOption, ApiSettingsConfig } from "@/lib/types";

export function SettingsModal() {
  const { state, setIsSettingsOpen, setApiSettings } = useDashboardStore();
  const { isSettingsOpen, apiSettings, audioEnabled } = state;

  const [formData, setFormData] = useState<ApiSettingsConfig>(apiSettings);
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({
    gemini: false,
    groq: false,
    openRouter: false,
    gold: false,
  });
  const [isSaved, setIsSaved] = useState(false);

  if (!isSettingsOpen) return null;

  const toggleShow = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    setApiSettings(formData);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div
        className="relative w-full max-w-xl rounded-2xl border border-[#1E293B] bg-[#0F1419] shadow-2xl p-6 text-right overflow-hidden"
        dir="rtl"
      >
        {/* Glow accent */}
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-[#8B5CF6] via-[#06B6D4] to-[#10B981]" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1E293B] mb-5">
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
        <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
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
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-5 mt-4 border-t border-[#1E293B]">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetDefaults}
            className="text-xs text-[#64748B] hover:text-[#E2E8F0]"
          >
            <RotateCcw className="h-3.5 w-3.5 ml-1.5" />
            استعادة الافتراضي
          </Button>

          <div className="flex items-center gap-2">
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
