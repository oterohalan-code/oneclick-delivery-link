import { loadStripe, type Stripe } from "@stripe/stripe-js";

type StripeEnv = 'sandbox' | 'live';

// Publishable key del usuario (BYOK). Es seguro exponerla en el cliente.
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const environment: StripeEnv = publishableKey?.startsWith('pk_live_') ? 'live' : 'sandbox';

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    if (!publishableKey) {
      throw new Error("VITE_STRIPE_PUBLISHABLE_KEY no está configurada");
    }
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return environment;
}

export function isTestMode(): boolean {
  return environment === 'sandbox';
}
