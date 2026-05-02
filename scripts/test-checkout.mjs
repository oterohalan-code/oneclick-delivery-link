import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' });

// Verifica que un checkout session se cree correctamente con el flujo embedded
const prices = await stripe.prices.list({ lookup_keys: ['wallet_topup_50_price'], limit: 1 });
if (!prices.data.length) { console.log('❌ Price no encontrado'); process.exit(1); }

const session = await stripe.checkout.sessions.create({
  line_items: [{ price: prices.data[0].id, quantity: 1 }],
  mode: 'payment',
  ui_mode: 'embedded_page',
  return_url: 'https://oneclick-delivery-link.lovable.app/app/wallet?checkout=success&session_id={CHECKOUT_SESSION_ID}',
  automatic_tax: { enabled: true },
  metadata: { test: 'true' },
});
console.log('✅ Checkout session creado:', session.id);
console.log('   client_secret:', session.client_secret?.substring(0, 30) + '...');
console.log('   mode:', session.mode, '/ ui_mode:', session.ui_mode);
console.log('   amount_total:', session.amount_total, session.currency);
