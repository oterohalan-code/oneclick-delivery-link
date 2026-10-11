import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    priceId: string;
    returnUrl: string;
    environment: StripeEnv;
    purpose: "wallet_topup" | "subscription";
  }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    if (data.purpose !== "wallet_topup" && data.purpose !== "subscription") {
      throw new Error("Invalid purpose");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const stripe = createStripeClient(data.environment);

    // Get courier id + email
    const { data: courier } = await supabaseAdmin
      .from("couriers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!courier) throw new Error("Courier profile not found");

    const { data: userResp } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userResp?.user?.email ?? undefined;

    // Resolve price via lookup_keys
    const prices = await stripe.prices.list({ lookup_keys: [data.priceId], expand: ["data.product"] });
    if (!prices.data.length) throw new Error("Price not found");
    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";

    if (data.purpose === "subscription" && !isRecurring) {
      throw new Error("Price is not recurring");
    }
    if (data.purpose === "wallet_topup" && isRecurring) {
      throw new Error("Price is recurring");
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      automatic_tax: { enabled: true },
      ...(email && { customer_email: email }),
      metadata: {
        userId,
        courierId: courier.id,
        purpose: data.purpose,
        priceId: data.priceId,
      },
      ...(isRecurring && {
        subscription_data: {
          metadata: { userId, courierId: courier.id, priceId: data.priceId },
        },
      }),
    });

    // Record session for idempotent webhook processing
    await supabaseAdmin.from("stripe_checkout_sessions").insert({
      stripe_session_id: session.id,
      user_id: userId,
      courier_id: courier.id,
      price_id: data.priceId,
      amount_cents: stripePrice.unit_amount ?? 0,
      currency: stripePrice.currency,
      purpose: data.purpose,
      environment: data.environment,
    });

    if (!session.client_secret) throw new Error("No client_secret returned");
    return session.client_secret;
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => {
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: sub } = await supabaseAdmin
      .from("stripe_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_customer_id) throw new Error("No subscription found");

    const stripe = createStripeClient(data.environment);
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      ...(data.returnUrl && { return_url: data.returnUrl }),
    });
    return portal.url;
  });
