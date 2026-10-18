// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Toast Notifications System (Arabic RTL)
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useDashboardStore } from "@/store/useDashboardStore";

export function ToastContainer() {
  const { state, removeToast } = useDashboardStore();
  const { toasts } = state;

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 left-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none" dir="rtl">
      {toasts.map((toast) => {
        const isSuccess = toast.type === "success";
        const isError = toast.type === "error";

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border shadow-xl backdrop-blur-xl animate-slide-in text-xs ${
              isSuccess
                ? "bg-[#0A1A14]/90 border-[#10B981]/40 text-[#E2E8F0]"
                : isError
                  ? "bg-[#1F0D12]/90 border-[#F43F5E]/40 text-[#E2E8F0]"
                  : "bg-[#0F1419]/90 border-[#1E293B] text-[#E2E8F0]"
            }`}
          >
            <div className="flex items-center gap-2">
              {isSuccess && <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0" />}
              {isError && <AlertCircle className="h-4 w-4 text-[#F43F5E] shrink-0" />}
              {!isSuccess && !isError && <Info className="h-4 w-4 text-[#8B5CF6] shrink-0" />}
              <span className="font-medium font-sans leading-normal">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-[#64748B] hover:text-[#E2E8F0] p-1 rounded transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
