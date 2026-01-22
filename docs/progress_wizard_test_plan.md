# Plan de Pruebas: Sistema de Progreso de Alquiler

## Resumen de Cambios

### Archivos Creados
1. **`src/lib/rentalProgress.ts`** - Lógica pura de cálculo de progreso (HÍBRIDO: DB + conteo de fotos)
2. **`src/hooks/useRentalProgress.ts`** - Hook que obtiene datos y calcula progreso
3. **`src/components/rental/RentalProgressSummary.tsx`** - Tarjeta compacta de progreso
4. **`src/pages/RentalProgressWizard.tsx`** - Página wizard paso a paso

### Archivos Modificados
1. **`src/App.tsx`** - Añadida ruta `/rentals/:id/progress`
2. **`src/pages/SolicitudDetail.tsx`** - Reemplazada sección de timeline con nuevo summary

---

## Root Cause del Bug Original

**Síntoma:** Progress bar muestra "0/6 pasos" aunque se hayan subido fotos.

**Causa raíz identificada:**
```typescript
// RentalTimeline.tsx (código anterior)
const lastCompletedIndex = STEPS.findIndex(step => 
    step.eventType && !completedEventTypes.has(step.eventType)
) - 1;

// Si events = [], entonces completedEventTypes = Set([])
// Resultado: lastCompletedIndex = -1, progress = 0/6
```

**Por qué `events` está vacío:**
1. La tabla `rental_events` puede no existir (SQL migration no ejecutada)
2. El trigger `trg_auto_create_rental_event` puede no existir
3. Las RLS policies pueden estar bloqueando las queries
4. El RPC `get_rental_events` puede estar fallando silenciosamente

**Solución implementada:** Cálculo HÍBRIDO que no depende solo de `rental_events`:
```typescript
// Paso 2 HANDOFF_PHOTOS: verdadero si hay evento O si hay ≥3 fotos
return data.hasHandoffPhotosEvent || data.handoffPhotoCount >= MIN_HANDOFF_PHOTOS;
```

---

## Escenarios de Prueba

### Prerequisitos
- Tener 2 usuarios de prueba: `owner@test.com` y `renter@test.com`
- Tener al menos 1 artículo publicado por el owner
- Tener una solicitud ACEPTADA (con `rental_id`)

### Test 1: Verificar Progress Bar en Resumen
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Ir a `/solicitudes/{id}` como renter | Ver tarjeta "Progreso del Alquiler" |
| 2 | Verificar progress bar | Debe mostrar "1/6 pasos" (Reserva creada) |
| 3 | Verificar estado actual | Debe decir "Reserva creada" como completado |
| 4 | Click en "Continuar" | Debe navegar a `/rentals/{rental_id}/progress` |

### Test 2: Wizard - Paso 2 Fotos de Entrega
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Entrar al wizard como owner o renter | Ver los 6 pasos listados |
| 2 | Subir 1 foto de entrega | Progress bar sigue en 1/6 |
| 3 | Subir 2 fotos más (total 3) | Progress bar cambia a 2/6 |
| 4 | Verificar paso 2 | Debe mostrar checkmark verde |

### Test 3: Wizard - Paso 3 Confirmación de Entrega (Owner)
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Entrar como OWNER | Ver botón "Confirmar Entrega" en paso 3 |
| 2 | Click en "Confirmar Entrega" | Botón cambia a loading |
| 3 | Esperar confirmación | Progress bar cambia a 3/6 |
| 4 | Verificar como RENTER | Renter NO ve botón de confirmar |

### Test 4: Wizard - Paso 4 Fotos de Devolución
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Como cualquier usuario, subir 3+ fotos de devolución | Progress bar cambia a 4/6 |
| 2 | Verificar paso 4 | Debe mostrar checkmark verde |

### Test 5: Wizard - Paso 5 Confirmación de Devolución (Renter)
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Entrar como RENTER | Ver botón "Confirmar Devolución" en paso 5 |
| 2 | Click en "Confirmar Devolución" | Progress bar cambia a 5/6 |
| 3 | Verificar como OWNER | Owner NO ve botón de confirmar devolución |

### Test 6: Wizard - Paso 6 Completar Alquiler (Owner)
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Entrar como OWNER | Ver botón "Completar Alquiler" en paso 6 |
| 2 | Click en "Completar Alquiler" | Progress bar cambia a 6/6 |
| 3 | Verificar UI | Mostrar confeti o mensaje de éxito |

