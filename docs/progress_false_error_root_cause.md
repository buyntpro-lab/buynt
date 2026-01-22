# 🔍 Auditoría Root-Cause: False Error Toast en Progress Wizard

## Fecha
21 de Enero 2026

---

## 📋 Resumen Ejecutivo

**Síntoma:** 
- Progress bar avanza correctamente (paso se marca completado, 6/6)
- PERO aparece un toast rojo "No se pudo completar la acción"
- El paso SE COMPLETA a pesar del error visual

**Root-cause identificada:**
Mismatch entre lo que retorna el backend (RPC) y lo que espera el frontend:
- Backend: `confirm_handoff()`, `confirm_return()`, `completeRental()` retornan **UUID** (el event_id)
- Frontend: Espera **boolean** (true/false)
- Lógica: `if (data === true)` con UUID siempre es false
- Resultado: Se ejecuta `toast.error()` aunque la operación fue exitosa

---

## 🐛 Root-Cause por Acción

### 1️⃣ `confirmHandoff` (RPC: confirm_handoff)

**RPC Actual (línea 340-410 de 20260121_timeline_disputes_system.sql):**
```sql
CREATE OR REPLACE FUNCTION public.confirm_handoff(p_rental_id UUID)
RETURNS UUID AS $$  ← RETORNA UUID
...
    v_event_id := public.log_rental_event(...);
    RETURN v_event_id;  ← RETORNA EL EVENT_ID (UUID)
END;
```

**Frontend (RentalProgressWizard.tsx línea ~94):**
```typescript
case 'HANDOFF_CONFIRMED':
    success = await rentalEventsService.confirmHandoff(rentalId);
    // success = UUID, no boolean!
    if (success) toast.success('¡Entrega confirmada!');
    break;
```

**rentalEventsService.ts:**
```typescript
export async function confirmHandoff(rentalId: string): Promise<boolean> {
    const { data, error } = await supabase
        .rpc('confirm_handoff', { p_rental_id: rentalId });

    if (error) {
        console.error('Error confirming handoff:', error);
        return false;
    }

    return data === true;  ← BUG: UUID !== true → retorna false
}
```

**Traza de ejecución:**
1. Click "Confirmar entrega" → `handleAction('HANDOFF_CONFIRMED')`
2. Llama `confirmHandoff(rentalId)` → RPC retorna UUID (ej. "a1b2c3d4...")
3. Frontend recibe `data = "a1b2c3d4..."` (no error)
4. Chequea `data === true` → false
5. Llama `toast.error('No se pudo completar la acción')`
6. PERO en background: `refresh()` trae datos actualizados
7. El evento YA ESTÁ en DB → progreso se recalcula y sube

**¿Por qué el paso se marca completado igual?**
- Después de `toast.error()`, llama `refresh()` en el finally (línea 114 de RentalProgressWizard)
- El refresh trae eventos reales de DB
- El evento `HANDOFF_CONFIRMED` ya existe (RPC fue exitoso)
- El hook `useRentalProgress` recalcula y paso muestra como ✓

**Conclusión:** Error visual, operación real ✅

---

### 2️⃣ `confirmReturn` & `completeRental`

**Mismo patrón:**
- `confirm_return` → RETURNS UUID (línea 420)
- `complete_rental` → RETURNS UUID (línea 477)
- Frontend espera boolean
- Resultado: `data === true` es false aunque RPC fue OK

---

## 📸 Bug Visual del Paso

En primera captura: **"Paso 6 de 5"** (sin sentido)

**Posible origen:**
```typescript
// RentalProgressWizard.tsx ~línea 200-ish
// Puede estar calculando currentStepIndex mal
const currentStepIndex = progress.completedCount;  // Si es 6, muestra "6"
const totalSteps = 6;

// Pero después muestra "Paso 6 de 5" ???
// Probablemente haya lógica de cálculo con off-by-one
```

Necesitaré revisar dónde renderiza "Paso X de Y".

---

## ⚠️ Problemas Secundarios Encontrados

### A) Uploader automático de fotos

**RentalProgressWizard ~línea 132:**
```tsx
<BookingEvidence
    rentalId={request.rental_id}
    type="handoff"
    canUpload={isOwner || isRenter}
    title="📦 Fotos de Entrega"
    ...
    onUploadComplete={handlePhotoUploadComplete}
/>
```

**BookingEvidence.tsx:**
- Probablemente hace upload automático al seleccionar
- No hay modo "staging" (seleccionar múltiples, ver previews, luego botón "Subir")
- El paso se marca completado después del upload, no verificando mínimo de fotos

