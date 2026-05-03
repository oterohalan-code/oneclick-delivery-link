## Objetivo

Cerrar los 2 puntos de cumplimiento legal pendientes antes del lanzamiento:

1. Checkbox obligatorio "Acepto Términos y Política de Privacidad" en los 3 flujos de registro.
2. Enlaces visibles a `/legal/terms` y `/legal/privacy` en el footer de la landing.

## Cambios

### 1. `src/features/courier/CourierSignupWizard.tsx`
- Agregar estado `acceptedTerms` (boolean, default `false`).
- Renderizar checkbox antes del botón "Crear cuenta y continuar" con dos `<Link>` a `/legal/terms` y `/legal/privacy` (target `_blank`).
- En `onCreateAccount`: validar `acceptedTerms === true`, mostrar `toast.error("Debes aceptar los Términos y la Política de Privacidad")` si no.
- Deshabilitar el botón submit mientras `!acceptedTerms`.

### 2. `src/features/restaurant/RestaurantSignupWizard.tsx`
- Mismos cambios que el wizard de courier, en el formulario del paso 1 (antes del botón "Crear cuenta y continuar" en línea ~245).

### 3. `src/routes/auth.tsx` (formulario de admin)
- Agregar el mismo checkbox + validación en `onAdminSignup` antes del botón "Crear cuenta de administrador".

### 4. `src/routes/index.tsx` (footer landing)
- Reemplazar el footer actual para incluir, junto al copyright, dos `<Link>` a `/legal/terms` ("Términos") y `/legal/privacy` ("Privacidad"), con estilo coherente (`text-xs text-graphite hover:text-foreground`).

## Detalles técnicos

- Reusar el componente `Checkbox` de `@/components/ui/checkbox` (shadcn) con un `<Label>` asociado.
- Los enlaces se abren en nueva pestaña (`target="_blank"`, `rel="noopener noreferrer"`) para no perder el formulario.
- Sin cambios de base de datos: el consentimiento se considera registrado por el hecho de completar el alta (la fecha de creación del `auth.users` queda como timestamp legal). No requiere migración.

## Fuera de alcance

- No se toca el flujo OAuth de Google (Google ya muestra su propio consentimiento; los Términos quedan vinculados desde el footer y desde la pantalla de registro por email).
- No se modifica el contenido de las páginas `/legal/terms` ni `/legal/privacy` (ya creadas previamente).
