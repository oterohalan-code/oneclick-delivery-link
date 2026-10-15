import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function FlowCard({
  step,
  title,
  children,
}: {
  step?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-hairline bg-paper p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {step && <span className="text-xs font-semibold uppercase tracking-wide text-primary">{step}</span>}
      </div>
      {children}
    </section>
  );
}

export function MoneyLine({ label, amount, strong = false }: { label: string; amount: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-1.5 text-sm ${strong ? "border-t border-hairline pt-2 font-semibold" : "text-graphite"}`}>
      <span>{label}</span>
      <span className={strong ? "text-ink" : ""}>{amount}</span>
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
        className="h-4 w-4 accent-[#E45712]"
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
