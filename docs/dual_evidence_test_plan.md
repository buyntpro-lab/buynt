# Dual Evidence System - Test Plan

**Fecha:** 2026-01-22  
**Sistema:** Evidencias separadas por parte (owner/renter) con progreso dual

---

## 1. CASOS DE PRUEBA - PROGRESO DUAL

### Caso 1: Owner sube 3 handoff, Renter 0
**Precondición:**  
- Rental activo con owner_id=A, renter_id=B
- Auth user = A (owner)

**Acciones:**
1. Navegar a wizard progreso `/rentals/{id}/progress`
2. Ver paso "Fotos de entrega"
3. Subir 3 fotos en sección "Tus fotos"

**Resultado esperado:**
```
Paso "Fotos de entrega":
- Tu parte: 3/3 ✅
- Otra parte: 0/3 ❌
- Estado: ⚠️ "Paso completado cuando ambos lleguen a 3/3"
- Progreso general: Paso NO marcado como completo
- Botón "Confirmar entrega": DESHABILITADO
```

---

### Caso 2: Renter sube 3 handoff → Paso completa
**Precondición:**  
- Continúa de Caso 1 (owner ya tiene 3)
- Auth user = B (renter)

**Acciones:**
1. Navegar a wizard progreso `/rentals/{id}/progress`
2. Ver paso "Fotos de entrega"
3. Subir 3 fotos en sección "Tus fotos"

**Resultado esperado:**
```
Paso "Fotos de entrega":
- Tu parte: 3/3 ✅
- Otra parte: 3/3 ✅ (owner)
- Estado: ✅ "Fotos de entrega documentadas"
- Progreso general: Paso MARCADO como completo
- Siguiente paso activo: "Entrega confirmada" (owner debe confirmar)
```

---

### Caso 3: Ambos suben return 3 → Return completo
**Precondición:**  
- Pasos 1-3 completados (handoff completo, confirmado)
- Owner y Renter con 0 fotos return

**Acciones:**
1. Owner sube 3 fotos return
2. Renter sube 3 fotos return

**Resultado esperado:**
```
Paso "Fotos de devolución":
- Owner: 3/3 ✅
- Renter: 3/3 ✅
- Estado: ✅ "Fotos de devolución documentadas"
- Progreso: 4/6 pasos completos
- Siguiente: "Devolución confirmada"
```

---

### Caso 4: Usuario ajeno no ve fotos
**Precondición:**  
- Rental entre owner=A, renter=B
- Auth user = C (usuario diferente)

**Acciones:**
1. Intentar navegar a `/rentals/{id}/progress`

**Resultado esperado:**
```
- RLS bloquea query de rental (no es participant)
- UI muestra: "No tienes permiso" o redirect a home
- No se exponen fotos ni datos del rental
```

---

### Caso 5: Rentals legacy con solo 1 lado
**Precondición:**  
- Rental creado ANTES de dual evidence
- Solo owner subió 3 fotos handoff
- Renter subió 0

**Acciones:**
1. Auth user = Renter
2. Navegar a wizard

**Resultado esperado:**
```
Paso "Fotos de entrega":
- Tu parte: 0/3 ❌
- Otra parte: 3/3 ✅ (owner)
- Estado: ⚠️ "Faltan fotos de tu parte"
- Paso NO completo (correcto)
- UI NO crashea, funciona normal
```

---

### Caso 6: Confirmaciones solo disponibles con ambos sets completos
**Precondición:**  
- Owner handoff: 3
- Renter handoff: 2 (NO completo)

**Acciones:**
1. Auth user = Owner
2. Ver botón "Confirmar entrega"

**Resultado esperado:**
```
- Botón "Confirmar entrega": DESHABILITADO
- Tooltip/hint: "Ambas partes deben subir sus fotos primero"
- Owner NO puede avanzar hasta renter suba mínimo
```

---

## 2. CASOS DE PRUEBA - UI DUAL

### Caso 7: Secciones "Tus fotos" / "Otra parte" visibles
**Precondición:**  
- Rental con owner=A, renter=B
- Owner: 2 handoff, Renter: 1 handoff

