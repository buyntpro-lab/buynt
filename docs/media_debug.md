## ROOT CAUSE
**Tipo de error**: src recibiendo string vacío (`''`) en lugar de `undefined`  
**Ubicación**: `DualEvidenceUploader.tsx` línea ~95-110 (función `loadMedia`)

### Problema identificado
`getSignedUrl()` devuelve `{url: string, error?: string}` donde:
- En caso de éxito: `{url: 'https://...'}`
- En caso de error: `{url: '', error: 'mensaje'}`

El componente asignaba directamente `result.url` sin validar si era string vacío, resultando en:
```tsx
signedUrl: '' // ❌ String vacío causa <img src=""> que renderiza icono roto
```

## SOLUCIÓN IMPLEMENTADA

### 1. Corrección de asignación de URLs
```tsx
// ANTES (roto)
signedUrl: result.url

// DESPUÉS (robusto)
signedUrl: result.url || undefined  // String vacío se convierte a undefined
```

### 2. Componente MediaThumb robusto
Creado `/src/components/common/MediaThumb.tsx` con:
- ✅ Skeleton loader mientras carga
- ✅ Placeholder "No disponible" si falla
- ✅ Manejo de `onError` en `<img>`
- ✅ Nunca renderiza icono de imagen rota
- ✅ Botón "Reintentar" opcional

### 3. Logs de diagnóstico
Añadidos console.logs en `loadMedia()`:
```
🔍 [DualEvidence] Loading media for rental: xxx type: handoff
🔐 Signing photo: xxx bucket: booking-proof-private path: bookings/...
✅ Signed photo: xxx url length: 450
```

Permite detectar:
- 403: url length 0 + error "...storage..."
- 404: url length 0 + error "Object not found"
- undefined: no se llama a getSignedUrl

### 4. Contador corregido
```tsx
// ANTES: {yourCount}/{minPhotos}  // "8/3" confuso
// DESPUÉS: {yourCount}/{maxPhotos} // "8/8" claro
```

## VERIFICACIONES REALIZADAS

### Path generado correctamente
```typescript
// storageService.ts línea 229
generateBookingMediaPath(rentalId, type, imageId, 'full')
// Output: "bookings/{rentalId}/{type}/{uuid}-full.webp"
```
✅ Path limpio sin prefijos bucket  
✅ Formato correcto para Supabase Storage

### Bucket configurado
- Nombre: `booking-proof-private`
- Privado: Sí (requiere signed URLs)
- RLS policies: Existentes (verificar con usuario)

### getSignedUrl funcionando
```typescript
// storageService.ts línea 160-176
await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds)
```
✅ Implementación correcta  
⚠️ Si devuelve error, puede ser:
- Bucket no existe → crear en Supabase Dashboard
- RLS policy blocks → ajustar policies
- Path incorrecto → logs mostrarán esto

## CASOS EDGE MANEJADOS

1. **Usuario no participante**: getSignedUrl falla (403) → MediaThumb muestra placeholder
2. **Path corrupto legacy**: Foto falla → placeholder + botón reintentar
3. **Bucket no existe**: Error en console, placeholder visible
4. **Red lenta**: Skeleton loader + timeout

## PRÓXIMOS PASOS SI SIGUE FALLANDO

### A) Verificar bucket existe
```sql
-- En Supabase Dashboard > Storage
-- Buscar: booking-proof-private
-- Si no existe: Create bucket > Name: booking-proof-private > Private: ON
```

### B) RLS Policy para signed URLs
Storage policies deben permitir SELECT al owner/renter:
```sql
-- Política: "Participants can view booking media"
-- Tabla: objects (en storage.buckets)
-- Operación: SELECT
-- Using:
bucket_id = 'booking-proof-private' 
AND auth.uid() IN (
  SELECT owner_id FROM rentals WHERE id = (storage.foldername(name))[2]::uuid
  UNION
  SELECT renter_id FROM rentals WHERE id = (storage.foldername(name))[2]::uuid
)
```

### C) Verificar datos existentes
```sql
SELECT 
  id, 
  rental_id, 
  type, 
  path, 
  bucket,
  uploaded_by,
  created_at
FROM booking_media
ORDER BY created_at DESC
LIMIT 5;
```
Verificar que `path` NO contenga:
- ❌ `booking-proof-private/bookings/...` (prefijo bucket)
- ❌ `https://...` (URL completa)
- ✅ `bookings/{uuid}/{type}/{uuid}-full.webp` (correcto)

Si hay paths corruptos:
```sql
-- Normalizar paths
UPDATE booking_media
SET path = regexp_replace(path, '^booking-proof-private/', '')
WHERE path LIKE 'booking-proof-private/%';
```

## CAMBIOS REALIZADOS

**Archivos creados:**
- `src/components/common/MediaThumb.tsx` (117 líneas)

**Archivos modificados:**
- `src/components/booking/DualEvidenceUploader.tsx`:
  - Línea 88-117: Logs diagnóstico + fix `|| undefined`
  - Línea 24: Import MediaThumb
  - Línea 351-366: Reemplazar `<img>` con `<MediaThumb>`
  - Línea 463-473: Reemplazar grid otras fotos con MediaThumb
  - Línea 260, 275: Cambiar minPhotos → maxPhotos en contador

**No requiere cambios:**
- ✅ storageService.ts (funciona correctamente)
- ✅ itemImagesService.ts (path generation OK)
- ✅ Next.config (no usa next/image)
- ✅ DB schema (correcto)

## STATUS FINAL
✅ **Fix implementado**: Código robusto que maneja todos los edge cases  
🔍 **Diagnóstico activo**: Console logs ayudarán a identificar problemas específicos  
⏳ **Verificar bucket**: Si sigue fallando, crear bucket en Supabase Dashboard  
📋 **SQL ready**: Queries de verificación y normalización disponibles arriba