**Síntoma reportado:** "Al seleccionar UNA sola foto se marca el paso como completado automáticamente"

---

## 📊 Matriz de Afecciones

| RPC | Retorna | Frontend Espera | Error? | Paso Completa? |
|-----|---------|-----------------|--------|---|
| confirm_handoff | UUID | boolean | SÍ (toast error) | SÍ (después refresh) |
| confirm_return | UUID | boolean | SÍ | SÍ |
| complete_rental | UUID | boolean | SÍ | SÍ |
| mark_handoff_uploaded | boolean | boolean | NO | ? |
| mark_return_uploaded | boolean | boolean | NO | ? |

---

## 🔧 Fix Plan

### FASE 1: Corregir Mismatch RPC/Frontend

**Opción A: Cambiar RPCs a retornar JSON (Recomendado)**
```sql
RETURNS JSONB AS $$
...
    RETURN jsonb_build_object(
        'ok', true,
        'event_id', v_event_id,
        'message', 'Handoff confirmado correctamente'
    );
END;
```

Ventajas:
- Contrato claro
- Extensible (warnings, data adicional)
- Mismo estándar para todas las RPCs

**Opción B: Mantener UUID pero cambiar chequeo en frontend**
```typescript
return data !== null && data !== undefined;
```

Desventajas:
- Frágil
- Si error es null por RLS → se interpreta como OK

**Recomendación:** Opción A (JSONB)

### FASE 2: Rehacer Uploader

- Input file múltiple
- Modo staging (sin upload inmediato)
- Preview grid
- Remove button
- Botón "Subir X fotos"
- Valida mínimo fotos después de upload
- Si < mínimo: warning, paso NO completa

---

## 🎯 Acciones Inmediatas

1. **Reproducción confirmada** ✅
   - Toast error SÍ aparece
   - Paso SÍ completa (gracias al refresh)
   - Mismatch data type confirmado

2. **Siguiente:** Cambiar RPCs a JSONB y actualizar frontend
   - Total: 5 RPCs (confirm_handoff, confirm_return, complete_rental, mark_handoff_uploaded, mark_return_uploaded)

3. **Luego:** Rehacer BookingEvidence/uploader

---

## 📝 Verificación de Bug

### DevTools Network (esperado)

1. Click "Confirmar entrega"
2. Request POST a `confirm_handoff`
3. Response: `200 OK` con data = `"a1b2c3d4..."` (UUID string)
4. Frontend recibe error porque `"a1b2c3d4..." !== true`
5. Toast error rojo
6. Pero evento está en DB ✓

### DevTools Console (esperado)

No debe haber "Error confirming handoff" porque Supabase no retorna error.

---

## 🔗 Archivos Clave

| Archivo | Línea | Problema |
|---------|-------|----------|
| `supabase/migrations/20260121_timeline_disputes_system.sql` | 340, 420, 477 | RPCs retornan UUID, no JSONB |
| `src/services/rentalEventsService.ts` | ~44, ~69, ~88 | Chequean `data === true` |
| `src/pages/RentalProgressWizard.tsx` | ~94, ~108 | Toast.error si `!success` |
| `src/components/rental/RentalActions.tsx` | ~91 | Same issue |
| `src/components/booking/BookingEvidence.tsx` | ? | Auto-upload, no staging |

---

## 🚀 Siguientes Pasos

**FASE 1 (Fixing False Error):**
1. Refactor RPCs: Retornar JSONB en lugar de UUID
2. Actualizar frontend a parsear JSONB
3. Mejorar lógica de toast (solo error si ok=false)

**FASE 2 (Uploader Staging):**
1. Cambiar BookingEvidence a modo staging
2. Agregar preview, remove, multi-select
3. Botón "Subir" explícito

**FASE 3 (Validaciones Mínimo Fotos):**
1. Después de upload, verificar count >= MIN
2. RPC `mark_handoff_uploaded` ya chequea (¿verificar?)

---

## 📌 Conclusión

El **false error toast** es un resultado de la arquitectura:
- RPC devuelve UUID (éxito)
- Frontend espera boolean
- Esto genera `success=false` incorrectamente
- Pero el refresh posterior trae el estado real, así que UX no se rompe completamente
- Solo hay ruido visual (toast rojo) mientras el estado real es correcto

**Severidad:** MEDIA
- **UX Impact:** Alto (confunde al usuario con error falso)
- **Data Impact:** NULO (datos se guardan correctamente)
- **Regresión Risk:** BAJO (fix es straightforward)