**Acciones:**
1. Auth user = A (owner)
2. Ir a paso "Fotos de entrega"

**Resultado esperado:**
```
Sección "Tus fotos (Entrega)":
- Grid con 2 thumbnails
- Uploader staging visible
- Botón "Subir X fotos"
- Texto "Mínimo: 3" (faltan 1)

Sección "Fotos de la otra parte (Entrega)":
- Grid con 1 thumbnail (del renter)
- Botón "Revisar fotos" (abre modal)
- NO tiene uploader (readonly)
- Texto "Arrendatario: 1/3"
```

---

### Caso 8: Botón "Revisar fotos" abre viewer modal
**Precondición:**  
- Owner con 3 handoff fotos subidas

**Acciones:**
1. Auth user = Renter
2. Click en "Revisar fotos" en sección "Otra parte"

**Resultado esperado:**
```
- Modal abre con carrusel
- Muestra foto 1/3
- Botones prev/next funcionan
- Metadata visible:
  - "Subido por: Arrendador"
  - Fecha/hora: "22 Ene 2026, 10:30 AM"
  - Nota (si existe)
- Botón cerrar (X)
- Zoom opcional (si implementado)
```

---

### Caso 9: Progreso dual en resumen (no wizard)
**Precondición:**  
- Owner handoff: 3, Renter handoff: 1
- Ambos return: 0

**Acciones:**
1. Ver componente `RentalProgressSummary` (en SolicitudDetail)

**Resultado esperado:**
```
Mini progress bar: 1/6 (solo reservation completo)

Estado rápido:
- Entrega:
  · Tú: 3/3 ✅
  · Otra parte: 1/3 ⚠️
  
- Devolución:
  · Tú: 0/3 ❌
  · Otra parte: 0/3 ❌

Botón: "Continuar progreso" → /rentals/{id}/progress
```

---

## 3. CASOS DE PRUEBA - SUBIDA SEPARADA

### Caso 10: uploaded_by correcto al subir
**Precondición:**  
- Auth user = Renter (id=B)

**Acciones:**
1. Subir 1 foto handoff via uploader staging

**SQL verificación:**
```sql
SELECT id, uploaded_by, type
FROM booking_media
WHERE rental_id = '{id}'
ORDER BY created_at DESC
LIMIT 1;
```

**Resultado esperado:**
```
uploaded_by = 'B' (renter id) ✅
type = 'handoff' ✅
```

---

### Caso 11: Refetch recalcula counts correctamente
**Precondición:**  
- Owner: 2, Renter: 2 (ambos incompletos)

**Acciones:**
1. Auth user = Owner
2. Subir 1 foto más
3. Observar UI sin refresh manual

**Resultado esperado:**
```
- Tu parte: 2/3 → 3/3 (actualiza automático tras upload)
- Otra parte: 2/3 (sin cambio)
- Paso sigue incompleto (renter falta 1)
```

---

## 4. CASOS DE PRUEBA - RLS / SECURITY

### Caso 12: RLS policy funciona
**SQL directo (simulando usuario C ajeno):**
```sql
SET LOCAL jwt.claims.sub = 'user-c-id';
SELECT * FROM booking_media WHERE rental_id = '{rental-id}';
```

**Resultado esperado:**
```
Filas devueltas: 0 (policy bloquea)
Error: No permission
```

---

### Caso 13: Signed URLs solo para participants
**Precondición:**  
- Owner subió foto con path = 'bookings/{id}/handoff/{uuid}.webp'

**Acciones:**
1. Auth user = Renter (participant)
2. Llamar getSignedUrl(path)

**Resultado esperado:**
```
- URL retornada: https://...supabase.co/storage/...?token=... ✅
- URL válida por X minutos
- Imagen carga correctamente
```

**Acciones con usuario ajeno:**
1. Auth user = C (NO participant)
2. Llamar getSignedUrl(path)

**Resultado esperado:**
```
- RLS bloquea row de booking_media → no puede obtener path
- O signed URL válido pero Storage policy bloquea acceso
- Imagen NO carga (error 403/404)
```

---

## 5. CASOS DE REGRESIÓN (NO ROMPER)

