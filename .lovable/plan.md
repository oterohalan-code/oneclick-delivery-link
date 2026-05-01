# Mostrar el onboarding completo de Repartidor en /auth

## Problema
En `/auth?role=courier` solo aparece un formulario plano (Nombre, Teléfono, Email, Contraseña). Toda la lógica enriquecida (selector de país con bandera 🇲🇽, carga de INE/Licencia/Tarjeta de Circulación con validación IA, pregunta de mochila/equipamiento, barra de progreso) ya existe en `CourierOnboarding.tsx` pero **solo se renderiza después** del login dentro de `/app`. Por eso el usuario no ve nada de lo solicitado.

## Solución
Convertir `/auth` cuando el rol seleccionado es **Repartidor** en un wizard de 4 pasos integrados, reutilizando los componentes ya creados (`PhoneInput`, `CourierOnboarding`, `validateDocument`). El flujo de Restaurante queda igual (formulario simple).

### Nuevo flujo visual en /auth (rol = courier)

```
[Barra de progreso]  Paso X de 4

Paso 1 — Datos de acceso
  • Nombre completo
  • Teléfono con selector de país (default 🇲🇽 +52)  ← PhoneInput
  • Email
  • Contraseña (mín. 8)
  → Botón "Crear cuenta y continuar"
     (ejecuta supabase.auth.signUp + guarda profile con country_code/dial)

Paso 2 — Documentos (IA)
  • INE Frente / INE Reverso / Licencia / Tarjeta de Circulación
  • Cada slot: subir foto → validación IA → pill verde/ámbar/rojo
  • Reintento permitido; tras 2 fallos de nombre → "needs_review"

Paso 3 — Equipamiento
  • ¿Tienes mochila? Sí/No
  • Si No: ¿Dispuesto a adquirir/compartimento? Sí/No

Paso 4 — Confirmación
  • Pantalla "¡Registro en proceso! Nuestro sistema y equipo están
    validando tus datos. Recibirás una notificación push cuando
    seas activado."
  • Botón → /app
```

### Cambios técnicos

1. **`src/routes/auth.tsx`** — Refactor:
   - Tab "Entrar" sigue igual (login email + password).
   - Tab "Crear cuenta" muestra selector de rol (Restaurante / Repartidor) como hoy.
   - Si rol = **restaurant** → formulario actual sin cambios.
   - Si rol = **courier** → renderizar `<CourierSignupWizard />` (nuevo componente local) en lugar del formulario plano.

2. **`src/features/courier/CourierSignupWizard.tsx`** — Nuevo:
   - Paso 1 (acceso + contacto): usa `PhoneInput` (default MX). Al enviar:
     - `supabase.auth.signUp({ email, password, options.data: { full_name, phone, role: "courier", country_code, phone_dial_code } })`.
     - Esperar sesión (hay trigger `handle_new_user` que crea profile/courier/role; verificar y, si falta, hacer upsert defensivo de profile con país y dial).
   - Pasos 2 y 3 (documentos + equipamiento): reutilizar la lógica YA existente de `CourierOnboarding.tsx` extrayéndola en sub-componentes (`<DocumentsStep />` y `<EquipmentStep />`) para no duplicar. `CourierOnboarding` (en /app) seguirá usando los mismos sub-componentes para usuarios que regresan sin terminar.
   - Paso 4: pantalla de confirmación con CTA → `navigate({ to: "/app" })`.
   - Barra de progreso `value={(step/4)*100}`.

3. **`src/features/courier/CourierOnboarding.tsx`** — Refactorización mínima:
   - Extraer `DocumentsStep` y `EquipmentStep` a archivos compartidos (`src/features/courier/steps/`) para que ambos (`/auth` wizard y `/app` onboarding) los usen.

4. **Manejo de email confirmation**:
   - Si Supabase requiere confirmación por email, `signUp` no devuelve sesión inmediata → mostrar mensaje "Revisa tu correo para confirmar antes de subir documentos" y bloquear pasos 2-4 hasta que regrese autenticado. (Auto-confirm NO está activo por defecto y no debe activarse sin pedir.)
   - Si la sesión está disponible inmediatamente, continuar al Paso 2 sin fricción.

5. **Sin cambios** en BD, RLS, edge functions, ni en `/app/index.tsx` (sigue mostrando `CourierOnboarding` para usuarios que regresan a completar).

## Resultado
En `/auth?role=courier` el usuario verá inmediatamente: barra de progreso, selector de país con bandera de México, y el wizard de 4 pasos exactamente como se especificó. El comportamiento del flujo de Restaurante no se altera.