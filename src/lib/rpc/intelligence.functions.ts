import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Updates the ETA for an active order. Called by the courier client every ~30s
 * while in_transit/assigned. Uses OSRM from current courier position to the
 * relevant target (pickup if assigned, dropoff if in_transit).
 */
const EtaInput = z.object({
  orderId: z.string().uuid(),
  etaMinutes: z.number().int().min(1).max(600),
});

export const updateOrderEta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => EtaInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify the caller is the assigned courier
    const { data: order } = await supabase
      .from("orders")
      .select("id, courier_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) return { ok: false as const, message: "Pedido no encontrado." };

    const { data: courier } = await supabaseAdmin
      .from("couriers")
      .select("id, user_id")
      .eq("id", order.courier_id ?? "")
      .maybeSingle();
    if (!courier || courier.user_id !== userId) {
      return { ok: false as const, message: "No autorizado." };
    }

    const { error } = await supabase
      .from("orders")
      .update({ eta_minutes: data.etaMinutes })
      .eq("id", data.orderId);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });

/**
 * Marks an order as picked_up (between assigned and in_transit) — used to
 * timestamp pickup for accurate scoring + ETA recalculation to dropoff.
 */
export const markOrderPickedUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ orderId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("orders")
      .update({ picked_up_at: new Date().toISOString(), status: "in_transit" })
      .eq("id", data.orderId);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });

/**
 * Returns public-safe stats for a courier (name, score, total deliveries).
 * Only the assigned restaurant, the courier themselves, or admins can read.
 */
export const getCourierStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ courierId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc("get_courier_stats", {
      _courier_id: data.courierId,
    });
    if (error) return { ok: false as const, message: error.message };
    const r = rows?.[0];
    if (!r) return { ok: false as const, message: "Sin datos" };
    return {
      ok: true as const,
      fullName: r.full_name as string | null,
      score: Number(r.score ?? 100),
      totalDeliveries: Number(r.total_deliveries ?? 0),
      onTimeDeliveries: Number(r.on_time_deliveries ?? 0),
      avgMinutes: Number(r.avg_minutes ?? 0),
    };
  });

/**
 * Accepts a *batch* of pending orders for the calling courier. Maximum 3.
 * Each order must currently be pending. All assignments share a generated
 * batch_id so the UI can show them grouped.
 */
const BatchInput = z.object({
  orderIds: z.array(z.string().uuid()).min(2).max(3),
});

export const acceptOrderBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => BatchInput.parse(i))
  .handler(async () => {
    return {
      ok: false as const,
      message: "La toma de pedidos en lote está desactivada.",
    };
  });
