import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function getUserFromAuth(headers: Headers) {
  const auth = headers.get("authorization") ?? headers.get("Authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7).trim();
  const svc = getServiceClient();
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

/**
 * Devuelve (creando si hace falta) el código de referido del usuario actual,
 * más estadísticas: cuántos referidos completaron y cuánto se ganó.
 */
export const getMyReferral = createServerFn({ method: "GET" })
  .handler(async (ctx) => {
    const user = await getUserFromAuth(ctx.request.headers);
    if (!user) throw new Error("Unauthorized");
    const svc = getServiceClient();

    let { data: row } = await svc
      .from("referrals")
      .select("code, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!row) {
      const { data: codeRes } = await svc.rpc("generate_referral_code");
      const code = (codeRes as string) ?? Math.random().toString(36).slice(2, 8).toUpperCase();
      const { data: created, error } = await svc
        .from("referrals")
        .insert({ user_id: user.id, code })
        .select("code, created_at")
        .single();
      if (error) throw new Error(error.message);
      row = created;
    }

    const { data: invited } = await svc
      .from("referrals")
      .select("user_id, reward_granted, created_at")
      .eq("referred_by_user_id", user.id);

    const total = invited?.length ?? 0;
    const completed = invited?.filter((i: any) => i.reward_granted).length ?? 0;
    const earnings = completed * 50;

    return { code: row!.code, total, completed, earnings };
  });

/**
 * Aplica un código de referido al usuario actual (solo una vez, y solo si
 * no se ha auto-referido). No otorga la recompensa: eso lo hace el trigger
 * cuando el referido (courier) entrega su primer pedido.
 */
export const applyReferralCode = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: z.string().min(3).max(16) }).parse(d))
  .handler(async (ctx) => {
    const user = await getUserFromAuth(ctx.request.headers);
    if (!user) throw new Error("Unauthorized");
    const code = ctx.data.code.trim().toUpperCase();
    const svc = getServiceClient();

    const { data: refRow } = await svc
      .from("referrals")
      .select("user_id, code")
      .eq("code", code)
      .maybeSingle();
    if (!refRow) return { ok: false, error: "Código no válido" };
    if (refRow.user_id === user.id) return { ok: false, error: "No puedes usar tu propio código" };

    // Asegurar que el usuario actual tenga su propio registro y no tenga ya referente
    let { data: own } = await svc
      .from("referrals")
      .select("user_id, referred_by_user_id, code")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!own) {
      const { data: codeRes } = await svc.rpc("generate_referral_code");
      const myCode = (codeRes as string) ?? Math.random().toString(36).slice(2, 8).toUpperCase();
      const { data: created, error } = await svc
        .from("referrals")
        .insert({ user_id: user.id, code: myCode, referred_by_user_id: refRow.user_id })
        .select("user_id, referred_by_user_id, code")
        .single();
      if (error) return { ok: false, error: error.message };
      own = created;
      return { ok: true };
    }

    if (own.referred_by_user_id) return { ok: false, error: "Ya tienes un referente" };

    const { error: upErr } = await svc
      .from("referrals")
      .update({ referred_by_user_id: refRow.user_id })
      .eq("user_id", user.id);
    if (upErr) return { ok: false, error: upErr.message };
    return { ok: true };
  });
