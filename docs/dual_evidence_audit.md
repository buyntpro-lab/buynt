# Dual Evidence System - Auditoría Técnica

**Fecha:** 2026-01-22  
**Objetivo:** Separar evidencias por parte (owner/renter) con UI dual y progreso validado por ambos lados

---

## 1. ESTADO ACTUAL

### 1.1 Schema `booking_media`
```sql
CREATE TABLE public.booking_media (
    id UUID PRIMARY KEY,
    rental_id UUID NOT NULL REFERENCES rentals(id),
    type TEXT NOT NULL CHECK (type IN ('handoff', 'return')),
    path TEXT NOT NULL,
    bucket TEXT NOT NULL DEFAULT 'booking-proof-private',
    bytes INT,
    note TEXT,
    uploaded_by UUID NOT NULL,  -- ✅ CLAVE: Ya existe
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**✅ Datos disponibles:**
- `uploaded_by` UUID: identifica quién subió cada foto
- `type`: 'handoff' | 'return' (momento)
- `rental_id`: referencia al alquiler

### 1.2 Schema `rentals`
```sql
-- (inferido de código)
rentals {
    id UUID,
    owner_id UUID,
    renter_id UUID,
    status TEXT,
    ...
}
```

### 1.3 Cálculo de progreso actual
**Ubicación:** `src/lib/rentalProgress.ts`

**Lógica actual (simplificada):**
```typescript
export const MIN_HANDOFF_PHOTOS = 3;
export const MIN_RETURN_PHOTOS = 3;

function isStepComplete(key: ProgressStepKey, data: RentalProgressData): boolean {
    switch (key) {
        case 'HANDOFF_PHOTOS':
            return data.handoffPhotoCount >= MIN_HANDOFF_PHOTOS 
                   && data.hasHandoffPhotosEvent;
        case 'RETURN_PHOTOS':
            return data.returnPhotoCount >= MIN_RETURN_PHOTOS 
                   && data.hasReturnPhotosEvent;
        ...
    }
}
```

**Problema:** Solo cuenta TOTAL de fotos, no separa por owner/renter.

### 1.4 Fetching de datos
**Ubicación:** `src/hooks/useRentalProgress.ts`

**Query actual:**
```typescript
// 1. Trae rental con owner_id, renter_id
const { data: rentalData } = await supabase
    .from('rentals')
    .select('id, status, owner_id, renter_id, ...')
    .eq('id', rentalId)
    .single();

// 2. Cuenta fotos por type (pero NO por uploader)
const { data: mediaCounts } = await supabase
    .from('booking_media')
    .select('type')
    .eq('rental_id', rentalId);

const handoff = mediaCounts.filter(m => m.type === 'handoff').length;  // ❌ NO separa por party
```

**Necesita:** También traer `uploaded_by` y comparar con `owner_id`/`renter_id`.

### 1.5 Servicio de subida
**Ubicación:** `src/services/itemImagesService.ts` → `bookingMediaService`

**Upload actual:**
```typescript
async upload(rentalId, type, file, note) {
    const user = await supabase.auth.getUser();
    
    // Inserta booking_media con uploaded_by = user.id ✅
    const mediaRecord = {
        rental_id: rentalId,
        type,
        path,
        uploaded_by: user.id,  // ✅ Ya lo hace correctamente
        ...
    };
    
    await supabase.from('booking_media').insert(mediaRecord);
}
```

**✅ Ya guarda `uploaded_by` correctamente.**

### 1.6 UI actual
**Ubicación:** `src/components/booking/BookingEvidenceUploader.tsx`

**Comportamiento:**
- Muestra todas las fotos del `type` mezcladas
- No distingue "tus fotos" vs "fotos de la otra parte"
- Uploader staging + botón "Subir X fotos"
- No tiene viewer modal para "revisar fotos"

---

## 2. DATA LEGACY / COMPATIBILIDAD

### 2.1 Rentals existentes
**Pregunta:** ¿Hay rentals con fotos de solo una parte?

**Respuesta:** Posiblemente sí (si sistema ya está en uso).

**Impacto:**
- Fotos antiguas tendrán `uploaded_by` válido (es NOT NULL)
- Se puede derivar party comparando con `owner_id`/`renter_id`
- Si un rental tiene solo fotos del owner:
  - Owner: 3 fotos ✅
  - Renter: 0 fotos ❌
  - Paso NO completo (correcto)

**Solución:** NO requiere migración. Sistema funciona con datos actuales.

### 2.2 Casos edge
**Caso:** `uploaded_by` no es ni `owner_id` ni `renter_id`?
- **Causa posible:** Admin subió fotos, o usuario eliminado
- **Solución:** Marcar como 'unknown' party, no contar para progreso
- **Frecuencia:** Muy baja (no debería pasar)

---

## 3. CAMBIOS NECESARIOS

### 3.1 Modelo de datos: ✅ NO REQUIERE CAMBIOS DB

**Decisión:** Derivar `uploader_role` en runtime comparando:
```typescript
function getUploaderRole(media: BookingMedia, rental: Rental): 'owner' | 'renter' | 'unknown' {
    if (media.uploaded_by === rental.owner_id) return 'owner';
    if (media.uploaded_by === rental.renter_id) return 'renter';
    return 'unknown';
}
```

**Ventajas:**
- Sin cambios DB
- Sin migración
- Compatible con datos actuales
- Sin redundancia (uploaded_by es fuente de verdad)

**Desventaja:** Requiere join con rentals para derivar (pero ya lo hacemos).

**Alternativa rechazada:** Añadir columna `uploader_role TEXT` a `booking_media`
- Pro: Evita joins
- Contra: Redundancia, requiere migración, puede desincronizarse

### 3.2 Lógica de progreso: ✅ CAMBIAR

**Actual:**
```typescript
data.handoffPhotoCount >= MIN_HANDOFF_PHOTOS  // ❌ Total sin separar
```

**Nuevo:**
```typescript
export const MIN_PHOTOS_PER_PARTY = 3;

