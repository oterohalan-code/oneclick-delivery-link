import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' });

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
    console.log(`⏭️  ${p.id}: existe → ${existing.data[0].id}`);
    created[p.id] = { price: existing.data[0].id, product: existing.data[0].product };
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
  console.log(`✅ ${p.id}: ${price.id} ($${p.amount/100} MXN${p.recurring ? '/mes' : ''})`);
  created[p.id] = { price: price.id, product: product.id };
}
console.log('\n📋 Productos listos:');
console.log(JSON.stringify(created, null, 2));
