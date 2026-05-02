import { forwardRef } from "react";
import logoMark from "@/assets/logo-mark.svg?url";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "ink" | "bone";
}

const sizeMap = {
  sm: { mark: "h-7 w-7", text: "text-lg" },
  md: { mark: "h-9 w-9", text: "text-xl" },
  lg: { mark: "h-12 w-12", text: "text-2xl" },
  xl: { mark: "h-20 w-20", text: "text-4xl" },
};

export const Logo = forwardRef<HTMLDivElement, LogoProps>(
  ({ className = "", showWordmark = true, size = "md", tone = "ink" }, ref) => {
    const sz = sizeMap[size];
    const toneClass = tone === "bone" ? "text-bone" : "text-ink";
    return (
      <div ref={ref} className={`inline-flex items-center gap-2.5 ${className}`}>
        <img src={logoMark} alt="1Click" className={`${sz.mark} ${tone === "bone" ? "invert" : ""}`} />
        {showWordmark && (
          <span className={`text-display font-medium ${sz.text} ${toneClass} tracking-tight`}>
            1Click
          </span>
        )}
      </div>
    );
  }
);
Logo.displayName = "Logo";