interface PartyCounts {
    ownerHandoff: number;
    renterHandoff: number;
    ownerReturn: number;
    renterReturn: number;
}

function isStepComplete(key: ProgressStepKey, data: RentalProgressData): boolean {
    switch (key) {
        case 'HANDOFF_PHOTOS':
            return data.partyCounts.ownerHandoff >= MIN_PHOTOS_PER_PARTY
                && data.partyCounts.renterHandoff >= MIN_PHOTOS_PER_PARTY
                && data.hasHandoffPhotosEvent;
        case 'RETURN_PHOTOS':
            return data.partyCounts.ownerReturn >= MIN_PHOTOS_PER_PARTY
                && data.partyCounts.renterReturn >= MIN_PHOTOS_PER_PARTY
                && data.hasReturnPhotosEvent;
        ...
    }
}
```

### 3.3 Fetching de datos: ✅ MODIFICAR QUERY

**Actual:** Solo trae `type`  
**Nuevo:** Traer `id, type, path, uploaded_by, created_at, note`

**Procesamiento en frontend:**
```typescript
// Agrupar por moment + party
const groupedMedia = {
    handoff: {
        owner: mediaList.filter(m => m.type === 'handoff' && getUploaderRole(m, rental) === 'owner'),
        renter: mediaList.filter(m => m.type === 'handoff' && getUploaderRole(m, rental) === 'renter'),
        unknown: mediaList.filter(m => m.type === 'handoff' && getUploaderRole(m, rental) === 'unknown')
    },
    return: {
        owner: mediaList.filter(m => m.type === 'return' && getUploaderRole(m, rental) === 'owner'),
        renter: mediaList.filter(m => m.type === 'return' && getUploaderRole(m, rental) === 'renter'),
        unknown: mediaList.filter(m => m.type === 'return' && getUploaderRole(m, rental) === 'unknown')
    }
};
```

### 3.4 UI: ✅ REDISEÑAR COMPONENTE

**Componente:** `BookingEvidenceUploader.tsx`

**Cambios:**
1. **Determinar viewer role:** ¿Soy owner o renter?
2. **Separar en 2 secciones:**
   - "Tus fotos" (editable si `canUpload`)
   - "Fotos de la otra parte" (readonly)
3. **Añadir botón "Revisar fotos"** → abrir modal viewer
4. **Mostrar progreso dual:**
   ```
   Tu parte: 2/3 ⚠️
   Otra parte: 3/3 ✅
   Paso completado cuando ambos lleguen a 3/3
   ```

**Nuevo componente:** `PhotoViewerModal.tsx`
- Carrusel con prev/next
- Zoom básico (opcional)
- Metadata: fecha, quién subió ("Arrendador" / "Arrendatario")

### 3.5 RLS / Storage: ✅ VERIFICAR (NO CAMBIAR)

**Políticas actuales (`20260121_photos_system.sql`):**

```sql
CREATE POLICY booking_media_select ON booking_media
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM rentals r
            WHERE r.id = rental_id
            AND (r.owner_id = auth.uid() OR r.renter_id = auth.uid())
        )
    );
