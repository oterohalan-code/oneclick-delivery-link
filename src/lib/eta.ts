/**
 * ETA calculation via OSRM public demo server.
 * Fallback: straight-line distance / 25 km/h average urban speed.
 * Returns ETA in MINUTES.
 */
export async function fetchEtaMinutes(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<number> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6_000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();
    const seconds = data?.routes?.[0]?.duration;
    if (typeof seconds === "number" && seconds > 0) {
      // Add 20% buffer for urban traffic
      return Math.max(1, Math.round((seconds * 1.2) / 60));
    }
  } catch {
    /* fallback below */
  }
  return haversineEtaMinutes(from, to);
}

export function haversineEtaMinutes(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  speedKmh = 25,
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const km = 2 * R * Math.asin(Math.sqrt(x));
  return Math.max(1, Math.round((km / speedKmh) * 60));
}

/** Format minutes nicely: "8 min", "1 h 20 min" */
export function formatEta(min: number | null | undefined): string {
  if (min == null || !isFinite(min) || min <= 0) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Returns "hace 12s", "hace 2 min", "hace 1 h" */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "sin señal";
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return `hace ${h} h`;
}
