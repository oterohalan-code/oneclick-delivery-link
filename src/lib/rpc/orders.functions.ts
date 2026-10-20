import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hasActiveMembership } from "@/lib/membership-access.server";
import { computeOrderMoney, type PaymentMode } from "@/lib/order-money";
import { googleMapsDirectionsUrl } from "@/lib/maps";
import type { OrderFlow } from "@/lib/order-flow";

const InputSchema = z.object({
  orderId: z.string().uuid(),
});

const CreateOrderSchema = z.object({
  dropoff_address: z.string().trim().min(5).max(300),
  dropoff_lat: z.number(),
  dropoff_lng: z.number(),
  customer_name: z.string().trim().min(2).max(80),
  customer_phone: z.string().regex(/^\d{10}$/),
  foodMxn: z.number().min(0).max(100000),
  shippingMxn: z.number().min(0).max(100000),
  distanceKm: z.number().nullable(),
  notes: z.string().trim().max(500).optional(),
  paymentMode: z.enum(["prepaid_at_restaurant", "collect_on_delivery"]),
});

export const createRestaurantOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (!(await hasActiveMembership(userId, "restaurant"))) {
      return { ok: false as const, message: "Necesitas membresía activa para pedir repartidor." };
    }

    const { data: rest } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, address, lat, lng, user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!rest) return { ok: false as const, message: "Restaurante no encontrado." };

    const money = computeOrderMoney({
      mode: data.paymentMode as PaymentMode,
      foodMxn: data.foodMxn,
      shippingMxn: data.shippingMxn,
    });

    const { data: inserted, error } = await supabaseAdmin
      .from("orders")
      .insert({
        restaurant_id: rest.id,
        pickup_address: rest.address,
        pickup_lat: rest.lat,
        pickup_lng: rest.lng,
        dropoff_address: data.dropoff_address,
        dropoff_lat: data.dropoff_lat,
        dropoff_lng: data.dropoff_lng,
        amount_to_collect: money.amount_to_collect,
        shipping_fee: data.shippingMxn,
        distance_km: data.distanceKm,
        notes: data.notes ?? null,
        customer_name: data.customer_name,
        customer_phone: `+52${data.customer_phone}`,
        customer_phone_dial_code: "+52",
        status: "pending",
        payment_mode: money.payment_mode,
        food_amount_cents: money.food_amount_cents,
        shipping_amount_cents: money.shipping_amount_cents,
        advance_due_cents: money.advance_due_cents,
        restaurant_pays_shipping_cents: money.restaurant_pays_shipping_cents,
        collect_on_delivery_cents: money.collect_on_delivery_cents,
      })
      .select("id")
      .maybeSingle();

    if (error || !inserted) {
      return { ok: false as const, message: error?.message ?? "No se pudo crear el pedido." };
    }
    return { ok: true as const, orderId: inserted.id };
  });

