// Pricing dinámico — espejo cliente de public.calculate_shipping_fee
// Mantener sincronizado con la función SQL.

export type SurgeReason = "normal" | "hora_pico" | "madrugada" | "fin_de_semana";

export interface ShippingQuote {
  baseFee: number;
  surgeMultiplier: number;
  totalFee: number;
  surgeReason: SurgeReason;
}

const SURGE_LABELS: Record<SurgeReason, string> = {
  normal: "Tarifa normal",
  hora_pico: "Hora pico (+20%)",
  madrugada: "Madrugada (+15%)",
  fin_de_semana: "Fin de semana (+10%)",
};

export function surgeLabel(r: SurgeReason): string {
  return SURGE_LABELS[r];
}

function baseByKm(km: number): number {
  if (!Number.isFinite(km) || km <= 0) return 0;
  if (km <= 3) return 40;
  if (km <= 5) return 50;
  if (km <= 7) return 60;
  if (km <= 9) return 70;
  if (km <= 10.9) return 80;
  const extra = Math.ceil(km - 11);
  return 80 + 10 + extra * 10;
}

export function calculateShippingFee(km: number, at: Date = new Date()): ShippingQuote {
  const base = baseByKm(km);
  if (base <= 0) {
    return { baseFee: 0, surgeMultiplier: 1, totalFee: 0, surgeReason: "normal" };
  }

  // Convertir a hora CDMX (UTC-6, sin DST en MX desde 2022)
  const cdmx = new Date(at.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  const hour = cdmx.getHours();
  const dow = cdmx.getDay();

  let mult = 1.0;
  let reason: SurgeReason = "normal";

  if ((hour >= 13 && hour < 15) || (hour >= 19 && hour < 22)) {
    mult = 1.20;
    reason = "hora_pico";
  } else if (hour < 6) {
    mult = 1.15;
    reason = "madrugada";
  } else if (dow === 0 || dow === 6) {
    mult = 1.10;
    reason = "fin_de_semana";
  }

  return {
    baseFee: Math.round(base * 100) / 100,
    surgeMultiplier: mult,
    totalFee: Math.round(base * mult * 100) / 100,
    surgeReason: reason,
  };
}
