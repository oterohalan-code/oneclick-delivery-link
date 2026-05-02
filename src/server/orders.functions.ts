import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  orderId: z.string().uuid(),
});

export const acceptOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: courier, error: cErr } = await supabase
      .from("couriers")
      .select("id, status, wallet_balance, subscription_active, subscription_expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (cErr) return { ok: false as const, message: cErr.message };
    if (!courier) return { ok: false as const, message: "Repartidor no encontrado." };

    if (courier.status !== "active") {
      return { ok: false as const, message: "Tu cuenta aún no está activa." };
    }

    const subActive =
      !!courier.subscription_active &&
      !!courier.subscription_expires_at &&
      new Date(courier.subscription_expires_at).getTime() > Date.now();

    const hasFunds = Number(courier.wallet_balance) >= 5;

    if (!subActive && !hasFunds) {
      return {
        ok: false as const,
        message: "Necesitas saldo de al menos $5 o una suscripción activa para aceptar pedidos.",
      };
    }

    const { data: updated, error: uErr } = await supabase
      .from("orders")
      .update({
        courier_id: courier.id,
        status: "assigned",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", data.orderId)
      .eq("status", "pending")
      .select("id, restaurant_id")
      .maybeSingle();

    if (uErr) return { ok: false as const, message: uErr.message };
    if (!updated) return { ok: false as const, message: "Otro repartidor ya tomó el pedido." };

    // Notificar al restaurante (best-effort)
    try {
      const { data: rest } = await supabaseAdmin
        .from("restaurants")
        .select("user_id, name")
        .eq("id", updated.restaurant_id)
        .maybeSingle();
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      if (rest?.user_id) {
        const { sendPushToUsers } = await import("./push.server");
        await sendPushToUsers([rest.user_id], {
          title: "🛵 ¡Pedido aceptado!",
          body: `${prof?.full_name ?? "Un repartidor"} viene por tu pedido.`,
          url: "/app",
        });
      }
    } catch (e) {
      console.warn("[acceptOrder] push failed", e);
    }

    return { ok: true as const, orderId: updated.id };
  });

// Devuelve info del repartidor asignado a un pedido (solo para el dueño del restaurante)
export const getCourierForOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("courier_id, restaurant_id")
      .eq("id", data.orderId)
      .maybeSingle();

    if (!order || !order.courier_id) {
      return { ok: false as const, message: "Pedido sin repartidor." };
    }

    const { data: rest } = await supabaseAdmin
      .from("restaurants")
      .select("user_id")
      .eq("id", order.restaurant_id)
      .maybeSingle();

    if (!rest || rest.user_id !== userId) {
      return { ok: false as const, message: "No autorizado." };
    }

    const { data: courier } = await supabaseAdmin
      .from("couriers")
      .select("user_id")
      .eq("id", order.courier_id)
      .maybeSingle();

    if (!courier?.user_id) return { ok: false as const, message: "Repartidor no encontrado." };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone, phone_dial_code")
      .eq("id", courier.user_id)
      .maybeSingle();

    return {
      ok: true as const,
      fullName: profile?.full_name ?? "Repartidor",
      phone: profile?.phone ?? null,
      phoneDialCode: profile?.phone_dial_code ?? "+52",
    };
  });

// Avanzar estado del pedido (en_transit / delivered) y notificar al restaurante
const StatusInput = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["in_transit", "delivered"]),
  proofUrl: z.string().optional(),
  deliveredLat: z.number().optional(),
  deliveredLng: z.number().optional(),
});

