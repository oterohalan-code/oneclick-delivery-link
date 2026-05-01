import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  orderId: z.string().uuid(),
});

export const acceptOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Buscar al courier autenticado
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

    // 2. Validar elegibilidad: suscripción activa o saldo suficiente
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

    // 3. Tomar el pedido (atómico: solo si sigue pending)
    const { data: updated, error: uErr } = await supabase
      .from("orders")
      .update({
        courier_id: courier.id,
        status: "assigned",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", data.orderId)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (uErr) return { ok: false as const, message: uErr.message };
    if (!updated) return { ok: false as const, message: "Otro repartidor ya tomó el pedido." };

    return { ok: true as const, orderId: updated.id };
  });
