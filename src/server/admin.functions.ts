import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Unauthorized");
}

export const getAdminFinance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { days?: number }) => ({
    days: data?.days && data.days > 0 && data.days <= 365 ? data.days : 30,
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();

    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id,status,shipping_fee,amount_to_collect,distance_km,courier_id,restaurant_id,created_at,delivered_at")
      .gte("created_at", since);

    const list = orders ?? [];
    const delivered = list.filter((o: any) => o.status === "delivered");
    const totalShipping = delivered.reduce((s: number, o: any) => s + Number(o.shipping_fee || 0), 0);
    const totalCollected = delivered.reduce((s: number, o: any) => s + Number(o.amount_to_collect || 0), 0);
    // Comisión PPS estimada: $20 por pedido entregado para couriers sin suscripción activa
    const { data: couriers } = await supabaseAdmin
      .from("couriers")
      .select("id,plan,subscription_active,wallet_balance,stats_score,user_id");
    const couriersMap: Record<string, any> = {};
    (couriers ?? []).forEach((c: any) => { couriersMap[c.id] = c; });
    let commissionEstimate = 0;
    delivered.forEach((o: any) => {
      const c = o.courier_id ? couriersMap[o.courier_id] : null;
      if (c && !c.subscription_active) commissionEstimate += 20;
    });

    // Top restaurantes
    const restAgg: Record<string, { count: number; revenue: number }> = {};
    delivered.forEach((o: any) => {
      const r = o.restaurant_id;
      if (!r) return;
      restAgg[r] = restAgg[r] || { count: 0, revenue: 0 };
      restAgg[r].count++;
      restAgg[r].revenue += Number(o.shipping_fee || 0);
    });
    const restIds = Object.keys(restAgg).slice(0, 50);
    const { data: rests } = await supabaseAdmin
      .from("restaurants").select("id,name").in("id", restIds.length ? restIds : ["00000000-0000-0000-0000-000000000000"]);
    const restNames: Record<string, string> = {};
    (rests ?? []).forEach((r: any) => { restNames[r.id] = r.name; });
    const topRestaurants = Object.entries(restAgg)
      .map(([id, v]) => ({ id, name: restNames[id] ?? "—", count: v.count, revenue: v.revenue }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top couriers
    const courAgg: Record<string, { count: number; revenue: number }> = {};
    delivered.forEach((o: any) => {
      const c = o.courier_id;
      if (!c) return;
      courAgg[c] = courAgg[c] || { count: 0, revenue: 0 };
      courAgg[c].count++;
      courAgg[c].revenue += Number(o.shipping_fee || 0);
    });
    const courUserIds = Object.keys(courAgg)
      .map((id) => couriersMap[id]?.user_id)
      .filter(Boolean);
    const { data: profs } = await supabaseAdmin
      .from("profiles").select("id,full_name").in("id", courUserIds.length ? courUserIds : ["00000000-0000-0000-0000-000000000000"]);
    const profNames: Record<string, string> = {};
    (profs ?? []).forEach((p: any) => { profNames[p.id] = p.full_name; });
    const topCouriers = Object.entries(courAgg)
      .map(([id, v]) => {
        const c = couriersMap[id];
        return {
          id,
          name: c?.user_id ? profNames[c.user_id] ?? "—" : "—",
          count: v.count,
          revenue: v.revenue,
          score: c?.stats_score ?? null,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      days: data.days,
      totals: {
        ordersCreated: list.length,
        ordersDelivered: delivered.length,
        ordersCancelled: list.filter((o: any) => o.status === "cancelled").length,
        totalShipping: Math.round(totalShipping * 100) / 100,
        totalCollected: Math.round(totalCollected * 100) / 100,
        commissionEstimate: Math.round(commissionEstimate * 100) / 100,
        activeCouriers: (couriers ?? []).filter((c: any) => c.subscription_active).length,
        totalCouriers: (couriers ?? []).length,
      },
      topRestaurants,
      topCouriers,
    };
  });

export const adminCancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string; reason: string }) =>
    z.object({ orderId: z.string().uuid(), reason: z.string().min(3).max(500) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        status: "cancelled",
        notes: `[ADMIN CANCEL: ${data.reason}]`,
      })
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUnassignOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string }) =>
    z.object({ orderId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "pending", courier_id: null, accepted_at: null, picked_up_at: null })
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTestAuthEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; type: "signup" | "magiclink" | "recovery" }) =>
    z.object({
      email: z.string().email(),
      type: z.enum(["signup", "magiclink", "recovery"]),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const siteUrl = process.env.VITE_SUPABASE_URL ? undefined : undefined;
    const redirectTo = process.env.PUBLIC_SITE_URL || undefined;

    if (data.type === "signup") {
      // Genera enlace de invitación (envía email de confirmación tipo signup)
      const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email: data.email,
        options: redirectTo ? { redirectTo } : undefined,
      });
      if (error) throw new Error(`signup: ${error.message}`);
      return { ok: true, type: data.type, action_link: link?.properties?.action_link ?? null };
    }

    if (data.type === "magiclink") {
      const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: data.email,
        options: redirectTo ? { redirectTo } : undefined,
      });
      if (error) throw new Error(`magiclink: ${error.message}`);
      return { ok: true, type: data.type, action_link: link?.properties?.action_link ?? null };
    }

    // recovery
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
      options: redirectTo ? { redirectTo } : undefined,
    });
    if (error) throw new Error(`recovery: ${error.message}`);
    return { ok: true, type: data.type, action_link: link?.properties?.action_link ?? null };
  });

const ADMIN_DOMAIN = "@punchingsolutions.com.mx";

/**
 * Promueve al usuario autenticado a admin si:
 *  - su email termina en @punchingsolutions.com.mx
 *  - su correo está confirmado
 *  - aún no tiene rol asignado
 * Recibe el access_token explícitamente para evitar problemas de
 * propagación de headers en llamadas fuera de componentes React.
 */
export const claimAdminRole = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string }) =>
    z.object({ accessToken: z.string().min(10) }).parse(data),
  )
  .handler(async ({ data }) => {
    // Validar token y obtener user
    const { data: userRes, error: uErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (uErr || !userRes?.user) return { promoted: false, reason: "invalid_token" };

    const userId = userRes.user.id;
    const email = (userRes.user.email ?? "").toLowerCase().trim();
    const confirmed = !!userRes.user.email_confirmed_at;

    if (!email.endsWith(ADMIN_DOMAIN)) {
      return { promoted: false, reason: "domain_not_allowed" };
    }
    if (!confirmed) {
      return { promoted: false, reason: "email_not_confirmed" };
    }

    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (existing) return { promoted: true, reason: "already_admin" };

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (insErr) return { promoted: false, reason: insErr.message };

    return { promoted: true };
  });

