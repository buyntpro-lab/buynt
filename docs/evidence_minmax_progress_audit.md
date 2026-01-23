# Evidence Min/Max Progress Audit

## Fecha: 2026-01-22
## Auditor: Staff Engineer

---

## 📍 AUDITORÍA FASE 0 - HALLAZGOS

### 1. Ubicación de Constantes Min/Max

| Archivo | Línea | Constante | Valor Actual | Valor Requerido |
|---------|-------|-----------|--------------|-----------------|
| `src/lib/rentalProgress.ts` | 12 | `MIN_HANDOFF_PHOTOS` | 3 | 2 |
| `src/lib/rentalProgress.ts` | 13 | `MIN_RETURN_PHOTOS` | 3 | 2 |
| `src/lib/rentalProgress.ts` | 14 | `MIN_PHOTOS_PER_PARTY` | 3 | 2 |
| `src/components/booking/DualEvidenceUploader.tsx` | 84 | `maxPhotos` (local) | 8 | 6 |
| `src/components/booking/BookingEvidence.tsx` | 44-45 | `minPhotos, maxPhotos` defaults | 3, 8 | 2, 6 |
| `src/components/booking/BookingEvidenceUploader.tsx` | 74-75 | `minPhotos, maxPhotos` defaults | 3, 8 | 2, 6 |

### 2. Ubicación de Lógica de Progreso

#### `src/lib/rentalProgress.ts:isStepComplete()`
```typescript
// LÍNEA 184-206 - función que determina si un step está completo
function isStepComplete(key: ProgressStepKey, data: RentalProgressData): boolean {
    switch (key) {
        case 'RESERVATION_CREATED': return true;
        case 'HANDOFF_CONFIRMED': return data.hasHandoffConfirmedEvent;
        case 'RETURN_PHOTOS': // ✅ TIENE lógica dual evidence
        case 'RETURN_CONFIRMED': return data.hasReturnConfirmedEvent;
        case 'RENTAL_COMPLETED': return data.rentalStatus === 'completed' || data.hasCompletedEvent;
        default: return false; // ⚠️ HANDOFF_PHOTOS cae aquí!
    }
}
```

#### `src/components/booking/DualEvidenceUploader.tsx:246-248`
```typescript
// Cálculo del banner "Evidencias completas"
const yourComplete = yourCount >= minPhotos;
const otherComplete = otherCount >= minPhotos;
const bothComplete = yourComplete && otherComplete;
```

### 3. Conteos por Parte

| Archivo | Función | Descripción |
|---------|---------|-------------|
| `src/hooks/useRentalProgress.ts` | `groupMediaByMomentAndParty()` | Agrupa media por momento (handoff/return) y role (owner/renter) |
| `src/hooks/useRentalProgress.ts` | `computePartyCounts()` | Calcula conteos: ownerHandoff, renterHandoff, ownerReturn, renterReturn |
| `src/lib/rentalProgress.ts` | `partyCounts` interface | Define la estructura de conteos por parte |

### 4. Refetch/Invalidación

| Archivo | Trigger | Acción |
|---------|---------|--------|
| `DualEvidenceUploader.tsx:166` | Después de upload exitoso | `onUploadComplete?.()` |
| `DualEvidenceUploader.tsx:210` | Después de eliminar | `onUploadComplete?.()` |
| `useRentalProgress.ts:97` | Hook initialization | `fetchData()` |
| `useRentalProgress.ts:240` | Manual refresh | `refresh()` function |

---

## 🔴 ROOT CAUSE: EL WIZARD NO AVANZA

### Problema Principal
**`HANDOFF_PHOTOS` NO tiene case en `isStepComplete()`**

