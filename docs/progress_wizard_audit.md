# Progress Wizard Audit - Root Cause Analysis

**Date:** 2026-01-21  
**Objetivo:** Identificar por qué la progress bar muestra "0/6 pasos" aunque las fotos estén subidas y marcadas como "Completado".

---

## FASE 0.1 — Archivos Identificados

### Páginas y Componentes
| Archivo | Propósito | Estado |
|---------|-----------|--------|
| [src/pages/SolicitudDetail.tsx](../src/pages/SolicitudDetail.tsx) | Página actual con "Progreso del alquiler" | A modificar |
| [src/components/rental/RentalTimeline.tsx](../src/components/rental/RentalTimeline.tsx) | Componente de timeline/stepper | **ROOT CAUSE** |
| [src/components/rental/RentalActions.tsx](../src/components/rental/RentalActions.tsx) | Botones de acción (confirmar, completar) | A revisar |
| [src/components/booking/BookingEvidence.tsx](../src/components/booking/BookingEvidence.tsx) | Upload de fotos | OK, pero desconectado |

### Servicios
| Archivo | Propósito | Estado |
|---------|-----------|--------|
| [src/services/rentalEventsService.ts](../src/services/rentalEventsService.ts) | Llamadas RPC para eventos | A revisar |
| [src/services/itemImagesService.ts](../src/services/itemImagesService.ts) | Upload de booking_media + RPC | **PROBLEMA PARCIAL** |
| [src/services/disputesService.ts](../src/services/disputesService.ts) | Disputas | OK |

### Migraciones SQL
| Archivo | Propósito | Estado |
|---------|-----------|--------|
| [supabase/migrations/20260121_timeline_disputes_system.sql](../supabase/migrations/20260121_timeline_disputes_system.sql) | Tablas + RPCs + Triggers | **¿EJECUTADO?** |

---

## FASE 0.2 — ROOT CAUSE ANALYSIS 🔴

### **BUG PRINCIPAL: La progress bar depende de `events` pero el array llega VACÍO**

El componente `RentalTimeline.tsx` calcula el progreso así:
```typescript
const completedEventTypes = new Set(events.map(e => e.event_type));
let lastCompletedIndex = -1;
EXPECTED_FLOW.forEach((type, index) => {
    if (completedEventTypes.has(type)) {
        lastCompletedIndex = index;
    }
});
// Progress = (lastCompletedIndex + 1) / 6
```

Si `events = []`, entonces `lastCompletedIndex = -1`, y el progreso es `(−1 + 1) / 6 = 0/6`.

### **¿Por qué `events` está vacío?**

**Cadena de datos:**
1. `SolicitudDetail.tsx` llama a `rentalEventsService.getEvents(request.rental_id)`
2. `rentalEventsService.getEvents()` llama a `supabase.rpc('get_rental_events', { p_rental_id })`
3. El RPC consulta la tabla `rental_events`

**Posibles causas:**

| # | Causa | Probabilidad | Verificación |
|---|-------|--------------|--------------|
| 1 | **La migración SQL nunca se ejecutó** | ALTA | No existe tabla `rental_events` en Supabase |
| 2 | **El trigger `trg_auto_create_rental_event` no existe** | ALTA | Los rentals existentes no tienen `RENTAL_CREATED` |
| 3 | **El RPC `mark_handoff_uploaded` falla silenciosamente** | MEDIA | Error en console pero se ignora |
| 4 | **RLS bloquea lectura de `rental_events`** | MEDIA | El usuario no tiene permiso |
| 5 | **El `rental_id` es inválido o no coincide** | BAJA | UUID mismatch |

### **Evidencia del bug:**

En `itemImagesService.ts` línea 352-356:
```typescript
const { error: rpcError } = await supabase.rpc(rpcName, { p_rental_id: rentalId });
if (rpcError) {
    // Log but don't fail - the media was uploaded successfully
    console.warn(`Timeline event not created (${rpcName}):`, rpcError.message);
}
```

**El error se IGNORA completamente.** El usuario ve "fotos subidas" pero el evento nunca se crea si:
- El RPC no existe
- El usuario no tiene permisos
- La tabla `rental_events` no existe

---

## FASE 0.3 — Verificación Requerida en Supabase

**Ejecutar en Supabase SQL Editor:**

```sql
-- 1. ¿Existe la tabla rental_events?
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'rental_events'
) AS table_exists;

-- 2. ¿Hay eventos en rental_events?
SELECT COUNT(*) as total_events FROM rental_events;

-- 3. ¿Existe el trigger?
SELECT EXISTS (
    SELECT FROM pg_trigger WHERE tgname = 'trg_auto_create_rental_event'
) AS trigger_exists;

-- 4. ¿Existe el RPC get_rental_events?
SELECT EXISTS (
    SELECT FROM information_schema.routines 
    WHERE routine_schema = 'public' AND routine_name = 'get_rental_events'
) AS rpc_exists;

-- 5. Ver rentals activos y sus eventos
SELECT r.id, r.status, r.created_at,
       (SELECT COUNT(*) FROM rental_events WHERE rental_id = r.id) as event_count
FROM rentals r
WHERE r.status = 'active'
ORDER BY r.created_at DESC
LIMIT 10;

-- 6. Ver booking_media para esos rentals
SELECT rental_id, type, COUNT(*) as photo_count
FROM booking_media
WHERE rental_id IN (SELECT id FROM rentals WHERE status = 'active')
GROUP BY rental_id, type;
```