export const acceptOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: rpc, error: rpcErr } = await supabaseAdmin.rpc("accept_order_for_courier", {
      _order_id: data.orderId,
      _user_id: userId,
    });

    if (rpcErr) return { ok: false as const, message: rpcErr.message };
    const result = rpc as { ok?: boolean; reason?: string; order_id?: string; restaurant_id?: string } | null;
    if (!result?.ok) {
      const reason = result?.reason;
      const message =
        reason === "membership_required"
          ? "Necesitas membresía activa para aceptar pedidos."
          : reason === "already_taken"
            ? "Otro repartidor ya tomó el pedido."
            : reason === "courier_inactive"
              ? "Tu cuenta aún no está activa."
              : "No se pudo aceptar el pedido.";
      return { ok: false as const, message };
    }

    const updated = { id: result.order_id, restaurant_id: result.restaurant_id };

    // Notificar al restaurante (best-effort)
    try {
      const { data: rest } = await supabaseAdmin
        .from("restaurants")
        .select("user_id, name")
        .eq("id", updated.restaurant_id as string)
        .maybeSingle();
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      if (rest?.user_id) {
        const { sendPushToUsers } = await import("@/server/push.server");
        await sendPushToUsers([rest.user_id], {
          title: "🛵 ¡Pedido aceptado!",
          body: `${prof?.full_name ?? "Un repartidor"} viene por tu pedido.`,
          url: "/app",
        });
        // Email best-effort
        try {
          const { data: userRow } = await supabaseAdmin.auth.admin.getUserById(rest.user_id);
          const email = userRow?.user?.email;
          if (email) {
            const { enqueueTransactionalEmail } = await import("@/server/email.server");
            await enqueueTransactionalEmail({
              templateName: "order-accepted",
              recipientEmail: email,
              idempotencyKey: `order-accepted-${updated.id}`,
              templateData: {
                restaurantName: rest.name,
                courierName: prof?.full_name ?? "Un repartidor",
                orderShortId: String(updated.id).slice(0, 6).toUpperCase(),
              },
            });
          }
        } catch (e) { console.warn("[acceptOrder] email failed", e); }
      }
    } catch (e) {
      console.warn("[acceptOrder] notify failed", e);
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
      courierId: order.courier_id as string,
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

    // Verificar que el usuario es el courier asignado al pedido
    const { data: orderCheck } = await supabaseAdmin
      .from("orders")
      .select("courier_id, status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!orderCheck) return { ok: false as const, message: "Pedido no encontrado." };
    if (!orderCheck.courier_id) return { ok: false as const, message: "Pedido sin repartidor asignado." };

    const { data: ownerCheck } = await supabaseAdmin
      .from("couriers")
      .select("user_id")
      .eq("id", orderCheck.courier_id)
      .maybeSingle();
    if (!ownerCheck || ownerCheck.user_id !== userId) {
      return { ok: false as const, message: "No autorizado: este pedido no es tuyo." };
    }

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
        .select("user_id, name")
        .eq("id", updated.restaurant_id)
        .maybeSingle();
      if (rest?.user_id) {
        const { sendPushToUsers } = await import("@/server/push.server");
        await sendPushToUsers([rest.user_id], {
          title: data.status === "in_transit" ? "🚚 Pedido en camino" : "✅ Pedido entregado",
          body:
            data.status === "in_transit"
              ? "El repartidor va camino al cliente."
              : "Tu pedido fue entregado.",
          url: "/app",
        });
        try {
          const { data: userRow } = await supabaseAdmin.auth.admin.getUserById(rest.user_id);
          const email = userRow?.user?.email;
          if (email) {
            const { enqueueTransactionalEmail } = await import("@/server/email.server");
            const tpl = data.status === "in_transit" ? "order-in-transit" : "order-delivered";
            await enqueueTransactionalEmail({
              templateName: tpl,
              recipientEmail: email,
              idempotencyKey: `${tpl}-${updated.id}`,
              templateData: {
                restaurantName: rest.name,
                orderShortId: String(updated.id).slice(0, 6).toUpperCase(),
              },
            });
          }
        } catch (e) { console.warn("[setOrderStatus] email failed", e); }
      }
    } catch (e) {
      console.warn("[setOrderStatus] notify failed", e);
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
          const { sendPushToUsers } = await import("@/server/push.server");
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
      .select("user_id, subscription_active, subscription_expires_at, status");
    const eligible = (couriers ?? []).filter((c) => {
      if (c.status !== "active") return false;
      return (
        !!c.subscription_active &&
        !!c.subscription_expires_at &&
        new Date(c.subscription_expires_at).getTime() > Date.now()
      );
    });

    const userIds = eligible.map((c) => c.user_id);
    if (!userIds.length) return { ok: true as const, sent: 0 };

    try {
      const { sendPushToUsers } = await import("@/server/push.server");
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

const FlowActionSchema = z.object({
  orderId: z.string().uuid(),
  action: z.enum([
    "restaurant_first_sent",
    "restaurant_second_sent",
    "courier_first_saved",
    "courier_second_saved",
    "courier_checks",
    "courier_incident",
  ]),
  productReceived: z.boolean().optional(),
  advancePaid: z.boolean().optional(),
  foodDelivered: z.boolean().optional(),
  cashCollected: z.boolean().optional(),
  incidentNote: z.string().trim().max(300).optional(),
  linkUrl: z.string().trim().max(500).optional(),
});

function savedMapsUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function stamp(on: boolean | undefined, previous: string | undefined): string | undefined {
  if (on === undefined) return previous;
  if (!on) return undefined;
  return previous ?? new Date().toISOString();
}

export const recordOrderFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => FlowActionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: order, error: loadError } = await supabaseAdmin
      .from("orders")
      .select("id, status, restaurant_id, courier_id, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, flow")
      .eq("id", data.orderId)
      .maybeSingle();
    if (loadError) {
      const missing = /flow/i.test(loadError.message);
      return {
        ok: false as const,
        message: missing
          ? "Falta aplicar la migración del flujo del pedido."
          : loadError.message,
      };
    }
    if (!order) return { ok: false as const, message: "Pedido no encontrado." };

    const { data: rest } = await supabaseAdmin
      .from("restaurants")
      .select("user_id")
      .eq("id", order.restaurant_id)
      .maybeSingle();
    const isRestaurant = rest?.user_id === userId;

    let isCourier = false;
    if (order.courier_id) {
      const { data: courier } = await supabaseAdmin
        .from("couriers")
        .select("user_id")
        .eq("id", order.courier_id)
        .maybeSingle();
      isCourier = courier?.user_id === userId;
    }
    if (!isRestaurant && !isCourier) return { ok: false as const, message: "No autorizado." };

    const current = (order.flow && typeof order.flow === "object" && !Array.isArray(order.flow)
      ? order.flow
      : {}) as OrderFlow;
    const next: OrderFlow = { ...current };
    const pickupUrl = googleMapsDirectionsUrl({
      lat: order.pickup_lat,
      lng: order.pickup_lng,
      address: order.pickup_address,
    });
    const dropoffUrl = googleMapsDirectionsUrl({
      lat: order.dropoff_lat,
      lng: order.dropoff_lng,
      address: order.dropoff_address,
    });

    if (data.action === "restaurant_first_sent" || data.action === "restaurant_second_sent") {
      if (!isRestaurant) return { ok: false as const, message: "Solo el restaurante puede confirmar el envío." };
      if (data.action === "restaurant_first_sent") {
        if (order.status !== "assigned") return { ok: false as const, message: "El repartidor todavía no acepta el pedido." };
        next.restaurantFirstSentAt = current.restaurantFirstSentAt ?? new Date().toISOString();
        next.restaurantFirstUrl = pickupUrl ?? undefined;
      } else {
        if (order.status !== "in_transit") return { ok: false as const, message: "El pedido todavía no va en camino." };
        next.restaurantSecondSentAt = current.restaurantSecondSentAt ?? new Date().toISOString();
        next.restaurantSecondUrl = dropoffUrl ?? undefined;
      }
    } else {
      if (!isCourier) return { ok: false as const, message: "Solo el repartidor asignado puede registrar esto." };
      if (data.action === "courier_first_saved") {
        if (order.status !== "assigned") return { ok: false as const, message: "Esta liga es para la recogida." };
        next.courierFirstSavedAt = current.courierFirstSavedAt ?? new Date().toISOString();
        next.courierFirstUrl = savedMapsUrl(data.linkUrl) ?? current.restaurantFirstUrl ?? pickupUrl ?? undefined;
      } else if (data.action === "courier_second_saved") {
        if (order.status !== "in_transit") return { ok: false as const, message: "Esta liga es para la entrega." };
        next.courierSecondSavedAt = current.courierSecondSavedAt ?? new Date().toISOString();
        next.courierSecondUrl = savedMapsUrl(data.linkUrl) ?? current.restaurantSecondUrl ?? dropoffUrl ?? undefined;
      } else if (data.action === "courier_checks") {
        if (order.status === "assigned") {
          next.productReceivedAt = stamp(data.productReceived, current.productReceivedAt);
          next.advancePaidAt = stamp(data.advancePaid, current.advancePaidAt);
          if (!next.productReceivedAt) delete next.productReceivedAt;
          if (!next.advancePaidAt) delete next.advancePaidAt;
        } else if (order.status === "in_transit") {
          next.foodDeliveredAt = stamp(data.foodDelivered, current.foodDeliveredAt);
          next.cashCollectedAt = stamp(data.cashCollected, current.cashCollectedAt);
          if (!next.foodDeliveredAt) delete next.foodDeliveredAt;
          if (!next.cashCollectedAt) delete next.cashCollectedAt;
        } else {
          return { ok: false as const, message: "El pedido no está en recogida ni en entrega." };
        }
      } else if (data.action === "courier_incident") {
        const note = data.incidentNote?.trim();
        if (!note) return { ok: false as const, message: "Escribe qué pasó." };
        next.incidentNote = note;
        next.incidentAt = new Date().toISOString();
      }
    }

    const { error: saveError } = await supabaseAdmin
      .from("orders")
      .update({ flow: next as never })
      .eq("id", order.id);
    if (saveError) {
      const missing = /flow/i.test(saveError.message);
      return {
        ok: false as const,
        message: missing ? "Falta aplicar la migración del flujo del pedido." : saveError.message,
      };
    }
    return { ok: true as const, flow: next };
  });
