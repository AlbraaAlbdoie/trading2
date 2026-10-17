// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Button Component (Shadcn-style with CVA)
// ═══════════════════════════════════════════════════════════════════════════
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-[#10B981] text-white hover:bg-[#059669] shadow-lg shadow-emerald-500/20",
        destructive:
          "bg-[#F43F5E] text-white hover:bg-[#E11D48] shadow-lg shadow-rose-500/20",
        outline:
          "border border-[#1E293B] bg-transparent text-[#E2E8F0] hover:bg-[#1E293B]/50 hover:border-[#334155]",
        secondary:
          "bg-[#1E293B] text-[#E2E8F0] hover:bg-[#334155]",
        ghost:
          "text-[#E2E8F0] hover:bg-[#1E293B]/60",
        gold:
          "bg-[#F59E0B] text-black hover:bg-[#D97706] shadow-lg shadow-amber-500/20",
        violet:
          "bg-[#8B5CF6] text-white hover:bg-[#7C3AED] shadow-lg shadow-violet-500/20",
        scanner:
          "bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white hover:opacity-90 shadow-lg shadow-violet-500/30 font-bold",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-8 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
