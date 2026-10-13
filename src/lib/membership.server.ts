import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  expectedCollectorOk,
  getAuthorizedPayment,
  getPayment,
  getPreapproval,
  membershipAmountCents,
  type MpPayment,
} from "@/lib/mercadopago.server";

function pesosToCents(amount: number | undefined): number {
  return Math.round((amount ?? 0) * 100);
}

export async function applyApprovedPayment(payment: MpPayment) {
  if (payment.status !== "approved") {
    return { ok: false as const, reason: "not_approved", status: payment.status };
  }
  if (payment.currency_id !== "MXN") {
    return { ok: false as const, reason: "currency" };
  }
  if (!expectedCollectorOk(payment.collector_id)) {
    return { ok: false as const, reason: "collector_mismatch" };
  }
  const externalReference = payment.external_reference;
  if (!externalReference) {
    return { ok: false as const, reason: "missing_reference" };
  }

  const amountCents = pesosToCents(payment.transaction_amount);
  const roleFromRef = externalReference.startsWith("oc-restaurant-")
    ? "restaurant"
    : externalReference.startsWith("oc-courier-")
      ? "courier"
      : null;
  if (!roleFromRef || !assertAmountMatchesRole(roleFromRef, amountCents)) {
    return { ok: false as const, reason: "amount_mismatch" };
  }
  const paidAt = payment.date_approved ?? payment.date_created ?? new Date().toISOString();
  const preapprovalId =
    typeof payment.point_of_interaction?.transaction_data?.subscription_id === "string"
      ? payment.point_of_interaction.transaction_data.subscription_id
      : null;

  const { data, error } = await supabaseAdmin.rpc("apply_membership_payment", {
    p_provider_payment_id: String(payment.id),
    p_external_reference: externalReference,
    p_amount_cents: amountCents,
    p_currency: "MXN",
    p_paid_at: paidAt,
    p_mp_preapproval_id: preapprovalId,
  });

  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const, result: data };
}

export async function processMercadoPagoResource(topic: string, resourceId: string) {
  if (topic === "payment" || topic === "payments") {
    const payment = await getPayment(resourceId);
    return applyApprovedPayment(payment);
  }

  if (topic === "subscription_authorized_payment") {
    const invoice = await getAuthorizedPayment(resourceId);
    const paymentId = invoice.payment?.id;
    if (!paymentId) return { ok: false as const, reason: "invoice_without_payment" };
    const payment = await getPayment(String(paymentId));
    if (!payment.external_reference && invoice.external_reference) {
      payment.external_reference = invoice.external_reference;
    }
    return applyApprovedPayment(payment);
  }

  if (topic === "subscription_preapproval") {
    const preapproval = await getPreapproval(resourceId);
    const cancelled = preapproval.status === "cancelled" || preapproval.status === "canceled";
    if (!cancelled || !preapproval.external_reference) {
      return { ok: true as const, reason: "preapproval_ignored" };
    }
    await supabaseAdmin
      .from("memberships")
      .update({ auto_renew: false, updated_at: new Date().toISOString() })
      .eq("mp_preapproval_id", preapproval.id);
    return { ok: true as const, reason: "auto_renew_stopped" };
  }

  return { ok: true as const, reason: "topic_ignored" };
}

export function assertAmountMatchesRole(role: "restaurant" | "courier", cents: number): boolean {
  return cents === membershipAmountCents(role);
}
