import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' });

const WEBHOOK_URL = 'https://oneclick-delivery-link.lovable.app/api/public/payments/webhook?env=live';
const PREVIEW_WEBHOOK_URL = 'https://project--944f0876-4978-49ab-8426-84c1cdc9047f-dev.lovable.app/api/public/payments/webhook?env=live';

const events = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
];

// Production webhook
const existing = await stripe.webhookEndpoints.list({ limit: 100 });
let prodHook = existing.data.find(w => w.url === WEBHOOK_URL);
if (!prodHook) {
  prodHook = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: events,
    description: '1-Click Cancún (producción)',
  });
  console.log(`✅ Webhook PROD creado: ${prodHook.id}`);
  console.log(`   🔑 SECRET: ${prodHook.secret}`);
} else {
  console.log(`⏭️  Webhook PROD ya existe: ${prodHook.id}`);
  console.log(`   (El secret solo se muestra al crear; si lo necesitas, borra y recrea)`);
}

// Preview webhook
let prevHook = existing.data.find(w => w.url === PREVIEW_WEBHOOK_URL);
if (!prevHook) {
  prevHook = await stripe.webhookEndpoints.create({
    url: PREVIEW_WEBHOOK_URL,
    enabled_events: events,
    description: '1-Click Cancún (preview)',
  });
  console.log(`\n✅ Webhook PREVIEW creado: ${prevHook.id}`);
  console.log(`   🔑 SECRET: ${prevHook.secret}`);
} else {
  console.log(`\n⏭️  Webhook PREVIEW ya existe: ${prevHook.id}`);
}

console.log('\n📋 IMPORTANTE: copia el SECRET del webhook PROD (whsec_...) — lo necesitas para el siguiente paso.');
