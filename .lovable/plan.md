## Objetivo
Reemplazar el formulario actual de signup de Restaurante (que pide solo nombre, teléfono, email, contraseña en `/auth`) por un wizard guiado tipo el de Repartidor, que recoja:

1. Nombre del local
2. Foto de la fachada
3. Dirección con autocompletado + mapa de confirmación
4. Email
5. Teléfono (con `PhoneInput`)
6. Contraseña

Y que al finalizar deje al restaurante listo para operar (sin tener que pasar después por `RestaurantOnboarding`).

## Cambios técnicos

### 1. Base de datos (migración)
- Añadir a `public.restaurants`:
  - `facade_url text` (nullable; foto de la fachada)
- Crear bucket de Storage `restaurant-photos` (privado) con políticas RLS:
  - INSERT/UPDATE/SELECT permitidos al dueño (`auth.uid()` coincide con la carpeta `{user_id}/...`)
  - SELECT también para admins y para repartidores activos (para mostrar la fachada al recoger pedidos)

### 2. Nuevo componente `RestaurantSignupWizard.tsx`
Ubicación: `src/features/restaurant/RestaurantSignupWizard.tsx`. Imitando el patrón de `CourierSignupWizard`:

- **Paso 1 — Datos de acceso** (`Progress` 1/2):
  - Nombre del local
  - Teléfono con `PhoneInput` (guardamos `country_code` y `phone_dial_code` en `profiles`)
  - Email
  - Contraseña (mín. 8, validada con zod)
  - Botón "Crear cuenta y continuar" → `supabase.auth.signUp` con `data: { full_name, phone, role: "restaurant" }`. Si la sesión queda activa, pasa al paso 2; si requiere confirmación de email, se muestra pantalla `MailCheck` igual que en courier.

- **Paso 2 — Local y ubicación** (`Progress` 2/2), solo visible con sesión:
  - Subir foto de fachada: input `<input type="file" accept="image/*" capture="environment">` con preview. Sube a `restaurant-photos/{user_id}/facade-{timestamp}.jpg` y guarda `facade_url`.
  - Categoría (`Select`, reusando `CATEGORIES` de `RestaurantOnboarding`)
  - `AddressSearch` (autocompletado Nominatim ya existente)
  - `MapView` debajo, mostrando un pin en `{lat,lng}` cuando se elige una dirección o se toca el mapa para ajustar
  - Validación con zod (nombre ≥2, dirección ≥5, lat/lng definidos, facade_url definido)
  - Botón "Finalizar registro" → INSERT en `public.restaurants` con `{ user_id, name, phone, category, address, lat, lng, facade_url }`. Toast de éxito y `navigate({ to: "/app" })`.

### 3. Integración en `src/routes/auth.tsx`
- En el `TabsContent value="signup"` del rol `restaurant`, reemplazar el `<form onSubmit={onSignup}>` actual por `<RestaurantSignupWizard />`.
- Eliminar `onSignup` y los inputs ahora obsoletos del path de restaurante (login y courier wizard intactos).

### 4. Reutilización
- Se reutilizan: `PhoneInput`, `AddressSearch`, `MapView`, `CATEGORIES` (extraer a `src/features/restaurant/constants.ts` para compartir entre wizard y `RestaurantOnboarding`).
- `RestaurantOnboarding` queda como fallback para restaurantes existentes que aún no tienen registro en `restaurants` (por ejemplo, cuentas creadas antes de este cambio); se actualiza para incluir el campo opcional de fachada.

### 5. Ajustes menores
- `RestaurantHome` ya muestra `RestaurantOnboarding` cuando no existe restaurante; con el nuevo wizard ese caso será raro, pero se mantiene por compatibilidad.

## Diagrama del flujo

```text
/auth (tab Crear cuenta, rol Restaurante)
  └─ RestaurantSignupWizard
       Paso 1: nombre · tel · email · password  ─► supabase.auth.signUp
                                                     │
                                  (sesión activa) ◄──┴──► (confirmar email → MailCheck)
       Paso 2: foto fachada · categoría · dirección + mapa
              └─► upload a Storage + INSERT restaurants → /app
```

## Notas
- No se introduce Web Push (acordado).
- La foto de fachada se almacena privada; se servirá vía signed URL cuando un repartidor la necesite (fuera de alcance de esta tarea).
- Validación con zod tanto en paso 1 como en paso 2; mensajes en español vía `sonner`.