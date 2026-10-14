import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  variant?: "default" | "subtle";
}

export function EmptyState({ icon: Icon, title, description, action, className, variant = "default" }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative rounded-3xl border border-hairline overflow-hidden",
        variant === "default" ? "bg-paper/70 backdrop-blur-sm" : "bg-transparent",
        "px-6 py-12 text-center",
        className
      )}
    >
      {/* Decorative ember halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in srgb, #B8693A 22%, transparent), transparent 70%)",
        }}
      />
      <div className="relative">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl glass-strong">
          <Icon className="h-6 w-6 text-ink" strokeWidth={1.5} />
        </div>
        <h3 className="text-display text-xl font-medium text-ink">{title}</h3>
        {description && (
          <p className="mt-2 text-sm text-graphite max-w-sm mx-auto leading-relaxed">{description}</p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}