```typescript
// ACTUAL en src/lib/rentalProgress.ts:184-206
function isStepComplete(key: ProgressStepKey, data: RentalProgressData): boolean {
    switch (key) {
        case 'RESERVATION_CREATED': return true;
        // ⚠️ FALTA: case 'HANDOFF_PHOTOS' !!!
        case 'HANDOFF_CONFIRMED': return data.hasHandoffConfirmedEvent;
        case 'RETURN_PHOTOS': /* ... */ 
        case 'RETURN_CONFIRMED': return data.hasReturnConfirmedEvent;
        case 'RENTAL_COMPLETED': return data.rentalStatus === 'completed' || data.hasCompletedEvent;
        default: return false; // 👈 HANDOFF_PHOTOS siempre retorna FALSE
    }
}
```

### Consecuencias
1. El banner en `DualEvidenceUploader` dice "Evidencias completas" (usa `yourCount >= minPhotos && otherCount >= minPhotos`)
2. PERO el step `HANDOFF_PHOTOS` nunca se marca como `isComplete: true` en el wizard
3. Ergo: el wizard se queda atascado en el paso 2 aunque el banner diga otra cosa

### Desalineación Detectada
| Componente | Lógica | Resultado |
|------------|--------|-----------|
| Banner `DualEvidenceUploader` | `yourCount >= 3 && otherCount >= 3` | ✅ "Evidencias completas" |
| Step wizard `isStepComplete('HANDOFF_PHOTOS')` | `default: return false` | ❌ Step incompleto |

---

## 📋 PLAN DE FIX (Orden de ejecución)

### FASE 1: Fuente de Verdad Única (Constants)
1. En `src/lib/rentalProgress.ts`:
   - Cambiar `MIN_HANDOFF_PHOTOS = 2`
   - Cambiar `MIN_RETURN_PHOTOS = 2`
   - Cambiar `MIN_PHOTOS_PER_PARTY = 2`
   - **AGREGAR**: `MAX_PHOTOS_PER_PARTY = 6`

2. En `src/components/booking/DualEvidenceUploader.tsx`:
   - Importar `MAX_PHOTOS_PER_PARTY` de rentalProgress
   - Reemplazar `const maxPhotos = 8` por `const maxPhotos = MAX_PHOTOS_PER_PARTY`

### FASE 2: Fix isStepComplete
En `src/lib/rentalProgress.ts`, añadir el case faltante:
```typescript
case 'HANDOFF_PHOTOS':
    // DUAL EVIDENCE: Both owner AND renter must upload minimum photos
    const ownerHandoffOk = data.partyCounts.ownerHandoff >= MIN_PHOTOS_PER_PARTY;
    const renterHandoffOk = data.partyCounts.renterHandoff >= MIN_PHOTOS_PER_PARTY;
    return (ownerHandoffOk && renterHandoffOk) || data.hasHandoffPhotosEvent;
```

### FASE 3: Límite Bloqueante UX
En `DualEvidenceUploader.tsx`:
1. Mostrar mensaje permanente cuando `yourCount >= maxPhotos`
2. Clamp la selección al máximo permitido con warning

### FASE 4: Fotos rotas / Object not found
- Decisión: **NO contar fotos rotas como válidas**
- Añadir tracking de estado de carga en cada tile
- Filtrar solo "válidas" al contar para min/max

---

## 📁 FICHEROS A MODIFICAR

| Archivo | Cambios |
|---------|---------|
| `src/lib/rentalProgress.ts` | Constantes MIN=2, MAX=6, fix isStepComplete |
| `src/components/booking/DualEvidenceUploader.tsx` | Import MAX, UX límite bloqueante |
| `src/components/booking/BookingEvidence.tsx` | Actualizar defaults (si se usa) |
| `src/components/booking/BookingEvidenceUploader.tsx` | Actualizar defaults (si se usa) |

---

## ✅ VERIFICACIÓN POST-FIX

1. Constantes: Buscar cualquier hardcode `3` o `8` relacionado con fotos
2. isStepComplete: Verificar que `HANDOFF_PHOTOS` tiene case
3. Banner y step: Verificar que usan exactamente la misma condición
4. Test manual: Subir 2 fotos owner + 2 fotos renter → wizard debe avanzar

