import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' });
const tests = [
  ['products.list', () => stripe.products.list({ limit: 1 })],
  ['prices.list', () => stripe.prices.list({ limit: 1 })],
  ['customers.list', () => stripe.customers.list({ limit: 1 })],
  ['products.create (test)', () => stripe.products.create({ name: '__perm_test__', metadata: { delete_me: '1' } })],
  ['webhookEndpoints.list', () => stripe.webhookEndpoints.list({ limit: 1 })],
];
for (const [name, fn] of tests) {
  try { await fn(); console.log(`✅ ${name}`); }
  catch (e) { console.log(`❌ ${name}: ${e.message.split('.')[0]}`); }
}
// Cleanup test product
try {
  const test = await stripe.products.list({ limit: 100 });
  for (const p of test.data) {
    if (p.name === '__perm_test__') await stripe.products.del(p.id).catch(() => {});
  }
} catch {}
