import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listZones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("operational_zones")
      .select("*")
      .eq("active", true)
      .order("name");
    if (error) return { ok: false as const, message: error.message, zones: [] };
    return { ok: true as const, zones: data ?? [] };
  });

export const findZoneForPoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ lat: z.number(), lng: z.number() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: zoneId, error } = await supabase.rpc("find_zone_for_point", {
      _lat: data.lat,
      _lng: data.lng,
    });
    if (error) return { ok: false as const, zoneId: null, message: error.message };
    return { ok: true as const, zoneId: (zoneId as string | null) ?? null };
  });

const ZoneInput = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  country_code: z.string().length(2).default("MX"),
  bbox_min_lat: z.number(),
  bbox_max_lat: z.number(),
  bbox_min_lng: z.number(),
  bbox_max_lng: z.number(),
  timezone: z.string().default("America/Mexico_City"),
  base_fee_multiplier: z.number().min(0.5).max(3).default(1),
  active: z.boolean().default(true),
});

export const upsertZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid().optional(), zone: ZoneInput }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) return { ok: false as const, message: "Solo admin." };

    if (data.id) {
      const { error } = await supabase
        .from("operational_zones")
        .update(data.zone)
        .eq("id", data.id);
      if (error) return { ok: false as const, message: error.message };
      return { ok: true as const };
    }
    const { error } = await supabase.from("operational_zones").insert(data.zone);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });
