## Contexto

Tu cuenta Stripe ya está 100% activada para pagos reales (los 5 pasos de Go-Live completados). Las claves live están configuradas en el proyecto. **No necesitas cambiar ninguna API key manualmente.**

Lo que falta es asegurar que el flujo en producción esté limpio y verificable.

## Cambios a realizar

### 1. Reforzar el banner de modo Test (`PaymentTestModeBanner.tsx`)
Asegurar que el banner naranja "Pagos en modo prueba" sólo aparezca en preview/sandbox y nunca en `oneclick-delivery-link.lovable.app` (producción). Ya está implementado correctamente — solo verificar.

### 2. Añadir indicador discreto de modo en la pantalla de Wallet
En `src/routes/app.wallet.tsx`, mostrar un badge pequeño:
- **"Modo prueba"** (naranja) cuando se use `pk_test_`
- **"Pagos reales"** (verde) cuando se use `pk_live_`

Esto te ayuda a identificar visualmente en qué entorno estás operando.

### 3. Verificar configuración de webhooks live
Confirmar mediante consulta a Supabase que las tablas `stripe_subscriptions` y `wallet_transactions` están listas para recibir eventos del webhook live (`?env=live`). Probablemente ya lo están, pero validamos.

### 4. Documentar cómo cambiar de cuenta Stripe en el futuro (si algún día lo necesitas)
Si en el futuro quieres conectar **otra cuenta Stripe distinta** (no la actual de Punching Solutions), las opciones son:

- **Opción A (recomendada)**: Contactar soporte de Lovable para reasignar la integración nativa a otra cuenta.
- **Opción B (BYOK)**: Migrar a la integración Bring-Your-Own-Key con tu propia `sk_live_...`. Esto requiere:
  - Desconectar la integración nativa actual
  - Reconfigurar webhooks manualmente en el dashboard de Stripe
  - Añadir secret `STRIPE_SECRET_KEY`
  - Reescribir `src/lib/stripe.server.ts` para usar el SDK directo en lugar del gateway
  - Recrear todos los productos en la nueva cuenta

Esta opción **no se ejecutará** en este plan — solo queda documentada por si la necesitas más adelante.

## Lo que NO se va a hacer

- ❌ Cambiar/rotar las API keys actuales (ya están correctas y activas)
- ❌ Migrar a BYOK Stripe (la integración nativa es superior)
- ❌ Recrear productos (ya existen y se sincronizan auto a live)

## Pregunta para ti

¿Es esto lo que necesitas, o tu intención era específicamente **conectar una cuenta Stripe DISTINTA** a la de Punching Solutions que ya está activa? Si es lo segundo, dime y ajustamos el plan hacia la Opción A o B descritas arriba.
