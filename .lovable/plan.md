## Objetivo

1. **Auto-aprobación**: Si la IA valida que TODOS los documentos son legibles, vigentes y con nombre que coincide, el repartidor pasa automáticamente a `status = active` (sin revisión manual).
2. **Bloqueo de pedidos**:
   - Sin saldo (`wallet_balance < $5`) y sin suscripción activa → no recibe ni puede aceptar pedidos.
   - Sin suscripción activa Y sin saldo suficiente → bloqueado.

---

## Cambios

### 1. Auto-activación tras validar documentos (`CourierOnboarding.tsx`)

En la función `submit()` (paso 3 → enviar):
- Detectar si los 4 documentos están en estado `valid` (no solo `valid` o `needs_review`).
- Si **todos son `valid`** → actualizar courier con `status = 'active'` + `plan = 'pps'` (default).
- Si alguno está en `needs_review` → mantener `status = 'pending_validation'` (revisión manual).
- Mostrar pantalla final apropiada: "¡Bienvenido, ya puedes recibir pedidos!" vs "En revisión".

### 2. Bloqueo en feed del repartidor (`CourierHome.tsx`)

Ya existe `canAccept = subActive || wallet_balance >= 5`. Reforzar:
- Si `!canAccept` → ocultar la lista de pedidos disponibles por completo (en lugar de mostrarlos con botón deshabilitado).
- Mostrar tarjeta clara con CTA → "Recargar saldo" o "Activar suscripción" que lleve a `/app/wallet`.
- También deshabilitar la suscripción a realtime de nuevos pedidos cuando `!canAccept` (no notificar).

### 3. Validación servidor-side al aceptar pedido

Crear server function `acceptOrder` (`src/server/orders.functions.ts`) protegida con `requireSupabaseAuth` que:
- Verifica que el courier tenga `status = 'active'`.
- Verifica `subscription_active && expires_at > now()` **O** `wallet_balance >= 5`.
- Si no cumple → retorna error claro.
- Si cumple → ejecuta el UPDATE atómico (status pending → assigned).

Reemplazar la llamada directa `acceptOrder()` de `CourierHome.tsx` por esta server function. Esto previene que un usuario manipule el cliente para saltarse la regla.

### 4. UI Wallet — claridad sobre el bloqueo

En `app.wallet.tsx`, agregar al inicio un banner cuando `!subActive && wallet_balance < 5`:
> "⚠️ Necesitas saldo o una suscripción activa para recibir pedidos."

---

## Detalles técnicos

**Archivos a editar:**
- `src/features/courier/CourierOnboarding.tsx` — lógica de submit con auto-activación.
- `src/features/courier/CourierHome.tsx` — ocultar feed/realtime si no hay saldo/sub; usar nueva server fn.
- `src/routes/app.wallet.tsx` — banner de advertencia.

**Archivos a crear:**
- `src/server/orders.functions.ts` — `acceptOrder` server function con validación de elegibilidad.

**Sin cambios de schema DB** — las columnas y políticas RLS ya soportan esta lógica. La validación se hace en server function (con cliente autenticado, RLS aplicada) para garantizar atomicidad y seguridad.

**Lógica de auto-activación (resumen):**
```ts
const allFullyValid = DOCS.every((d) => docs[d.key].status === "valid");
const newStatus = allFullyValid ? "active" : "pending_validation";
await supabase.from("couriers").update({ status: newStatus, ... });
```
