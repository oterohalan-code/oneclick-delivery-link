import Stripe from 'stripe';

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

// Mantenemos el tipo por compatibilidad con el resto del código,
// pero ahora ambos valores apuntan a la MISMA cuenta (la del usuario).
export type StripeEnv = 'sandbox' | 'live';

/**
 * Crea un cliente Stripe usando la API key directa del usuario (BYOK).
 * Ya NO se usa el gateway de Lovable.
 *
 * Detecta automáticamente si la key es de test (sk_test_) o live (sk_live_).
 * El parámetro `env` se ignora — siempre se usa la misma key configurada.
 */
export function createStripeClient(_env: StripeEnv): Stripe {
  const secretKey = getEnv('STRIPE_SECRET_KEY');

  return new Stripe(secretKey, {
    apiVersion: '2026-03-25.dahlia',
  });
}

/**
 * Devuelve si la key configurada es de modo test o live.
 */
export function getStripeMode(): StripeEnv {
  const secretKey = process.env.STRIPE_SECRET_KEY ?? '';
  return secretKey.startsWith('sk_live_') ? 'live' : 'sandbox';
}

/**
 * Verifica la firma de un webhook de Stripe usando HMAC-SHA256.
 * Usa STRIPE_WEBHOOK_SECRET (único — el mismo para test y live, según
 * la cuenta conectada).
 */
export async function verifyWebhook(
  req: Request,
  _env: StripeEnv
): Promise<{ type: string; data: { object: any } }> {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();
  const secret = getEnv('STRIPE_WEBHOOK_SECRET');

  if (!signature || !body) {
    throw new Error('Missing signature or body');
  }

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(',')) {
    const [key, value] = part.split('=', 2);
    if (key === 't') timestamp = value;
    if (key === 'v1') v1Signatures.push(value);
  }

  if (!timestamp || v1Signatures.length === 0) {
    throw new Error('Invalid signature format');
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) {
    throw new Error('Webhook timestamp too old');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${body}`)
  );
  const expected = Buffer.from(new Uint8Array(signed)).toString('hex');

  if (!v1Signatures.includes(expected)) {
    throw new Error('Invalid webhook signature');
  }

  return JSON.parse(body) as { type: string; data: { object: any } };
}
