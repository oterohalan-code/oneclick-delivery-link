import { googleMapsDirectionsUrl, whatsappChatUrl, type GeoPoint } from "@/lib/maps";
import { formatMxn } from "@/lib/business";

export type OrderMoney = {
  food: number;
  shipping: number;
  total: number;
};

export function orderCode(order: { id: string; external_order_id?: string | null }): string {
  const external = order.external_order_id?.trim();
  return external || order.id.slice(0, 6).toUpperCase();
}

export function orderMoney(order: {
  amount_to_collect?: number | null;
  shipping_fee?: number | null;
  food_amount_cents?: number | null;
  shipping_amount_cents?: number | null;
}): OrderMoney {
  const shipping =
    order.shipping_amount_cents != null
      ? order.shipping_amount_cents / 100
      : Number(order.shipping_fee ?? 0);
  const total = Number(order.amount_to_collect ?? 0);
  const food =
    order.food_amount_cents != null
      ? order.food_amount_cents / 100
      : Math.max(0, total - shipping);
  return { food, shipping, total: total || food + shipping };
}

export function maskPhone(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 6) return phone?.trim() || "Sin teléfono";
  return `${digits.slice(0, 3)} ••• ••${digits.slice(-2)}`;
}

export type OrderFlow = {
  restaurantFirstSentAt?: string;
  restaurantFirstUrl?: string;
  restaurantSecondSentAt?: string;
  restaurantSecondUrl?: string;
  courierFirstSavedAt?: string;
  courierSecondSavedAt?: string;
  productReceivedAt?: string;
  advancePaidAt?: string;
  foodDeliveredAt?: string;
  cashCollectedAt?: string;
  incidentNote?: string;
  incidentAt?: string;
};

export function parseOrderFlow(value: unknown): OrderFlow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as OrderFlow;
}

function flagKey(orderId: string, flag: string) {
  return `oc-flow:${orderId}:${flag}`;
}

export function readFlowFlag(orderId: string, flag: string): boolean {
  try {
    return localStorage.getItem(flagKey(orderId, flag)) === "1";
  } catch {
    return false;
  }
}

export function writeFlowFlag(orderId: string, flag: string) {
  try {
    localStorage.setItem(flagKey(orderId, flag), "1");
  } catch {
    /* private mode */
  }
}

export function courierPickupMessage(input: {
  code: string;
  restaurantName: string;
  pickup: GeoPoint;
  customerName?: string | null;
  money: OrderMoney;
}): string {
  const url = googleMapsDirectionsUrl(input.pickup);
  return [
    `Pedido #${input.code}`,
    `Recoge en ${input.restaurantName}.`,
    input.pickup.address ? `Dirección: ${input.pickup.address}` : "",
    url ? `Liga al restaurante: ${url}` : "",
    input.customerName ? `Cliente: ${input.customerName}` : "",
    `Adelantas al restaurante ${formatMxn(input.money.food)}.`,
    `Cobras al cliente ${formatMxn(input.money.total)}.`,
    `Tu envío ${formatMxn(input.money.shipping)}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function customerEnRouteMessage(input: {
  dropoff: GeoPoint;
  money: OrderMoney;
}): string {
  const url = googleMapsDirectionsUrl(input.dropoff);
  return [
    "Tu comida ya va en camino.",
    "Este es el enlace de Google Maps para seguir el recorrido a tu domicilio.",
    url ?? "",
    `Total a pagar al repartidor: ${formatMxn(input.money.total)}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function openWhatsApp(phone: string | null | undefined, text: string): boolean {
  const url = whatsappChatUrl(phone, text);
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
