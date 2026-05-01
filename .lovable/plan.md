
## Objetivo

Reemplazar el onboarding de repartidor por un wizard de 3 pasos, con barra de progreso, **selector de país + teléfono** (México por defecto) y **validación automática con IA (visión)** de documentos al momento de subirlos. Usaremos Lovable AI (`google/gemini-2.5-pro`) — sin API keys del usuario.

## Cambios en la base de datos

Migración nueva:
- `couriers`: agregar `circulation_url text`, `has_backpack boolean default false`, `willing_to_get_backpack boolean default false`, `ai_validation jsonb default '{}'`.
- `profiles`: agregar `country_code text default 'MX'` (ISO-2) y `phone_dial_code text default '+52'`. El campo `phone` ya existe y guardará solo el número nacional.

Bucket `courier-docs` ya privado con RLS correcto — sin cambios.

## Server function: `validate-document`

`src/server/validate-document.functions.ts` (protegida con `requireSupabaseAuth`):

- Input: `{ docPath, docType: "ine_front"|"ine_back"|"license"|"circulation", expectedFullName }`
- Descarga la imagen del bucket con `supabaseAdmin.storage.download()`, la convierte a base64 data URL.
- Llama Lovable AI Gateway (`google/gemini-2.5-pro`) con **tool calling** forzado para extraer JSON:
  ```json
  { "full_name": "...", "expiration_date": "YYYY-MM-DD|null", "document_type": "...", "is_readable": true }
  ```
- Lógica:
  - `expiration_date < hoy` → `{ status: "expired" }`
  - Fuzzy match (Jaro-Winkler ≥ 0.85, normalizando acentos) entre `full_name` y `expectedFullName` → si falla, `{ status: "name_mismatch" }`
  - `is_readable=false` → `{ status: "unreadable" }`
  - OK → `{ status: "valid", extracted }`
- Persiste en `couriers.ai_validation->{docType}`.
- Maneja 429/402 con mensajes amigables.

## Frontend: wizard de 3 pasos

Reescribir `src/features/courier/CourierOnboarding.tsx`. Barra `<Progress />` superior fija con “Paso X de 3”.

### Paso 1 — Datos de Acceso
- **Nombre completo** (pre-llenado desde `profiles`, editable, zod ≥ 2).
- **Correo** (editable solo si no hay sesión; en el flujo actual ya está autenticado).
- **Contraseña** (solo si signup desde cero).
- **Teléfono con selector de país**:
  - Componente nuevo `src/components/PhoneInput.tsx`.
  - Lista de países con bandera (emoji), nombre y dial code (`+52` MX, `+1` US/CA, `+34` ES, `+57` CO, `+54` AR, `+56` CL, `+51` PE, `+58` VE, `+502`–`+507` Centroamérica, `+55` BR, `+44` UK, `+33` FR, `+49` DE, etc. — lista curada de ~30 países, México **default seleccionado**).
  - UI: `<Select>` shadcn a la izquierda mostrando 🇲🇽 +52, `<Input type="tel">` a la derecha para el número nacional. Validación zod (8–15 dígitos).
- Guarda en `profiles`: `full_name`, `phone` (solo número), `country_code` (ISO-2), `phone_dial_code`.

### Paso 2 — Carga de Documentos
4 dropzones grandes (`h-32`, mobile-first): **INE Frente**, **INE Reverso**, **Licencia**, **Tarjeta de Circulación**.

Por cada foto:
1. Sube a `courier-docs/{user_id}/{docType}-{ts}.jpg`.
2. Estado “Verificando documentos…” con spinner sobre el slot.
3. Llama `validateDocument({...})`.
4. Renderiza resultado:
   - ✅ verde: “{nombre extraído} · vence {fecha}”
   - ⚠️ rojo + botón **Volver a subir**: “Documento expirado” / “Foto borrosa” / “El nombre no coincide con tu perfil”
5. No avanza al Paso 3 hasta que los 4 docs estén `valid`. Tras 2 intentos `name_mismatch` se permite continuar marcando ese doc como `needs_review` (revisión manual).

### Paso 3 — Equipamiento
- “¿Tienes mochila de repartidor?” (botones grandes Sí/No).
- Si **No** → “¿Estás dispuesto a adquirir una o contar con un compartimento para transportar productos?” (Sí/No).
  - Si responde No al segundo → botón Continuar deshabilitado: “Necesitas equipamiento para repartir.”
- Guarda `has_backpack`, `willing_to_get_backpack`.

### Pantalla final
Card centrada con icono ⏳:
> **¡Registro en proceso!**  
> Nuestro sistema y equipo están validando tus datos. Recibirás una notificación push cuando seas activado.

Setea `couriers.status = 'pending_validation'`.

## UI / Mobile-first
- Botones `size="lg"` con `h-14 text-base`.
- Dropzones grandes con feedback visual (spinner / check / alerta).
- Una sola columna, padding generoso, navegación Anterior/Siguiente fija abajo.

## Admin panel
Update menor en `AdminHome.tsx`: por cada doc con `ai_validation`, mostrar pill verde/ámbar/rojo con `extracted.full_name` y `expiration_date` para apoyar la decisión manual.

## CourierHome
Asegurar que `status === 'pending_validation'` muestra la pantalla “Registro en proceso” y NO el wizard de nuevo (a menos que esté `rejected`).

## Archivos afectados

- **Crear** `supabase/migrations/<timestamp>_courier_onboarding_v2.sql`
- **Crear** `src/server/validate-document.functions.ts`
- **Crear** `src/components/PhoneInput.tsx` (selector país + input)
- **Crear** `src/lib/countries.ts` (lista curada de países)
- **Reescribir** `src/features/courier/CourierOnboarding.tsx` (wizard 3 pasos)
- **Editar** `src/features/admin/AdminHome.tsx` (mostrar resultados IA)
- **Editar** `src/features/courier/CourierHome.tsx` (gating de pantalla final)

## Detalles técnicos
- Lovable AI: `google/gemini-2.5-pro` con `tools` + `tool_choice` forzado para JSON estructurado vía visión.
- Fuzzy match nombres: Jaro-Winkler inline (sin nuevas dependencias).
- Imagen → AI: `supabaseAdmin.storage.from('courier-docs').download(path)` → base64 data URL → `{type:"image_url", image_url:{url:"data:image/jpeg;base64,..."}}`.
- Errores AI Gateway: 429 → toast “Espera unos segundos”; 402 → toast “Sin créditos de IA”.
- Países: lista estática local (no API externa), México preseleccionado.

## No incluido
- Envío real de push al aprobar (infra existe, falta VAPID + worker — futuro).
- Verificación SMS del teléfono — futuro.