### Test 7: Disputas
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Abrir una disputa en el wizard | Panel de disputa se muestra |
| 2 | Verificar en Resumen | El DisputePanel aparece en SolicitudDetail |

### Test 8: Refresh y Persistencia
| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Completar pasos 1-3 | Progress muestra 3/6 |
| 2 | Refrescar página (F5) | Progress sigue en 3/6 |
| 3 | Cerrar y abrir navegador | Progress persiste |

---

## Verificación de SQL

### Queries para ejecutar en Supabase SQL Editor:

```sql
-- 1. Verificar que la tabla rental_events existe
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'rental_events'
) AS rental_events_exists;

-- 2. Verificar que la tabla booking_media existe
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'booking_media'
) AS booking_media_exists;

-- 3. Verificar que el trigger existe
SELECT tgname FROM pg_trigger 
WHERE tgname = 'trg_auto_create_rental_event';

-- 4. Verificar RLS policies en rental_events
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'rental_events';

-- 5. Contar eventos existentes (si la tabla existe)
SELECT event_type, COUNT(*) 
FROM rental_events 
GROUP BY event_type;

-- 6. Contar fotos por tipo
SELECT type, COUNT(*) 
FROM booking_media 
GROUP BY type;
```

### Si las tablas NO existen:

Ejecutar la migración completa:
```
supabase/migrations/20260121_timeline_disputes_system.sql
```

O manualmente en Supabase SQL Editor (copiar y pegar el contenido del archivo).

---

## Checklist de Despliegue

- [ ] Verificar tablas `rental_events`, `booking_media`, `rental_disputes` existen
- [ ] Verificar RPC `get_rental_events` existe
- [ ] Verificar trigger `trg_auto_create_rental_event` existe
- [ ] Verificar RLS policies permiten lecturas autenticadas
- [ ] Test con usuario owner
- [ ] Test con usuario renter
- [ ] Test de persistencia (refresh)
- [ ] Test de navegación entre páginas

---

## Componentes Visuales

### RentalProgressSummary (Resumen)
```
┌─────────────────────────────────────────────────┐
│ 📋 Progreso del Alquiler                        │
│                                                 │
│ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░ 2/6 pasos    │
│                                                 │
│ ✓ Reserva creada                                │
│ ✓ Fotos de entrega subidas                      │
│ → Confirmar entrega (pendiente)                 │
│                                                 │
│ [Ver detalles y continuar →]                    │
└─────────────────────────────────────────────────┘
```

### RentalProgressWizard (Wizard)
```
┌─────────────────────────────────────────────────┐
│ ← Volver                                        │
│                                                 │
│ Progreso del Alquiler                           │
│ ████████████░░░░░░░░░░░░░░░░░░░░░░ 3/6 pasos    │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ ✓ 1. Reserva creada                         │ │
│ │   Completado el 15 ene 2025                 │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ ✓ 2. Fotos de entrega                       │ │
│ │   5 fotos subidas (mínimo 3)                │ │
│ │   [Ver fotos]                               │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ ✓ 3. Confirmar entrega                      │ │
│ │   El propietario confirmó la entrega        │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ → 4. Fotos de devolución                    │ │
│ │   Próximo paso                              │ │
│ │   [Subir fotos de devolución]               │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ ○ 5. Confirmar devolución                   │ │
│ │   Pendiente                                 │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ ○ 6. Completar alquiler                     │ │
│ │   Pendiente                                 │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ▼ Historial de eventos                          │
│ ▼ ¿Problemas? Abrir disputa                     │
└─────────────────────────────────────────────────┘
```

---

## Notas Técnicas

### Constantes
```typescript
MIN_HANDOFF_PHOTOS = 3  // Mínimo fotos entrega
MIN_RETURN_PHOTOS = 3   // Mínimo fotos devolución
TOTAL_STEPS = 6         // Total de pasos
```

### Roles de Actor
| Paso | Actor responsable |
|------|-------------------|
| 1. Reserva | Sistema (automático) |
| 2. Fotos entrega | Ambos (owner + renter) |
| 3. Confirmar entrega | Owner |
| 4. Fotos devolución | Ambos (owner + renter) |
| 5. Confirmar devolución | Renter |
| 6. Completar | Owner |

### Estados de Paso
- `complete` - Paso terminado (checkmark verde)
- `current` - Paso activo (badge azul, CTA visible)
- `upcoming` - Paso futuro (gris, deshabilitado)