### Caso 14: Chat no afectado
**Acciones:**
1. Navegar a `/chat/{rental-id}`
2. Enviar mensaje

**Resultado esperado:**
- Chat funciona normal
- No errores en consola relacionados con `partyCounts` undefined

---

### Caso 15: Disputas no afectadas
**Acciones:**
1. Crear disputa desde wizard
2. Ver panel de disputa

**Resultado esperado:**
- Disputa se crea correctamente
- Panel muestra fotos (sin importar separación dual)
- No crashes

---

## 6. PERFORMANCE

### Caso 16: Volumen alto de fotos
**Precondición:**  
- Rental con:
  - Owner: 8 handoff + 8 return = 16 fotos
  - Renter: 8 handoff + 8 return = 16 fotos
  - Total: 32 fotos

**Acciones:**
1. Cargar wizard progreso

**Resultado esperado:**
```
- Carga en <2 segundos
- Sin lag en UI
- Queries no duplicadas (verificar network tab)
```

---

## 7. COMPATIBILIDAD LEGACY (CRÍTICO)

### Caso 17: Rental con fotos uploaded_by unknown
**Simulación:**  
```sql
-- Insertar foto con uploaded_by que no es ni owner ni renter
INSERT INTO booking_media (rental_id, type, path, uploaded_by)
VALUES ('{rental-id}', 'handoff', 'test.webp', 'admin-user-id');
```

**Acciones:**
1. Cargar wizard

**Resultado esperado:**
```
- Foto NO cuenta para owner ni renter
- groupedMedia.handoff.unknown = [foto]
- Progreso NO crashea
- Warning en consola (opcional): "Foto con uploader desconocido"
```

---

## 8. CHECKLIST FINAL

Antes de marcar como completo, verificar:

- [ ] **Caso 1-3:** Progreso dual funciona correctamente
- [ ] **Caso 4:** RLS bloquea usuarios ajenos
- [ ] **Caso 5:** Rentals legacy no crashean
- [ ] **Caso 6:** Confirmaciones solo con ambos completos
- [ ] **Caso 7-9:** UI dual muestra correctamente
- [ ] **Caso 10-11:** Subida y refetch funciona
- [ ] **Caso 12-13:** RLS/Storage seguro
- [ ] **Caso 14-15:** Chat y disputas NO rotos
- [ ] **Caso 16:** Performance aceptable
- [ ] **Caso 17:** uploaded_by unknown no crashea

---

## 9. CRITERIOS DE ACEPTACIÓN

✅ **PASS:**  
- Todos los casos 1-17 pasan sin errores
- TypeScript 0 errores
- Console 0 errores críticos (warnings OK)
- Build exitoso

❌ **FAIL:**  
- Cualquier caso crashea la app
- RLS permite acceso no autorizado
- Rentals legacy crashean
- Chat o disputas rotos

---

## 10. HERRAMIENTAS DE TESTING

### Manual:
- Browser DevTools (Network, Console)
- Supabase SQL Editor (verificar queries)
- Multiple browser windows (owner + renter simulando)

### Queries útiles:
```sql
-- Ver todas las fotos de un rental con party
SELECT 
    bm.id,
    bm.type,
    bm.uploaded_by,
    CASE 
        WHEN bm.uploaded_by = r.owner_id THEN 'owner'
        WHEN bm.uploaded_by = r.renter_id THEN 'renter'
        ELSE 'unknown'
    END as party,
    bm.created_at
FROM booking_media bm
JOIN rentals r ON bm.rental_id = r.id
WHERE bm.rental_id = '{rental-id}'
ORDER BY bm.type, bm.created_at;

-- Contar por party
SELECT 
    type,
    CASE 
        WHEN bm.uploaded_by = r.owner_id THEN 'owner'
        WHEN bm.uploaded_by = r.renter_id THEN 'renter'
        ELSE 'unknown'
    END as party,
    COUNT(*) as count
FROM booking_media bm
JOIN rentals r ON bm.rental_id = r.id
WHERE bm.rental_id = '{rental-id}'
GROUP BY type, party;
```

---

**Estado:** Listo para ejecución  
**Responsable:** QA / Dev  
**Tiempo estimado:** 45-60 minutos de testing manual
