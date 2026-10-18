// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Supabase Authentication Modal (Arabic RTL)
// Sleek Cyberpunk Dark Theme, Email & Password Auth, Sign In & Sign Up
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React, { useState } from "react";
import {
  X,
  Lock,
  Mail,
  KeyRound,
  ShieldCheck,
  Loader2,
  LogIn,
  UserPlus,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboardStore } from "@/store/useDashboardStore";
import { supabase } from "@/lib/supabase";
import { playTradeChime } from "@/hooks/useAudioAlert";

export function AuthModal() {
  const { state, setIsAuthModalOpen, addToast } = useDashboardStore();
  const { isAuthModalOpen, audioEnabled } = state;

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg("يرجى إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("كلمة المرور يجب أن لا تقل عن 6 أحرف");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setErrorMsg(
            error.message.includes("Invalid login credentials")
              ? "بيانات الدخول غير صحيحة، يرجى التأكد من البريد وكلمة المرور"
              : error.message,
          );
        } else {
          if (audioEnabled) {
            playTradeChime("high");
          }
          addToast("تم تسجيل الدخول بنجاح! أهلاً بك في NEXUS ALPHA 🚀", "success");
          setIsAuthModalOpen(false);
        }
      } else {
        const { error, data } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          setErrorMsg(error.message);
        } else if (data.session) {
          if (audioEnabled) {
            playTradeChime("high");
          }
          addToast("تم إنشاء الحساب وتسجيل الدخول بنجاح! 🚀", "success");
          setIsAuthModalOpen(false);
        } else {
          setSuccessMsg("تم إرسال رابط تأكيد إلى بريدك الإلكتروني لتفعيل الحساب.");
        }
      }
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "حدث خطأ غير متوقع في المصادقة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in" dir="rtl">
      <div className="relative w-full max-w-md rounded-2xl border border-[#1E293B] bg-[#0F1419] shadow-2xl p-6 text-right overflow-hidden">
        {/* Glow Line */}
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-[#8B5CF6] via-[#06B6D4] to-[#10B981]" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1E293B] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30">
              <Lock className="h-5 w-5 text-[#8B5CF6]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#E2E8F0]">
                {mode === "signin" ? "تسجيل الدخول للمنصة" : "إنشاء حساب متداول جديد"}
              </h2>
              <p className="text-xs text-[#64748B]">
                Supabase Auth — لحفظ التوصيات وإدارة المحفظة
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1E293B] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-[#080C14] p-1 border border-[#1E293B] mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === "signin"
                ? "bg-[#8B5CF6] text-white shadow-md shadow-violet-500/20 font-bold"
                : "text-[#64748B] hover:text-[#E2E8F0]"
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>تسجيل الدخول</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === "signup"
                ? "bg-[#8B5CF6] text-white shadow-md shadow-violet-500/20 font-bold"
                : "text-[#64748B] hover:text-[#E2E8F0]"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>حساب جديد</span>
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F43F5E]/15 border border-[#F43F5E]/30 text-xs text-[#F43F5E] mb-3 animate-fade-in">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 text-xs text-[#10B981] mb-3 animate-fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-xs font-semibold text-[#E2E8F0] mb-1.5 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-[#06B6D4]" />
              البريد الإلكتروني:
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@trading.com"
              required
              className="bg-[#080C14] text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#E2E8F0] mb-1.5 flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-[#8B5CF6]" />
              كلمة المرور:
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="bg-[#080C14] text-xs font-mono"
            />
          </div>

          <Button
            type="submit"
            variant="scanner"
            disabled={loading}
            className="w-full mt-2 font-bold py-2.5 text-xs"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                جارٍ التحقق...
              </>
            ) : mode === "signin" ? (
              <>
                <LogIn className="h-4 w-4 ml-2" />
                تسجيل الدخول الفوري
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 ml-2" />
                إنشاء حساب وحفظ التوصيات
              </>
            )}
          </Button>
        </form>

        <div className="mt-4 pt-3 border-t border-[#1E293B] flex items-center justify-center gap-1.5 text-[10px] text-[#64748B]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
          <span>بياناتك محمية ومشفرة عبر Supabase Row Level Security (RLS)</span>
        </div>
      </div>
    </div>
  );
}
