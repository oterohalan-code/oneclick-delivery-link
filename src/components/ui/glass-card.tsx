import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "strong" | "dark" | "subtle";
  interactive?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", interactive = false, ...props }, ref) => {
    const base = "relative rounded-lg shadow-elegant";
    const v =
      variant === "strong"
        ? "glass-strong"
        : variant === "dark"
        ? "glass-dark text-bone"
        : variant === "subtle"
        ? "bg-paper/80 backdrop-blur-md border border-hairline"
        : "glass";
    const interactiveCls = interactive ? "lift cursor-pointer hover:shadow-elegant" : "";
    return <div ref={ref} className={cn(base, v, interactiveCls, className)} {...props} />;
  }
);
GlassCard.displayName = "GlassCard";
