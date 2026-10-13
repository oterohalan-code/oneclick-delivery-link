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
