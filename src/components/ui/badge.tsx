// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Badge Component
// ═══════════════════════════════════════════════════════════════════════════
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "bg-[#1E293B] text-[#E2E8F0]",
        bullish: "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30",
        bearish: "bg-[#F43F5E]/15 text-[#F43F5E] border border-[#F43F5E]/30",
        gold: "bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30",
        violet: "bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30",
        warning: "bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30",
        danger: "bg-[#F43F5E]/15 text-[#F43F5E] border border-[#F43F5E]/30 animate-pulse",
        connected: "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30",
        disconnected: "bg-[#64748B]/15 text-[#64748B] border border-[#64748B]/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