```

**✅ Ya permite solo owner/renter ver fotos.**

**Storage:** bucket `booking-proof-private`  
**Verificar:** Policies de Storage permiten acceso con signed URLs a owner/renter.

---

## 4. PLAN DE IMPLEMENTACIÓN

### Fase 1: Modelo de datos (0 cambios DB)
- ✅ Usar derivación `uploaded_by` vs `owner_id/renter_id`

### Fase 2: Actualizar cálculo de progreso
- Archivo: `src/lib/rentalProgress.ts`
- Añadir `PartyCounts` a `RentalProgressData`
- Cambiar lógica `isStepComplete` para validar ambas partes

### Fase 3: Modificar fetching
- Archivo: `src/hooks/useRentalProgress.ts`
- Query: traer `uploaded_by` además de `type`
- Compute: agrupar en `groupedMedia` con helper `getUploaderRole`

### Fase 4: UI dual
- Archivo: `src/components/booking/BookingEvidenceUploader.tsx`
- Refactor: secciones "Tus fotos" / "Otra parte"
- Añadir: progreso dual con iconos
- Crear: `PhotoViewerModal.tsx` con carrusel

### Fase 5: Validar subida
- Ya funciona: `uploaded_by = auth.uid()`
- Verificar: RLS bloquea si no eres participant

### Fase 6: Testing
- Crear: `docs/dual_evidence_test_plan.md`
- Casos: owner 3, renter 0 → paso incompleto
- Casos: ambos 3 → paso completo
- Casos: legacy data funciona
- Casos: usuario ajeno no ve nada

---

## 5. DECISIONES TÉCNICAS

| Aspecto | Opción elegida | Alternativa rechazada | Razón |
|---------|---------------|---------------------|-------|
| Modelo datos | Derivar `uploader_role` en runtime | Añadir columna `uploader_role` | Sin redundancia, sin migración |
| Queries | 1 query con `uploaded_by`, compute frontend | VIEW/RPC con agrupación | Volumen bajo, simple |
| Progreso | Validar `ownerCount >= 3 && renterCount >= 3` | Mantener `totalCount >= 6` | Más seguro, evita desbalance |
| UI | 2 secciones separadas | Toggle tabs | Más claro, menos clicks |
| Viewer | Modal carrusel nuevo | Reutilizar item viewer | Contexto diferente (metadata rental) |

---

## 6. RIESGOS Y MITIGACIONES

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| Rentals legacy con solo 1 parte | UI muestra "faltan fotos" | ✅ Correcto, no bloquea app |
| `uploaded_by` corrupto (ni owner ni renter) | Fotos no cuentan | Marcar 'unknown', log warning |
| Performance: múltiples comparaciones | Lentitud si >50 fotos | Poco probable (max 8 por parte) |
| Usuario confundido por "otra parte 0/3" | Fricción UX | Texto explicativo claro |

---

## 7. MÉTRICAS DE ÉXITO

- ✅ Progreso solo completo cuando ambas partes cumplen
- ✅ UI muestra separación clara (Tus / Otra parte)
- ✅ Viewer modal funciona y muestra metadata
- ✅ RLS bloquea acceso a fotos de otros rentals
- ✅ Rentals legacy no crashean
- ✅ Test plan con 5+ casos pasa al 100%

---

## 8. COMPATIBILIDAD CONFIRMADA

### ✅ SIN CAMBIOS DB
- `uploaded_by` ya existe y es NOT NULL
- Todas las fotos tienen uploader identificable
- `owner_id` y `renter_id` ya están en `rentals`

### ✅ SIN MIGRACIÓN
- Derivación en runtime funciona con datos actuales
- Rentals legacy con fotos de 1 solo lado:
  - Se detectan correctamente
  - UI muestra estado correcto
  - Progreso no se marca completo (correcto)

### ✅ SIN ROMPER FUNCIONALIDAD
- Upload sigue guardando `uploaded_by` como antes
- RLS policies ya validan participante
- Storage signed URLs ya funcionan

---

## CONCLUSIÓN

**Estado:** ✅ Listo para implementar  
**Cambios DB:** Ninguno  
**Riesgo:** Bajo  
**Esfuerzo:** Moderado (principalmente UI + lógica progreso)  
**Bloqueos:** Ninguno
