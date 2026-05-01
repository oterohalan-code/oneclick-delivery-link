# Plan

## 1. Diagnóstico del usuario que "no puede entrar"

Revisé la base de datos y los logs de autenticación:

- El usuario **sí existe**: `hadjysilman98@gmail.com`, creado el 1 may 18:41, rol `courier`, email ya confirmado, perfil y registro de `couriers` creados correctamente por el trigger.
- En los logs de auth se ven **2 intentos de login seguidos** (19:18:32 y 19:18:37) ambos con `invalid_credentials`. Los passwords usados fueron diferentes entre sí (`Tacosdeasda.666` vs `Tacosdeasda666`), lo que confirma que **la contraseña tipeada no coincide con la registrada**. La cuenta está sana; es un problema de password, no del sistema.

**Acción:** Añadir en la pantalla `/auth` un enlace "¿Olvidaste tu contraseña?" que dispare `supabase.auth.resetPasswordForEmail()` y una nueva ruta `/auth/reset` donde el usuario pueda definir una nueva contraseña al volver desde el correo (`updateUser({ password })`). Así este usuario (y futuros) puede recuperarse sin intervención manual.

Opcionalmente, si prefieres, puedo resetear su contraseña directamente vía admin a un valor temporal — dímelo en el chat y lo hago.

## 2. Flujo de permisos de ubicación con reintento

Hoy `useCourierLocationTracker` solo lee el estado del permiso y muestra un banner si está `denied`, pero **nunca vuelve a pedirlo** y no explica por qué hace falta. Si el navegador lo bloquea, el repartidor se queda atorado.

Cambios:

### a) Nuevo componente `LocationPermissionGate.tsx` (reutilizable)
- Banner/Card visible cuando `permission` es `denied`, `prompt` o `unsupported`.
- Texto claro: "Necesitamos tu ubicación para mostrarte pedidos cercanos, asignarte rutas y verificar que estás en el punto de entrega al finalizar."
- Botón **"Activar ubicación"** que llama a `navigator.geolocation.getCurrentPosition` **dentro del gesto del usuario** (requisito del navegador para re-prompt).
- Manejo explícito de los 3 errores: `PERMISSION_DENIED` (instrucción para activarlo manualmente en ajustes del navegador, con detalle por sistema), `POSITION_UNAVAILABLE`, `TIMEOUT` — con botón "Reintentar".
- Si el estado ya es `granted`, no renderiza nada.

### b) Actualizar `useCourierLocationTracker.ts`
- Exponer también `requestPermission()` para que la UI pueda invocarlo bajo gesto.
- Cuando `permissions.query` reporta `denied`, dejar de hacer `watchPosition` (hoy no inicia, está bien) y mantener el estado reactivo a cambios (`onchange`) para reanudar el tracking automáticamente cuando el usuario lo activa desde ajustes del navegador.

### c) Integrarlo en dos puntos críticos
- **`CourierHome.tsx`**: reemplazar el banner actual por `<LocationPermissionGate>` — siempre visible mientras el permiso no esté concedido (no solo en `denied`).
- **`DeliveryProofDialog.tsx`**: si al abrir el diálogo no hay permiso, mostrar el mismo gate antes del paso de la foto, ya que sin GPS no se puede validar la cercanía de 50 m.

## 3. Detalles técnicos

- Usar `navigator.permissions.query({ name: "geolocation" })` para detectar el estado actual sin disparar el prompt.
- El re-prompt **solo funciona si el estado es `prompt`**. Si es `denied`, el navegador no vuelve a preguntar — por eso el componente debe mostrar instrucciones específicas ("Haz clic en el candado de la barra de direcciones → Permisos del sitio → Ubicación → Permitir") y un botón "Ya lo activé, reintentar" que vuelva a llamar `getCurrentPosition`.
- Toda la lógica de geolocalización ya está envuelta en try/catch; solo añadimos UX clara.

## Archivos afectados

- **Nuevo**: `src/components/LocationPermissionGate.tsx`
- **Nuevo**: `src/routes/auth.reset.tsx` (pantalla "definir nueva contraseña")
- **Editado**: `src/hooks/useCourierLocationTracker.ts` (exponer `requestPermission`)
- **Editado**: `src/features/courier/CourierHome.tsx` (usar el gate)
- **Editado**: `src/features/courier/DeliveryProofDialog.tsx` (gate antes de la foto)
- **Editado**: `src/routes/auth.tsx` (link "¿Olvidaste tu contraseña?")

¿Apruebas así, o quieres que también te resetee la contraseña del usuario `hadjysilman98@gmail.com` a una temporal mientras tanto?