export const setOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => StatusInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const update: {
      status: "in_transit" | "delivered";
      delivered_at?: string;
      delivery_proof_url?: string;
      delivered_lat?: number;
      delivered_lng?: number;
      picked_up_at?: string;
    } = { status: data.status };
    if (data.status === "in_transit") {
      update.picked_up_at = new Date().toISOString();
    }
    if (data.status === "delivered") {
      update.delivered_at = new Date().toISOString();
      if (data.proofUrl) update.delivery_proof_url = data.proofUrl;
      if (data.deliveredLat != null) update.delivered_lat = data.deliveredLat;
      if (data.deliveredLng != null) update.delivered_lng = data.deliveredLng;
    }

    const { data: updated, error } = await supabase
      .from("orders")
      .update(update)
      .eq("id", data.orderId)
      .select("id, restaurant_id")
      .maybeSingle();

    if (error) return { ok: false as const, message: error.message };
    if (!updated) return { ok: false as const, message: "No se pudo actualizar." };

    try {
      const { data: rest } = await supabaseAdmin
        .from("restaurants")
        .select("user_id")
        .eq("id", updated.restaurant_id)
        .maybeSingle();
      if (rest?.user_id) {
        const { sendPushToUsers } = await import("./push.server");
        await sendPushToUsers([rest.user_id], {
          title: data.status === "in_transit" ? "🚚 Pedido en camino" : "✅ Pedido entregado",
          body:
            data.status === "in_transit"
              ? "El repartidor va camino al cliente."
              : "Tu pedido fue entregado.",
          url: "/app",
        });
      }
    } catch (e) {
      console.warn("[setOrderStatus] push failed", e);
    }

    return { ok: true as const };
  });

// Enviar mensaje de chat (inserta en BD vía RLS y notifica al peer)
const MessageInput = z.object({
  orderId: z.string().uuid(),
  content: z.string().min(1).max(1000),
  senderRole: z.enum(["restaurant", "courier"]),
});

export const sendOrderMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => MessageInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: msg, error } = await supabase
      .from("order_messages")
      .insert({
        order_id: data.orderId,
        sender_id: userId,
        sender_role: data.senderRole,
        content: data.content,
      })
      .select("id")
      .maybeSingle();

    if (error) return { ok: false as const, message: error.message };

    // Notificar al peer
    try {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("restaurant_id, courier_id")
        .eq("id", data.orderId)
        .maybeSingle();
      if (order) {
        const targetUserIds: string[] = [];
        if (data.senderRole === "courier") {
          const { data: rest } = await supabaseAdmin
            .from("restaurants")
            .select("user_id")
            .eq("id", order.restaurant_id)
            .maybeSingle();
          if (rest?.user_id) targetUserIds.push(rest.user_id);
        } else if (order.courier_id) {
          const { data: c } = await supabaseAdmin
            .from("couriers")
            .select("user_id")
            .eq("id", order.courier_id)
            .maybeSingle();
          if (c?.user_id) targetUserIds.push(c.user_id);
        }

        if (targetUserIds.length) {
          const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("full_name")
            .eq("id", userId)
            .maybeSingle();
          const { sendPushToUsers } = await import("./push.server");
          await sendPushToUsers(targetUserIds, {
            title: `💬 ${prof?.full_name ?? "Mensaje nuevo"}`,
            body: data.content.slice(0, 120),
            url: "/app",
          });
        }
      }
    } catch (e) {
      console.warn("[sendOrderMessage] push failed", e);
    }

    return { ok: true as const, id: msg?.id };
  });

// Notificar a couriers elegibles cuando se crea un pedido nuevo
export const notifyCouriersNewOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Solo el dueño del restaurante puede disparar
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("restaurant_id, pickup_address")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) return { ok: false as const };

    const { data: rest } = await supabaseAdmin
      .from("restaurants")
      .select("user_id, name")
      .eq("id", order.restaurant_id)
      .maybeSingle();
    if (!rest || rest.user_id !== userId) return { ok: false as const };

    const { data: couriers } = await supabaseAdmin
      .from("couriers")
      .select("user_id, wallet_balance, subscription_active, subscription_expires_at, status");
    const eligible = (couriers ?? []).filter((c) => {
      if (c.status !== "active") return false;
      const sub =
        !!c.subscription_active &&
        !!c.subscription_expires_at &&
        new Date(c.subscription_expires_at).getTime() > Date.now();
      return sub || Number(c.wallet_balance ?? 0) >= 5;
    });

    const userIds = eligible.map((c) => c.user_id);
    if (!userIds.length) return { ok: true as const, sent: 0 };

    try {
      const { sendPushToUsers } = await import("./push.server");
      await sendPushToUsers(userIds, {
        title: "📦 Nuevo pedido cerca",
        body: `${rest.name} solicita un repartidor`,
        url: "/app",
      });
    } catch (e) {
      console.warn("[notifyCouriersNewOrder] push failed", e);
    }

    return { ok: true as const, sent: userIds.length };
  });
