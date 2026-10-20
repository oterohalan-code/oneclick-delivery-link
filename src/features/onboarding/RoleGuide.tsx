import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { BUSINESS, formatMxn } from "@/lib/business";
import { SHIPPING_BANDS } from "@/lib/pricing";

export function RoleGuide({
  eyebrow,
  title,
  lede,
  steps,
  feeLead,
  membership,
  cta,
  role,
  extra,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  steps: string[];
  feeLead: string;
  membership: { priceMxn: number; note: string; benefits: string[] };
  cta: string;
  role: "restaurant" | "courier";
  extra?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bone text-ink">
      <header className="bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Link to="/"><Logo size="sm" tone="bone" /></Link>
          <Link to="/auth" className="text-sm">Iniciar sesión</Link>
        </div>
      </header>
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <p className="text-sm font-medium text-primary">{eyebrow}</p>
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="text-sm text-graphite">{lede}</p>

        <section className="rounded-2xl border border-hairline bg-white p-4">
          <h2 className="font-semibold">Cómo funciona</h2>
          <ol className="mt-3 space-y-3">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm">
                <span className="text-lg font-semibold leading-none text-primary">{String(index + 1).padStart(2, "0")}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-hairline bg-white p-4">
          <h2 className="font-semibold">Tarifas</h2>
          <p className="mt-1 text-sm text-graphite">{feeLead}</p>
          <ul className="mt-3 divide-y divide-hairline text-sm">
            {SHIPPING_BANDS.map((band) => (
              <li key={band.untilKm} className="flex justify-between py-2">
                <span>Hasta {band.untilKm === 11 ? "10.9" : band.untilKm} km</span>
                <span className="font-semibold">{formatMxn(band.fee)}</span>
              </li>
            ))}
            <li className="flex justify-between py-2">
              <span>Desde 11 km</span>
              <span className="font-semibold">{formatMxn(90)} y {formatMxn(10)} más por km</span>
            </li>
          </ul>
          <p className="mt-3 text-sm text-graphite">De 1 a 3 pm y de 7 a 10 pm el envío suma 20%. Antes de las 6 am suma 15%. Sábado y domingo, fuera de esas horas, suma 10%.</p>
        </section>

        <section className="rounded-2xl bg-navy p-5 text-navy-foreground shadow-lg">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">Membresía 1Click</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-4xl font-semibold tabular-nums">{formatMxn(membership.priceMxn)}</span>
            <span className="pb-1 text-sm text-navy-foreground/70">MXN / mes</span>
          </div>
          <p className="mt-2 text-sm text-navy-foreground/80">{membership.note}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {membership.benefits.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="text-primary">✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </section>

        {extra}

        <Button asChild className="h-12 w-full">
          <Link to="/auth" search={{ role }}>{cta}</Link>
        </Button>
        <p className="text-center text-xs text-graphite">{BUSINESS.coverageLabel}. La comida se paga en el restaurante o en domicilio; el cobro es del restaurante.</p>
      </main>
    </div>
  );
}
