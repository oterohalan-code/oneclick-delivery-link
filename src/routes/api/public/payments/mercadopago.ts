import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyMercadoPagoSignature } from "@/lib/mercadopago.server";
import { processMercadoPagoResource } from "@/lib/membership.server";

function firstQuery(url: URL, keys: string[]): string | null {
  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (value) return value;
  }
  return null;
}

export const Route = createFileRoute("/api/public/payments/mercadopago")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, provider: "mercadopago" }),
      POST: async ({ request }) => {
        const url = new URL(request.url);
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          body = {};
        }

        const data = (body.data ?? {}) as Record<string, unknown>;
        const resourceId =
          firstQuery(url, ["data.id", "id"]) ??
          (typeof data.id === "string" || typeof data.id === "number" ? String(data.id) : null);
        const topic =
          firstQuery(url, ["type", "topic"]) ??
          (typeof body.type === "string" ? body.type : null) ??
          (typeof body.topic === "string" ? body.topic : "payment");

        if (!resourceId) {
          return Response.json({ received: true, ignored: "missing_id" });
        }

        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
        if (secret) {
          const valid = await verifyMercadoPagoSignature({
            xSignature: request.headers.get("x-signature"),
            xRequestId: request.headers.get("x-request-id"),
            dataId: resourceId,
          });
          if (!valid) return new Response("invalid signature", { status: 401 });
        }

        const action = typeof body.action === "string" ? body.action : "notify";
        await supabaseAdmin.from("membership_webhook_events").insert({
          provider_event_key: `${topic}:${resourceId}:${action}:${Date.now()}`,
          topic,
          resource_id: resourceId,
        });

        try {
          await processMercadoPagoResource(topic, resourceId);
          return Response.json({ received: true });
        } catch (err) {
          console.error("Mercado Pago webhook error", err);
          return new Response("webhook error", { status: 500 });
        }
      },
    },
  },
});
