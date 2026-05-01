import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import type { Database } from "@/integrations/supabase/types";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  const supabase = getSupabase();
  const sessionId = session.id;

  // Look up our recorded session
  const { data: row } = await supabase
    .from("stripe_checkout_sessions")
    .select("*")
    .eq("stripe_session_id", sessionId)
    .eq("environment", env)
    .maybeSingle();

  if (!row) {
    console.error("Webhook: checkout session not found in DB", sessionId);
    return;
  }

  if (row.status === "completed") {
    console.log("Webhook: session already processed", sessionId);
    return; // idempotent
  }

  if (row.purpose === "wallet_topup") {
    // Credit wallet
    const amountMxn = (row.amount_cents as number) / 100;
    const { data: courier } = await supabase
      .from("couriers")
      .select("id, wallet_balance")
      .eq("id", row.courier_id as string)
      .maybeSingle();

    if (!courier) {
      console.error("Webhook: courier not found", row.courier_id);
      return;
    }

    const newBalance = Number(courier.wallet_balance) + amountMxn;
    await supabase.from("couriers").update({ wallet_balance: newBalance }).eq("id", courier.id as string);
    await supabase.from("wallet_transactions").insert({
      courier_id: courier.id,
      type: "topup",
      amount: amountMxn,
      balance_after: newBalance,
      description: `Recarga $${amountMxn} (Stripe)`,
    });
  }
  // Subscription handled by customer.subscription.* events

  await supabase
    .from("stripe_checkout_sessions")
    .update({ status: "completed", processed_at: new Date().toISOString() })
    .eq("stripe_session_id", sessionId);
}

async function handleSubscriptionUpsert(subscription: any, env: StripeEnv) {
  const supabase = getSupabase();
  const userId = subscription.metadata?.userId;
  const courierId = subscription.metadata?.courierId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }

  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.metadata?.lovable_external_id || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await supabase.from("stripe_subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );

  // Sync to existing couriers table
  if (courierId) {
    const isActive = ["active", "trialing"].includes(subscription.status);
    const expiresAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
    await supabase
      .from("couriers")
      .update({
        plan: isActive ? "subscription" : "pps",
        subscription_active: isActive,
        subscription_expires_at: expiresAt,
      })
      .eq("id", courierId);
  }
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  const supabase = getSupabase();
  await supabase
    .from("stripe_subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);

  const courierId = subscription.metadata?.courierId;
  if (courierId) {
    await supabase
      .from("couriers")
      .update({ subscription_active: false, plan: "pps" })
      .eq("id", courierId);
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object, env);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpsert(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook received with invalid or missing env query parameter:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
