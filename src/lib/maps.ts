/** Google Maps and WhatsApp helpers. The customer has no One Click account. */

export type GeoPoint = {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
};

function hasCoords(point: GeoPoint): point is GeoPoint & { lat: number; lng: number } {
  return point.lat != null && point.lng != null && Number.isFinite(point.lat) && Number.isFinite(point.lng);
}

/** Place pin. Prefer coordinates; fall back to the street address. */
export function googleMapsPlaceUrl(point: GeoPoint): string | null {
  if (hasCoords(point)) {
    return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
  }
  const address = point.address?.trim();
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** A pasted Google Maps link. Short links may not include the pin. */
export function parseGoogleMapsLink(raw: string): { url: string; lat: number | null; lng: number | null } | null {
  const url = raw.trim();
  if (!isAllowedGoogleMapsUrl(url)) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(url).replace(/\+/g, " "); } catch { return null; }
  // A place's data pin is more precise than the map viewport (@lat,lng).
  const place = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const query = decoded.match(/[?&](?:q|query|destination|ll|daddr)=\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  const search = decoded.match(/\/maps\/(?:search|place)\/\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  const at = decoded.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  const hit = place ?? query ?? search ?? at;
  if (!hit) return { url, lat: null, lng: null };
  const lat = Number(hit[1]);
  const lng = Number(hit[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { url, lat, lng };
}

/** Exact hosts and paths only: never let a shared link become an arbitrary fetch. */
export function isAllowedGoogleMapsUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port || raw.length > 4096) return false;
    if (url.hostname === "maps.app.goo.gl") return /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
    if (url.hostname === "goo.gl") return /^\/maps\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
    if (["google.com", "www.google.com", "google.com.mx", "www.google.com.mx"].includes(url.hostname)) return /^\/maps(?:\/|$)/.test(url.pathname);
    return ["maps.google.com", "maps.google.com.mx"].includes(url.hostname) && /^\/(?:maps(?:\/|$))?$/.test(url.pathname);
  } catch { return false; }
}

/** Driving directions. Omitting origin lets Google Maps use the device location. */
export function googleMapsDirectionsUrl(point: GeoPoint): string | null {
  if (hasCoords(point)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=driving`;
  }
  const address = point.address?.trim();
  if (!address) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
}

/** wa.me digits. 10-digit Mexican numbers get the 52 country code. */
export function whatsappChatUrl(phone: string | null | undefined, text?: string): string | null {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) digits = `52${digits}`;
  const base = `https://wa.me/${digits}`;
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

/** Lovable preview iframes WhatsApp; api.whatsapp.com then returns ERR_BLOCKED_BY_RESPONSE. */
export function isEmbeddedPreview(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function customerMapsWhatsAppText(input: {
  restaurantName: string;
  customerName?: string | null;
  pickup: GeoPoint;
  dropoff: GeoPoint;
  trackingUrl?: string | null;
}): string {
  const greeting = input.customerName?.trim()
    ? `Hola ${input.customerName.trim()},`
    : "Hola,";
  const pickupUrl = googleMapsPlaceUrl(input.pickup);
  const dropoffUrl = googleMapsPlaceUrl(input.dropoff);
  const pickupLine = input.pickup.address?.trim()
    ? `📍 Recoger (restaurante): ${input.pickup.address.trim()}`
    : "📍 Recoger (restaurante)";
  const dropoffLine = input.dropoff.address?.trim()
    ? `📍 Entregar (tu dirección): ${input.dropoff.address.trim()}`
    : "📍 Entregar (tu dirección)";

  const lines = [
    `${greeting} tu pedido de ${input.restaurantName} va con One Click.`,
    "",
    pickupLine,
    pickupUrl,
    "",
    dropoffLine,
    dropoffUrl,
  ];

  if (input.trackingUrl) {
    lines.push("", `Seguimiento (opcional): ${input.trackingUrl}`);
  }

  return lines.filter((line) => line != null).join("\n").trim();
}
