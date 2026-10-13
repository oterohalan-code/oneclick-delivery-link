const MP_API = "https://api.mercadopago.com";

export type MembershipRole = "restaurant" | "courier";
export type MembershipMode = "manual" | "auto";

export function membershipAmountCents(role: MembershipRole): number {
  return role === "restaurant" ? 450_00 : 300_00;
}

export function membershipAmountMxn(role: MembershipRole): number {
  return membershipAmountCents(role) / 100;
}

function accessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Falta MERCADOPAGO_ACCESS_TOKEN");
  return token;
}

const PRODUCTION_APP_URL = "https://oneclick.punchingsolutions.com.mx";

export function publicAppUrl(fallback?: string): string {
  const url =
    process.env.PUBLIC_APP_URL ??
    process.env.MERCADOPAGO_NOTIFICATION_BASE_URL ??
    fallback ??
    PRODUCTION_APP_URL;
  return url.replace(/\/$/, "");
}

export function notificationUrl(): string {
  const explicit = process.env.MERCADOPAGO_NOTIFICATION_URL;
  if (explicit) return explicit;
  return `${PRODUCTION_APP_URL}/api/public/payments/mercadopago?source_news=webhooks`;
}

async function mpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof body === "object" ? JSON.stringify(body) : String(body);
    throw new Error(`Mercado Pago ${res.status}: ${message}`);
  }
  return body as T;
}

export async function verifyMercadoPagoSignature(input: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): Promise<boolean> {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!input.xSignature || !input.xRequestId || !input.dataId) return false;

  const parts = Object.fromEntries(
    input.xSignature.split(",").map((part) => {
      const [k, ...rest] = part.trim().split("=");
      return [k, rest.join("=")];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${input.dataId};request-id:${input.xRequestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== v1.length) return false;
  let out = 0;
  for (let i = 0; i < hex.length; i++) out |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  return out === 0;
}

export type MpPreference = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

export async function createCheckoutPreference(input: {
  title: string;
  amountMxn: number;
  externalReference: string;
  payerEmail?: string;
  backUrl: string;
}): Promise<MpPreference> {
  return mpFetch<MpPreference>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          title: input.title,
          quantity: 1,
          currency_id: "MXN",
          unit_price: input.amountMxn,
        },
      ],
      payer: input.payerEmail ? { email: input.payerEmail } : undefined,
      external_reference: input.externalReference,
      statement_descriptor: "ONECLICK",
      notification_url: notificationUrl(),
      back_urls: {
        success: input.backUrl,
        pending: input.backUrl,
        failure: input.backUrl,
      },
      auto_return: "approved",
    }),
  });
}

export type MpPreapproval = {
  id: string;
  status?: string;
  init_point?: string;
  sandbox_init_point?: string;
  external_reference?: string;
  auto_recurring?: { transaction_amount?: number; currency_id?: string };
};

export async function createPendingPreapproval(input: {
  reason: string;
  amountMxn: number;
  externalReference: string;
  payerEmail: string;
  backUrl: string;
}): Promise<MpPreapproval> {
  return mpFetch<MpPreapproval>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: input.reason,
      external_reference: input.externalReference,
      payer_email: input.payerEmail,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: input.amountMxn,
        currency_id: "MXN",
      },
      back_url: input.backUrl,
      status: "pending",
    }),
  });
}

export async function getPreapproval(id: string): Promise<MpPreapproval> {
  return mpFetch<MpPreapproval>(`/preapproval/${id}`);
}

export async function cancelPreapproval(id: string): Promise<MpPreapproval> {
  return mpFetch<MpPreapproval>(`/preapproval/${id}`, {
    method: "PUT",
    body: JSON.stringify({ status: "cancelled" }),
  });
}

export type MpPayment = {
  id: number | string;
  status?: string;
  status_detail?: string;
  transaction_amount?: number;
  currency_id?: string;
  date_approved?: string;
  date_created?: string;
  external_reference?: string;
  collector_id?: number | string;
  metadata?: Record<string, unknown>;
  point_of_interaction?: { transaction_data?: { subscription_id?: string } };
};

export async function getPayment(id: string): Promise<MpPayment> {
  return mpFetch<MpPayment>(`/v1/payments/${id}`);
}

export async function searchPaymentsByReference(externalReference: string): Promise<MpPayment[]> {
  const data = await mpFetch<{ results?: MpPayment[] }>(
    `/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc`,
  );
  return data.results ?? [];
}

export type MpAuthorizedPayment = {
  id?: number | string;
  payment?: { id?: number | string };
  preapproval_id?: string;
  external_reference?: string;
};

export async function getAuthorizedPayment(id: string): Promise<MpAuthorizedPayment> {
  return mpFetch<MpAuthorizedPayment>(`/authorized_payments/${id}`);
}

export function checkoutUrl(resource: { init_point?: string; sandbox_init_point?: string }): string | null {
  const live = process.env.MERCADOPAGO_ACCESS_TOKEN?.startsWith("APP_USR-");
  if (!live && resource.sandbox_init_point) return resource.sandbox_init_point;
  return resource.init_point ?? resource.sandbox_init_point ?? null;
}

export function expectedCollectorOk(collectorId: number | string | undefined): boolean {
  const expected = process.env.MERCADOPAGO_COLLECTOR_ID;
  if (!expected || collectorId == null) return !expected;
  return String(collectorId) === String(expected);
}
