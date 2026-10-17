// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Input Component
// ═══════════════════════════════════════════════════════════════════════════
import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-[#1E293B] bg-[#0F1419] px-3 py-2 text-sm text-[#E2E8F0] placeholder:text-[#64748B] transition-colors focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/50 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
