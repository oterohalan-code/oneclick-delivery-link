import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/lib/rpc/payments.functions";

interface Props {
  priceId: string;
  purpose: "wallet_topup" | "subscription";
  returnUrl?: string;
}

export function StripeEmbeddedCheckout({ priceId, purpose, returnUrl }: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    return await createCheckoutSession({
      data: {
        priceId,
        purpose,
        returnUrl: returnUrl || `${window.location.origin}/app/wallet?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
      },
    });
  };

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
