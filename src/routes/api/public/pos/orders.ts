import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

const PosOrderSchema = z.object({
  external_order_id: z.string().min(1).max(120),
  pickup_address: z.string().min(3),
  pickup_lat: z.number().optional(),
  pickup_lng: z.number().optional(),
  dropoff_address: z.string().min(3),
  dropoff_lat: z.number().optional(),
  dropoff_lng: z.number().optional(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  customer_phone_dial_code: z.string().default("+52"),
  amount_to_collect: z.number().min(0).default(0),
  shipping_fee: z.number().min(0).default(0),
  distance_km: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/pos/orders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("x-api-key");
        if (!apiKey || !apiKey.startsWith("pos_")) {
          return jsonRes({ error: "Missing or invalid API key" }, 401);
        }

        const supabase = getSupabase();
        const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");

        const { data: integration } = await supabase
          .from("pos_integrations")
          .select("id, restaurant_id, active")
          .eq("api_key_hash", apiKeyHash)
          .maybeSingle();

        if (!integration || !integration.active) {
          return jsonRes({ error: "Invalid or revoked API key" }, 401);
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return jsonRes({ error: "Invalid JSON body" }, 400);
        }

        const parsed = PosOrderSchema.safeParse(payload);
        if (!parsed.success) {
          return jsonRes(
            { error: "Validation failed", details: parsed.error.flatten() },
            422,
          );
        }
        const body = parsed.data;

        // Idempotencia
        const { data: existing } = await supabase
          .from("orders")
          .select("id, status, tracking_token")
          .eq("pos_integration_id", integration.id)
          .eq("external_order_id", body.external_order_id)
          .maybeSingle();
        if (existing) {
          return jsonRes({
            order_id: existing.id,
            status: existing.status,
            tracking_token: existing.tracking_token,
            duplicate: true,
          });
        }

        // Calcular zona si tenemos coordenadas
        let zoneId: string | null = null;
        if (body.pickup_lat != null && body.pickup_lng != null) {
          const { data: z } = await supabase.rpc("find_zone_for_point", {
            _lat: body.pickup_lat,
            _lng: body.pickup_lng,
          });
          zoneId = (z as string | null) ?? null;
        }

        const { data: created, error: insErr } = await supabase
          .from("orders")
          .insert({
            restaurant_id: integration.restaurant_id,
            pos_integration_id: integration.id,
            external_order_id: body.external_order_id,
            pickup_address: body.pickup_address,
            pickup_lat: body.pickup_lat ?? null,
            pickup_lng: body.pickup_lng ?? null,
            dropoff_address: body.dropoff_address,
            dropoff_lat: body.dropoff_lat ?? null,
            dropoff_lng: body.dropoff_lng ?? null,
            customer_name: body.customer_name ?? null,
            customer_phone: body.customer_phone ?? null,
            customer_phone_dial_code: body.customer_phone_dial_code,
            amount_to_collect: body.amount_to_collect,
            shipping_fee: body.shipping_fee,
            distance_km: body.distance_km ?? null,
            notes: body.notes ?? null,
            zone_id: zoneId,
            status: "pending",
          })
          .select("id, status, tracking_token")
          .single();

        if (insErr || !created) {
          return jsonRes({ error: insErr?.message ?? "Insert failed" }, 500);
        }

        await supabase
          .from("pos_integrations")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", integration.id);

        return jsonRes(
          {
            order_id: created.id,
            status: created.status,
            tracking_token: created.tracking_token,
            duplicate: false,
          },
          201,
        );
      },
    },
  },
});
