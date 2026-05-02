import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) { console.error('STRIPE_SECRET_KEY not set'); process.exit(1); }

const stripe = new Stripe(secretKey, { apiVersion: '2026-03-25.dahlia' });
const mode = secretKey.startsWith('sk_live_') ? 'LIVE' : 'TEST';
console.log(`\n🔑 Stripe key: ${mode} mode\n`);

try {
  const account = await stripe.accounts.retrieve();
  console.log(`✅ Account: ${account.id} (${account.country}, ${account.default_currency})`);
  console.log(`   Email: ${account.email}, Charges: ${account.charges_enabled}, Payouts: ${account.payouts_enabled}\n`);
} catch (e) { console.error('❌', e.message); process.exit(1); }

const products = [
  { id: 'wallet_topup_50', name: 'Recarga Monedero $50 MXN', amount: 5000, recurring: false },
  { id: 'wallet_topup_100', name: 'Recarga Monedero $100 MXN', amount: 10000, recurring: false },
  { id: 'wallet_topup_200', name: 'Recarga Monedero $200 MXN', amount: 20000, recurring: false },
  { id: 'wallet_topup_500', name: 'Recarga Monedero $500 MXN', amount: 50000, recurring: false },
  { id: 'courier_subscription_monthly', name: 'Suscripción Repartidor Mensual', amount: 24900, recurring: true },
];

const created = {};
for (const p of products) {
  const lookupKey = `${p.id}_price`;
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  if (existing.data.length > 0) {
    console.log(`⏭️  ${p.id}: already exists (${existing.data[0].id})`);
    created[p.id] = existing.data[0].id;
    continue;
  }
  const product = await stripe.products.create({
    name: p.name,
    metadata: { lovable_external_id: p.id },
    tax_code: 'txcd_10000000',
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: p.amount,
    currency: 'mxn',
    lookup_key: lookupKey,
    ...(p.recurring && { recurring: { interval: 'month' } }),
    metadata: { lovable_external_id: lookupKey },
  });
  console.log(`✅ ${p.id}: ${price.id} ($${p.amount/100} MXN${p.recurring ? '/mo' : ''})`);
  created[p.id] = price.id;
}
console.log('\n📋 Price IDs:', JSON.stringify(created, null, 2));
