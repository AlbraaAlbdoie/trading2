// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Protected Dashboard Auth Screen (Arabic RTL)
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React, { useState } from "react";
import {
  Activity,
  Lock,
  Mail,
  KeyRound,
  ShieldCheck,
  Loader2,
  LogIn,
  UserPlus,
  AlertCircle,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboardStore } from "@/store/useDashboardStore";
import { supabase } from "@/lib/supabase";
import { playTradeChime } from "@/hooks/useAudioAlert";

export function AuthScreen() {
  const { state, addToast } = useDashboardStore();
  const { audioEnabled } = state;

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

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
          addToast("تم تسجيل الدخول بنجاح! مرحباً بك في NEXUS ALPHA 🚀", "success");
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
        } else {
          addToast("تم إنشاء الحساب، يرجى تفعيل البريد الإلكتروني.", "info");
        }
      }
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "حدث خطأ في الاتصال بقاعدة بيانات Supabase");
    } finally {
      setLoading(false);
    }
  };

  // Demo guest account for instant testing if desired
  const handleGuestDemo = async () => {
    setLoading(true);
    try {
      const demoEmail = `trader_${Math.floor(Math.random() * 10000)}@nexusalpha.io`;
      const demoPass = "NexusAlpha2026!";
      await supabase.auth.signUp({
        email: demoEmail,
        password: demoPass,
      });
      addToast("تم الدخول بنجاح كمتداول تجريبي! ⚡", "success");
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center bg-[#080C14] p-4 text-right selection:bg-[#8B5CF6]/30 selection:text-white"
      dir="rtl"
    >
      {/* Background glow effects */}
      <div className="fixed top-1/4 right-1/4 h-96 w-96 rounded-full bg-[#8B5CF6]/10 blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 left-1/4 h-96 w-96 rounded-full bg-[#06B6D4]/10 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md rounded-2xl border border-[#1E293B] bg-[#0F1419]/90 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Top Gradient Stripe */}
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-[#8B5CF6] via-[#06B6D4] to-[#10B981]" />

        {/* Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center justify-center p-3 rounded-2xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 mb-3 shadow-lg shadow-violet-500/10">
            <Activity className="h-8 w-8 text-[#8B5CF6]" />
          </div>
          <h1 className="text-xl font-extrabold text-[#E2E8F0] tracking-wide">
            NEXUS ALPHA
          </h1>
          <p className="text-xs text-[#8B5CF6] font-semibold mt-0.5">
            ماسح السيولة الذكي للأسواق المالية | Smart Money Screener
          </p>
          <div className="flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-[#1E293B]/60 text-[11px] text-[#64748B]">
            <Lock className="h-3 w-3 text-[#10B981]" />
            <span>نظام محمي بقاعدة بيانات ومصادقة Supabase</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-[#080C14] p-1 border border-[#1E293B] mb-5 text-xs font-semibold">
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

        {/* Error Alert */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F43F5E]/15 border border-[#F43F5E]/30 text-xs text-[#F43F5E] mb-4 animate-fade-in">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-[#E2E8F0] mb-1.5 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-[#06B6D4]" />
              البريد الإلكتروني:
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="trader@nexusalpha.io"
              required
              className="bg-[#080C14] text-xs font-mono h-10"
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
              className="bg-[#080C14] text-xs font-mono h-10"
            />
          </div>

          <Button
            type="submit"
            variant="scanner"
            disabled={loading}
            className="w-full mt-2 font-bold py-2.5 text-xs h-10 shadow-lg shadow-violet-500/25"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                جارٍ الاتصال بـ Supabase...
              </>
            ) : mode === "signin" ? (
              <>
                <LogIn className="h-4 w-4 ml-2" />
                الدخول إلى منصة التداول
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 ml-2" />
                إنشاء حساب متداول وحفظ التوصيات
              </>
            )}
          </Button>

          {/* Guest Demo Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGuestDemo}
            disabled={loading}
            className="w-full text-xs border-[#1E293B] hover:border-[#10B981] text-[#94A3B8] hover:text-[#E2E8F0] h-9 gap-1.5"
          >
            <Zap className="h-3.5 w-3.5 text-[#10B981]" />
            <span>تجربة المنصة كمتداول فوري (Guest Demo)</span>
          </Button>
        </form>

        <div className="mt-5 pt-3 border-t border-[#1E293B] flex items-center justify-center gap-1.5 text-[10px] text-[#64748B]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
          <span>تشفير كامل للبيانات وسياسة وصول آمنة (RLS Policies)</span>
        </div>
      </div>
    </div>
  );
}
