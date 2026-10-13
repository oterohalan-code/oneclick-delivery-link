import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { applyApprovedPayment } from "@/lib/membership.server";
import {
  cancelPreapproval,
  checkoutUrl,
  createCheckoutPreference,
  createPendingPreapproval,
  membershipAmountCents,
  membershipAmountMxn,
  publicAppUrl,
  searchPaymentsByReference,
  type MembershipMode,
  type MembershipRole,
} from "@/lib/mercadopago.server";
import { BUSINESS } from "@/lib/business";

const RoleSchema = z.enum(["restaurant", "courier"]);
const ModeSchema = z.enum(["manual", "auto"]);

function titleFor(role: MembershipRole, mode: MembershipMode): string {
  const who = role === "restaurant" ? "restaurante" : "repartidor";
  const kind = mode === "auto" ? "renovación automática" : "periodo";
  return `Membresía One Click ${who} — ${kind}`;
}

function requestOrigin(): string | undefined {
  try {
    const request = getRequest();
    const url = new URL(request.url);
    const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
    if (!host) return undefined;
    return `${proto}://${host}`;
  } catch {
    return undefined;
  }
}

function newExternalReference(role: MembershipRole): string {
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `oc-${role}-${rand}`;
}

async function requireRole(userId: string, requested: MembershipRole): Promise<MembershipRole> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", requested)
    .maybeSingle();
  if (!data) throw new Error("Esta membresía no corresponde a tu cuenta.");
  return requested;
}

export const getMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ role: RoleSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const role = await requireRole(context.userId, data.role);
    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("*")
      .eq("user_id", context.userId)
      .eq("role", role)
      .maybeSingle();

    const { data: pendingIntent } = await supabaseAdmin
      .from("membership_intents")
      .select("external_reference, status")
      .eq("user_id", context.userId)
      .eq("role", role)
      .in("status", ["created", "redirected"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingIntent?.external_reference && process.env.MERCADOPAGO_ACCESS_TOKEN) {
      try {
        const found = await searchPaymentsByReference(pendingIntent.external_reference);
        const approved = found.find((payment) => payment.status === "approved");
        if (approved) await applyApprovedPayment(approved);
      } catch (err) {
        console.error("membership reconcile", err);
      }
    }

    const { data: refreshed } = pendingIntent
      ? await supabaseAdmin
          .from("memberships")
          .select("*")
          .eq("user_id", context.userId)
          .eq("role", role)
          .maybeSingle()
      : { data: membership };

    const current = refreshed ?? membership;

    const { data: payments } = await supabaseAdmin
      .from("membership_payments")
      .select("id, amount_cents, currency, status, paid_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(12);

    const now = Date.now();
    const periodEnd = current?.current_period_end ? new Date(current.current_period_end).getTime() : 0;
    const active = current?.status === "active" && periodEnd > now;

    return {
      role,
      amountMxn: membershipAmountMxn(role),
      currency: "MXN",
      city: BUSINESS.coverageLabel,
      active,
      status: active ? "active" : (current?.status ?? "inactive"),
      autoRenew: !!current?.auto_renew,
      periodStart: current?.current_period_start ?? null,
      periodEnd: current?.current_period_end ?? null,
      payments: payments ?? [],
    };
  });

export const createMembershipCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ role: RoleSchema, mode: ModeSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const role = await requireRole(context.userId, data.role);
    const amountCents = membershipAmountCents(role);
    const amountMxn = membershipAmountMxn(role);

    const { data: existing } = await supabaseAdmin
      .from("memberships")
      .select("auto_renew, mp_preapproval_id, status, current_period_end")
      .eq("user_id", context.userId)
      .eq("role", role)
      .maybeSingle();

    if (data.mode === "auto" && existing?.auto_renew && existing.mp_preapproval_id) {
      return { ok: false as const, message: "Ya tienes renovación automática activa." };
    }

    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = userRes?.user?.email;
    if (!email) return { ok: false as const, message: "Tu cuenta no tiene correo para Mercado Pago." };

    const origin = requestOrigin() ?? publicAppUrl();
    const externalReference = newExternalReference(role);
    const backUrl = `${origin}/app/wallet?checkout=pending&ref=${encodeURIComponent(externalReference)}`;

    const { data: intent, error: intentError } = await supabaseAdmin
      .from("membership_intents")
      .insert({
        user_id: context.userId,
        role,
        mode: data.mode,
        amount_cents: amountCents,
        currency: "MXN",
        external_reference: externalReference,
        status: "created",
      })
      .select("id")
      .maybeSingle();

    if (intentError || !intent) {
      return { ok: false as const, message: intentError?.message ?? "No se pudo crear el intento de pago." };
    }

    try {
      if (data.mode === "manual") {
        const preference = await createCheckoutPreference({
          title: titleFor(role, "manual"),
          amountMxn,
          externalReference,
          payerEmail: email,
          backUrl,
        });
        const url = checkoutUrl(preference);
        if (!url) throw new Error("Mercado Pago no devolvió URL de pago.");
        await supabaseAdmin
          .from("membership_intents")
          .update({ mp_preference_id: preference.id, status: "redirected" })
          .eq("id", intent.id);
        return { ok: true as const, checkoutUrl: url, externalReference };
      }

      const preapproval = await createPendingPreapproval({
        reason: titleFor(role, "auto"),
        amountMxn,
        externalReference,
        payerEmail: email,
        backUrl,
      });
      const url = checkoutUrl(preapproval);
      if (!url) throw new Error("Mercado Pago no devolvió URL de suscripción.");
      await supabaseAdmin
        .from("membership_intents")
        .update({ mp_preapproval_id: preapproval.id, status: "redirected" })
        .eq("id", intent.id);
      return { ok: true as const, checkoutUrl: url, externalReference };
    } catch (err) {
      await supabaseAdmin.from("membership_intents").update({ status: "failed" }).eq("id", intent.id);
      return { ok: false as const, message: err instanceof Error ? err.message : "No se pudo abrir Mercado Pago." };
    }
  });

export const cancelMembershipRenewal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ role: RoleSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const role = await requireRole(context.userId, data.role);
    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("id, mp_preapproval_id, current_period_end")
      .eq("user_id", context.userId)
      .eq("role", role)
      .maybeSingle();

    if (!membership) return { ok: false as const, message: "No hay membresía que cancelar." };

    if (membership.mp_preapproval_id) {
      try {
        await cancelPreapproval(membership.mp_preapproval_id);
      } catch (err) {
        return { ok: false as const, message: err instanceof Error ? err.message : "No se pudo cancelar en Mercado Pago." };
      }
    }

    await supabaseAdmin
      .from("memberships")
      .update({ auto_renew: false, updated_at: new Date().toISOString() })
      .eq("id", membership.id);

    return {
      ok: true as const,
      periodEnd: membership.current_period_end,
    };
  });
