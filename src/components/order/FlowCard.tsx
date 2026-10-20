import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function StepHeading({ step, title, subtitle }: { step: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-4 flex gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-primary tabular">{step}</div>
      <div>
        <h2 className="text-xl font-semibold leading-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-graphite">{subtitle}</p>}
      </div>
    </div>
  );
}

export function FlowCard({
  step,
  title,
  subtitle,
  children,
}: {
  step?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-hairline bg-paper p-5 shadow-[var(--shadow-soft)]">
      {step ? <StepHeading step={step} title={title} subtitle={subtitle} /> : <h2 className="mb-3 text-xl font-semibold text-ink">{title}</h2>}
      {children}
    </section>
  );
}

export function MoneyLine({ label, amount, strong = false }: { label: string; amount: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-1.5 text-sm ${strong ? "border-t border-hairline pt-2 font-semibold" : "text-graphite"}`}>
      <span>{label}</span>
      <span className={`tabular ${strong ? "text-ink" : ""}`}>{amount}</span>
    </div>
  );
}

export function CheckRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-hairline bg-bone px-3 py-2.5 text-sm">
      <input
        type="checkbox"
        className="h-4 w-4 accent-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function FlowButton({
  children,
  disabled,
  onClick,
  variant = "default",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  variant?: "default" | "outline";
}) {
  return (
    <Button type="button" variant={variant} className="h-12 w-full" disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}