---

## FASE 0.4 — Plan de Solución

### ESCENARIO A: La migración NO fue ejecutada

**Acción:**
1. Ejecutar [20260121_timeline_disputes_system.sql](../supabase/migrations/20260121_timeline_disputes_system.sql) en Supabase SQL Editor
2. Crear eventos `RENTAL_CREATED` retroactivos para rentals existentes:
```sql
INSERT INTO rental_events (rental_id, event_type, actor_id, payload)
SELECT id, 'RENTAL_CREATED', renter_id, 
       jsonb_build_object('item_id', item_id, 'retroactive', true)
FROM rentals
WHERE NOT EXISTS (
    SELECT 1 FROM rental_events 
    WHERE rental_events.rental_id = rentals.id 
    AND event_type = 'RENTAL_CREATED'
);
```

### ESCENARIO B: La migración SÍ fue ejecutada pero hay bugs

**Acción:**
1. Corregir el cálculo del progreso para que NO dependa solo de `rental_events`
2. Implementar cálculo HÍBRIDO:
   - Paso 1: rentals.id existe → completado
   - Paso 2: COUNT(booking_media WHERE type='handoff') >= 3 → completado
   - Paso 3: rental_events tiene HANDOFF_CONFIRMED → completado
   - etc.

---

## FASE 0.5 — Decisión Arquitectónica

### **FUENTE DE VERDAD: HÍBRIDA (DB + Cálculo Frontend)**

| Paso | Fuente de Verdad | Condición |
|------|------------------|-----------|
| 1. Reserva creada | `rentals.id` existe | Siempre true si hay rental |
| 2. Fotos entrega | `booking_media` count | `COUNT(type='handoff') >= MIN_PHOTOS` |
| 3. Entrega confirmada | `rental_events` | `HANDOFF_CONFIRMED` exists |
| 4. Fotos devolución | `booking_media` count | `COUNT(type='return') >= MIN_PHOTOS` |
| 5. Devolución confirmada | `rental_events` | `RETURN_CONFIRMED` exists |
| 6. Completado | `rentals.status` + event | `status='completed'` |

### **Constantes:**
```typescript
const MIN_HANDOFF_PHOTOS = 3;
const MIN_RETURN_PHOTOS = 3;
```

---

## FASE 0.6 — Archivos a Crear/Modificar

### Crear:
1. `src/hooks/useRentalProgress.ts` — Hook único para datos + cálculo
2. `src/pages/RentalProgressWizard.tsx` — Nueva página wizard
3. `src/components/rental/RentalProgressSummary.tsx` — Card compacta para resumen
4. `src/components/rental/ProgressStepPanel.tsx` — Panel de paso activo en wizard
5. `src/lib/rentalProgress.ts` — Lógica de cálculo de progreso (pura)

### Modificar:
1. `src/pages/SolicitudDetail.tsx` — Quitar timeline actual, poner summary + botón
2. `src/services/itemImagesService.ts` — NO ignorar error de RPC
3. `src/App.tsx` — Añadir ruta `/rentals/:id/progress`

### NO modificar (mantener compatibilidad):
- Sistema de chat
- Sistema de disputas existente
- Listados de items

---

## FASE 0.7 — Plan de Implementación Incremental

| Orden | Tarea | Riesgo |
|-------|-------|--------|
| 1 | Verificar Supabase (ejecutar queries arriba) | Bajo |
| 2 | Si falta, ejecutar migración SQL | Medio |
| 3 | Crear `useRentalProgress` con cálculo híbrido | Bajo |
| 4 | Crear `RentalProgressSummary` | Bajo |
| 5 | Modificar `SolicitudDetail` para usar nuevo hook | Medio |
| 6 | Crear página `RentalProgressWizard` | Bajo |
| 7 | Añadir ruta en `App.tsx` | Bajo |
| 8 | Testing E2E | Alto |

---

## Siguiente Paso Inmediato

**ANTES de implementar, el usuario debe:**

1. Abrir Supabase SQL Editor
2. Ejecutar las queries de verificación de la FASE 0.3
3. Confirmar si la migración `20260121_timeline_disputes_system.sql` fue ejecutada

**Si NO fue ejecutada:** Ejecutar la migración completa primero.

**Si SÍ fue ejecutada:** Proceder con implementación del hook híbrido.
