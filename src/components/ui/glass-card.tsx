import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "strong" | "dark" | "subtle";
  interactive?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", interactive = false, ...props }, ref) => {
    const base = "relative rounded-2xl shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-8px_rgb(0_0_0/0.10)]";
    const v =
      variant === "strong"
        ? "glass-strong"
        : variant === "dark"
        ? "glass-dark text-bone"
        : variant === "subtle"
        ? "bg-paper/80 backdrop-blur-md border border-hairline"
        : "glass";
    const interactiveCls = interactive ? "lift cursor-pointer hover:shadow-[0_2px_4px_rgb(0_0_0/0.06),0_20px_40px_-8px_rgb(0_0_0/0.18)]" : "";
    return <div ref={ref} className={cn(base, v, interactiveCls, className)} {...props} />;
  }
);
GlassCard.displayName = "GlassCard";
