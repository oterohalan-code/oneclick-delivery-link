## Problema

Aunque ya subiste tus documentos, sigues viendo "¡Registro en proceso!" porque el orden de los checks en `CourierHome.tsx` es incorrecto:

1. El trigger `handle_new_user` crea el courier con `status = 'pending_validation'` desde el momento del registro.
2. `CourierHome` chequea `status === 'pending_validation'` **ANTES** de chequear si faltan documentos.
3. Resultado: nunca llega a mostrar el onboarding — siempre cae en la pantalla "Registro en proceso".

## Solución

Reordenar los checks en `src/features/courier/CourierHome.tsx`:

1. **Primero**: si está `rejected` → mostrar pantalla de rechazo + onboarding.
2. **Segundo**: si le faltan documentos (INE frente, INE reverso, licencia, circulación) → mostrar `<CourierOnboarding />` **sin importar el status**.
3. **Tercero**: si ya subió todo pero el status sigue en `pending_validation` → mostrar "Registro en proceso" con mensaje aclarando que es revisión manual de los documentos marcados.
4. **Cuarto**: si `status === 'active'` → mostrar feed normal.

También incluir `ine_back_url` en la verificación de documentos faltantes (actualmente se omite).

## Archivo afectado

- `src/features/courier/CourierHome.tsx` — reordenar bloque de renders condicionales (líneas 85–109).

Sin cambios de DB ni de otros componentes.
