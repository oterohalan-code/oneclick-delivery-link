import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export const listPosIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ restaurantId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("pos_integrations")
      .select("id, name, active, created_at, last_used_at")
      .eq("restaurant_id", data.restaurantId)
      .order("created_at", { ascending: false });
    if (error) return { ok: false as const, message: error.message, items: [] };
    return { ok: true as const, items: rows ?? [] };
  });

export const createPosIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        restaurantId: z.string().uuid(),
        name: z.string().min(2).max(60).default("POS"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Confirma que el restaurante pertenece al usuario
    const { data: r } = await supabase
      .from("restaurants")
      .select("id")
      .eq("id", data.restaurantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!r) return { ok: false as const, message: "Restaurante no encontrado." };

    const apiKey = `pos_${randomBytes(24).toString("hex")}`;
    const { error } = await supabase.from("pos_integrations").insert({
      restaurant_id: data.restaurantId,
      name: data.name,
      api_key_hash: hashKey(apiKey),
    });
    if (error) return { ok: false as const, message: error.message };
    // La clave en claro se devuelve UNA SOLA VEZ
    return { ok: true as const, apiKey };
  });

export const revokePosIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("pos_integrations")
      .update({ active: false })
      .eq("id", data.id);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });
