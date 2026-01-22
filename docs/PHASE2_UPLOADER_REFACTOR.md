# 📸 FASE 2: Refactor Uploader de Fotos - Staging + Button Model

## Resumen de Cambios

### Nuevo Archivo Creado
**`src/components/booking/BookingEvidenceUploader.tsx`**
- Componente refactorizado con modelo staging
- Multi-select, preview, remove, upload button
- Solo marca completado cuando min photos confirmadas en DB

### Cambios a Archivos Existentes
**`src/pages/RentalProgressWizard.tsx`**
- Cambio import: `BookingEvidence` → `BookingEvidenceUploader`
- Línea 13: Nueva importación
- Línea 271: Componente usado

---

## 🔄 Flujo Anterior (Problema)

```
1. Selecciona 1 foto
    ↓
2. Sube automáticamente a Storage
    ↓
3. Inserta en booking_media
    ↓
4. Marca paso como "Completado" INMEDIATAMENTE
    ↓
5. Problema: Si luego borras la foto, paso sigue marcado como completado
```

---

## ✨ Nuevo Flujo (Solución)

```
1. Selecciona 1, 2, 5... fotos
    ↓
2. Quedan en STAGING (memoria, no en BD)
    ↓
3. Ve previews, puede remover, puede añadir más
    ↓
4. Click botón "Subir 5 fotos"
    ↓
5. Sube a Storage (paralelo)
    ↓
6. Inserta cada una en booking_media
    ↓
7. Si todas OK:
    - Llama RPC mark_handoff_uploaded() o mark_return_uploaded()
    - RPC verifica: count(booking_media) >= MIN ?
    - Si YES: inserta evento + retorna ok=true
    - Si NO: retorna ok=false + message "faltan X fotos"
    ↓
8. Solo entonces marca paso como COMPLETADO
```

---

## 🎯 Características del Nuevo Componente

### Estados
```typescript
interface StagedFile {
    id: string;              // temp id
    file: File;              // archivo original
    preview: string;         // dataURL preview
}

type: 'existing' | 'staged'  // qué array se muestra
```

### Funcionalidades
| Feature | Implementado |
|---------|---|
| Multi-select files | ✅ |
| Preview grid (existing + staged) | ✅ |
| Remove from staging | ✅ |
| Add more files (append) | ✅ |
| Upload button "Subir X fotos" | ✅ |
| Parallel upload | ✅ |
| Error per file | ✅ |
| Lightbox viewer | ✅ |
| Min photos validation | ✅ Via RPC |
| Mark complete only after RPC ok | ✅ |

### Validaciones
- ✅ Total photos (existing + staged) ≤ maxPhotos
- ✅ Existing photos ≥ minPhotos triggers "Completado"
- ✅ RPC verifica mínimo DESPUÉS de upload
- ✅ Si no hay mínimo: warning, paso NO completa

### Manejo de Errores
- ✅ Success partial: "Subidas 3 fotos. Fallaron 1."
- ✅ Total failure: "Las 3 fotos fallaron: [motivos]"
- ✅ Per-file tracking
- ✅ Fallidos quedan en staging para reintentar

---

## 🔌 Integración con RPCs

### markHandoffUploaded() / markReturnUploaded()

**Llamado DESPUÉS del upload:**
```typescript
if (totalPhotos >= minPhotos) {
    const response = type === 'handoff'
        ? await rentalEventsService.markHandoffUploaded(rentalId)
        : await rentalEventsService.markReturnUploaded(rentalId);
    
    if (response.ok) {
        // ✅ Paso se marca completado
        toast.success(response.message);
    } else {
        // ❌ Paso NO se marca
        toast.warning(response.message); // "Faltan X fotos"
    }
}
```

**RPC Behavior (después del SQL patch):**
```sql
-- Verifica que hay >= MIN fotos
SELECT COUNT(*) FROM booking_media 
WHERE rental_id = ? AND type = 'handoff'

-- Si yes: inserta evento + retorna ok=true
-- Si no: retorna ok=false + message

-- Idempotente: si evento ya existe, retorna ok=true
```

---

## 📋 UI/UX Mejoras

### Antes
```
┌─────────────────────────────────┐
│ Fotos de Entrega                 │
│                                 │
│ [Selecciona + sube auto]         │
│ ❌ Problema: 1 foto = completa   │
│                                 │
│ Grid de fotos subidas            │
└─────────────────────────────────┘
```

### Después
```
┌──────────────────────────────────────┐
│ Fotos de Entrega                      │
│                                      │
│ FOTOS SUBIDAS (3)                    │
│ ┌─┐┌─┐┌─┐                            │
│ │1││2││3││X (remove)                 │
│ └─┘└─┘└─┘                            │
│                                      │
│ ┌─────────────────────────────────┐  │
│ │ FOTOS PARA SUBIR (2)  🔄        │  │
│ │ ┌─┐┌─┐                          │  │
│ │ │P││P││X (remove)              │  │
│ │ └─┘└─┘                          │  │
│ │                                 │  │
│ │ [Subir 2 fotos]                │  │
│ └─────────────────────────────────┘  │
│                                      │
│ [+ Seleccionar más fotos]            │
│                                      │
│ Status: 3/3 mín ✅                   │
└──────────────────────────────────────┘
```

