## Objetivo
Aplicar los 4 fixes del diagnóstico **y** habilitar un flujo de auto-registro de administradores limitado al dominio corporativo `@punchingsolutions.com.mx` con confirmación por correo.

---

## Parte A — Fixes del diagnóstico

### 1. Hardening + parche de funciones (migración SQL)
- **`generate_referral_code`** y **`set_tracking_token`**: reemplazar `gen_random_bytes(...)` por `extensions.gen_random_bytes(...)` (o usar `gen_random_uuid()` como fuente entrópica). Esto elimina el error `function gen_random_bytes(integer) does not exist` que aparece en logs.
- **Search path mutable** (4 funciones marcadas por el linter): añadir `SET search_path = public` a las funciones que aún no lo tienen.
- **SECURITY DEFINER públicas**: revocar `EXECUTE ... FROM PUBLIC, anon` en las funciones SECURITY DEFINER y otorgar solo a `authenticated` (las funciones siguen siendo seguras porque internamente filtran por `auth.uid()`/RLS, pero deja de exponerse al rol anónimo).

### 2. Asignar admin inicial
Insertar manualmente el primer administrador para `oteroalan299@gmail.com` (única cuenta corporativa identificada del owner) en `public.user_roles` con rol `admin`. Esto desbloquea el panel `/app/admin` y el `EmailTester` ya existente.

### 3. Verificación de entregabilidad
Una vez creado el admin, podrás entrar a **Admin → Emails** y enviar los 3 correos de prueba (signup, magic link, recovery) al correo que quieras. (Ya está implementado, no requiere código nuevo.)

---

## Parte B — Auto-registro de administradores corporativos

### Flujo de usuario
1. En `/auth` aparece una nueva pestaña/sección **"Administrador"** (junto a Restaurante / Repartidor).
2. El formulario pide nombre, correo y contraseña.
3. Se valida en cliente y servidor que el correo termine en **`@punchingsolutions.com.mx`** (case-insensitive, trim).
4. Al enviar:
   - Se hace `supabase.auth.signUp` con `emailRedirectTo` apuntando a `/auth` y metadata `{ role: "admin_pending" }`.
   - Supabase enviará automáticamente el correo de confirmación usando las plantillas ya configuradas (Lovable Emails sobre `notify.oneclick.punchingsolutions.com.mx`).
5. El usuario hace clic en el enlace de confirmación → su email queda verificado.
6. La promoción a `admin` ocurre automáticamente (ver lógica server-side abajo).

### Lógica server-side (segura)
- **Trigger DB `handle_new_user`** (ya existe): se modificará para que cuando `raw_user_meta_data->>'role' = 'admin_pending'` **NO** asigne ningún rol todavía (no insertar fila en `user_roles`). Esto evita que un correo no confirmado obtenga privilegios.
- **Nuevo server function `claimAdminRole`** (`createServerFn` con `requireSupabaseAuth`):
  - Se llama desde el cliente la primera vez que el usuario entra autenticado a `/app` o tras confirmar.
  - Verifica server-side: (a) email del usuario termina en `@punchingsolutions.com.mx`, (b) `email_confirmed_at` no es null, (c) aún no tiene rol asignado.
  - Si todo OK → inserta `(user_id, 'admin')` en `user_roles` usando `supabaseAdmin`.
  - Si el correo no es del dominio → no asigna nada y retorna error claro.
- El `AuthContext` invocará `claimAdminRole()` automáticamente tras login si el usuario no tiene rol todavía y su email es corporativo.

### Por qué este enfoque es seguro
- La validación del dominio se hace **dos veces**: cliente (UX) y servidor (autoritativo).
- El rol admin nunca se otorga sin `email_confirmed_at`, evitando que alguien registre un correo ajeno.
- Cualquier correo no corporativo que use `role: admin_pending` simplemente queda sin rol (puede luego registrarse como restaurant/courier desde la app).

---

## Parte C — UI

### `src/routes/auth.tsx`
- Añadir una tercera opción de rol en el selector: `Administrador` (visible solo en la pestaña "Crear cuenta").
- Cuando el rol seleccionado es admin, mostrar un formulario simple (nombre, correo, contraseña) en lugar del wizard de courier/restaurant.
- Validar dominio al escribir y al enviar; mostrar mensaje claro: *"El registro de administradores está restringido a correos @punchingsolutions.com.mx"*.

### `src/lib/auth-context.tsx` (mínima edición)
- Después de cada login exitoso, si el usuario aún no tiene rol y su email es corporativo, llamar `claimAdminRole()` silenciosamente y refrescar el rol en contexto.

---

## Detalles técnicos (resumen para revisión)

### Migración SQL
```sql
-- Parche gen_random_bytes
CREATE OR REPLACE FUNCTION public.generate_referral_code() ...
  USES extensions.gen_random_bytes(6) ...

CREATE OR REPLACE FUNCTION public.set_tracking_token() ...
  USES extensions.gen_random_bytes(8) ...

-- Hardening SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.has_role, restaurant_owns_order_for_courier,
  is_order_participant, get_courier_stats, find_zone_for_point,
  get_public_tracking, recalc_courier_stats, grant_referral_reward,
  handle_new_user FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ... TO authenticated;

-- Trigger handle_new_user actualizado: NO asignar rol si role='admin_pending'

-- Insertar primer admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('0ea9c103-95b6-4f58-9a0a-916cd99775af', 'admin')
ON CONFLICT DO NOTHING;
```

### Nuevo server function
- `src/server/admin.functions.ts` → agregar `claimAdminRole`:
  - middleware: `requireSupabaseAuth`
  - lee `auth.users` vía `supabaseAdmin` para obtener `email` y `email_confirmed_at`
  - valida dominio y confirmación
  - inserta en `user_roles`

### Archivos tocados
- `supabase/migrations/<timestamp>_admin_signup_and_hardening.sql` (nuevo)
- `src/server/admin.functions.ts` (agregar `claimAdminRole`)
- `src/routes/auth.tsx` (agregar opción Administrador)
- `src/lib/auth-context.tsx` (auto-claim tras login)

---

## Resultado esperado
- ✅ Tu cuenta queda como admin inmediatamente (sin pasar por el flujo de registro).
- ✅ Cualquier persona con correo `@punchingsolutions.com.mx` puede auto-registrarse, confirmar por correo y ser promovida a admin automáticamente.
- ✅ El error `gen_random_bytes` desaparece de los logs.
- ✅ El linter baja de 27 a ~3-4 warnings (queda el de "Extension in Public", que requiere mover pgmq y es invasivo — se documentará pero no se mueve).
- ✅ Puedes probar entregabilidad de los 3 emails desde el panel.
