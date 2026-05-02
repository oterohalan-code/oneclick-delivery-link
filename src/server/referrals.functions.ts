import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Returns (creating if needed) the current user's referral code, plus stats:
 * how many invitees they have, how many activated, and total earnings.
 */
export const getMyReferral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    let { data: row } = await supabaseAdmin
      .from("referrals")
      .select("code")
      .eq("user_id", userId)
      .maybeSingle();

    if (!row) {
      const { data: codeRes } = await supabaseAdmin.rpc("generate_referral_code");
      const code = (codeRes as string) ?? Math.random().toString(36).slice(2, 8).toUpperCase();
      const { data: created, error } = await supabaseAdmin
        .from("referrals")
        .insert({ user_id: userId, code })
        .select("code")
        .single();
      if (error) throw new Error(error.message);
      row = created;
    }

    const { data: invited } = await supabaseAdmin
      .from("referrals")
      .select("user_id, reward_granted")
      .eq("referred_by_user_id", userId);

    const total = invited?.length ?? 0;
    const completed = invited?.filter((i: any) => i.reward_granted).length ?? 0;
    const earnings = completed * 50;

    return { code: row!.code, total, completed, earnings };
  });

/**
 * Apply a referral code to the current user (only once, can't self-refer).
 * Reward is granted automatically by DB trigger when the invitee (a courier)
 * completes their first delivery.
 */
export const applyReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().min(3).max(16) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const code = data.code.trim().toUpperCase();

    const { data: refRow } = await supabaseAdmin
      .from("referrals")
      .select("user_id")
      .eq("code", code)
      .maybeSingle();
    if (!refRow) return { ok: false as const, error: "Código no válido" };
    if (refRow.user_id === userId) return { ok: false as const, error: "No puedes usar tu propio código" };

    let { data: own } = await supabaseAdmin
      .from("referrals")
      .select("user_id, referred_by_user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!own) {
      const { data: codeRes } = await supabaseAdmin.rpc("generate_referral_code");
      const myCode = (codeRes as string) ?? Math.random().toString(36).slice(2, 8).toUpperCase();
      const { error } = await supabaseAdmin
        .from("referrals")
        .insert({ user_id: userId, code: myCode, referred_by_user_id: refRow.user_id });
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const };
    }

    if (own.referred_by_user_id) return { ok: false as const, error: "Ya tienes un referente" };

    const { error: upErr } = await supabaseAdmin
      .from("referrals")
      .update({ referred_by_user_id: refRow.user_id })
      .eq("user_id", userId);
    if (upErr) return { ok: false as const, error: upErr.message };
    return { ok: true as const };
  });