---

## 🔄 Estados Visuales

### Staging Empty
- "Seleccionar fotos" button visible
- Lightbox N/A

### Staging with Files
- Blue box mostrando previews
- "Subir X fotos" button activo
- Can still add more

### Uploading
- Spinner en botón
- "Subiendo X de Y..."
- Previews disabled

### Success
- Fotos movidas a "FOTOS SUBIDAS"
- Staging limpiado
- Toast: "Subidas 3 fotos. Paso completado ✅"

### Partial Failure
- Successful added to grid
- Failed quedan en staging (retry)
- Toast: "Subidas 2. Fallaron 1. Reintenta"

---

## 🛠️ Detalles Técnicos

### File Upload Path
```typescript
rentals/{rentalId}/{type}/{timestamp}_{random}_{sanitizedFilename}
// Ejemplo: rentals/abc-123/handoff/1705864800_x7k9_iphone_photo.jpg
```

### Parallel Upload
```typescript
const uploadPromises = stagedFiles.map(file => 
    bookingMediaService.upload(rentalId, type, file.file)
);
const results = await Promise.all(uploadPromises);
```

### Cleanup
- Staged files se limpian SOLO si upload + RPC ok
- Failed uploads quedan para retry
- Existing photos siempre recuperables (delete button)

---

## 🧪 Casos de Test (FASE 4)

```
TEST 1: Staging vacío
- Abre componente
- No hay selecciones
- Resultado: botón "Subir" deshabilitado ✅

TEST 2: Seleccionar 1 foto
- No sube automáticamente
- Aparece en grid de staging
- Puedo remover
- Resultado: paso NO completa ✅

TEST 3: Seleccionar 3, subir
- Aparecen 3 previews
- Click "Subir 3 fotos"
- Se suben a Storage
- Se insertan en booking_media (si DB OK)
- RPC mark_* verifica count >= 3
- Paso se marca completado ✅

TEST 4: Min photos validation
- Subo 2 de 3 mín.
- Guardan en booking_media
- RPC mark_* retorna ok=false
- Paso NO completa
- Aviso: "Faltan 1 foto" ✅

TEST 5: Delete existing photo
- Tengo 3 fotos subidas (paso completo)
- Borro una
- Count = 2
- Paso se recalcula: completo → incompleto
- (Requiere refresh/refetch)

TEST 6: Upload failure
- 1 falla, 2 suben
- Toast: "Subidas 2. Fallaron 1"
- Las 2 subidas aparecen
- El error queda en staging
- Botón "Reintentar" disponible ✅

TEST 7: Lightbox
- Preview fotos staging
- Lightbox OK: next, prev, close
- Navega entre existing + staged ✅
```

---

## ⚠️ Notas Importantes

### No es "auto-complete" anymore
- ❌ Seleccionar 1 foto NO completa
- ✅ Solo botón "Subir" dispara upload

### Idempotencia crítica
- RPC `mark_*_uploaded` ya es idempotente (SQL patch)
- Si usuario hace click 2x en "Subir", no duplica evento
- Retorna ok=true igualmente

### Refetch de progreso
- Después de upload exitoso, `onUploadComplete()` llama `refresh()`
- El hook `useRentalProgress` recalcula todo
- Paso se actualiza con datos reales

### Si RPC falla silenciosamente
- Frontend vio upload OK, RPC falla
- Toast avisa: "Subidas 3 fotos" (success)
- Pero paso NO completa (porque RPC no OK)
- Usuario debe hacer refresh o esperar (fallback: refetch en 5s)

---

## 📝 Documentación Generada

- `docs/PHASE1_SQL_EXECUTION_CHECKLIST.md` (SQLpatch)
- Este doc: `docs/PHASE2_UPLOADER_REFACTOR.md` (nuevo)
- Próximo: `docs/PHASE3_TEST_PLAN.md`

---

## ✅ Checklist de Implementación

- [x] Crear BookingEvidenceUploader.tsx
- [x] Modo staging (no sube automático)
- [x] Preview grid (existing + staged)
- [x] Remove button (staging)
- [x] Upload button ("Subir X fotos")
- [x] Parallel upload
- [x] Error handling per file
- [x] Lightbox updated
- [x] Llamar mark_*_uploaded RPC después
- [x] Solo marcar completo si RPC ok=true
- [x] Validar mínimo fotos post-upload
- [x] Integración con RentalProgressWizard
- [x] TypeScript sin errores
- [ ] Test manual (FASE 4)
