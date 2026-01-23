# Evidence Min/Max Test Plan

## Fecha: 2026-01-22
## Contexto: Nuevas reglas MIN=2, MAX=6 por parte

---

## 📋 REGLAS ACTUALIZADAS

| Parámetro | Valor Anterior | Valor Nuevo |
|-----------|----------------|-------------|
| MIN_PHOTOS_PER_PARTY | 3 | 2 |
| MAX_PHOTOS_PER_PARTY | 8 | 6 |

**Lógica de completado:**
- Un paso de fotos (entrega/devolución) se completa cuando:
  - Owner tiene >= 2 fotos subidas, **Y**
  - Renter tiene >= 2 fotos subidas

---

## 🧪 TEST CASES

### TEST 1: Límite Máximo Bloqueante (Owner llega a 6)

**Precondiciones:**
- Usuario logueado como owner
- Rental en paso de fotos de entrega
- Owner tiene 5 fotos subidas

**Pasos:**
1. Seleccionar 2 fotos nuevas para subir
2. Verificar comportamiento

**Resultado esperado:**
- ✅ Solo 1 foto se añade a staging
- ✅ Aparece toast: "Solo puedes añadir 1 foto(s) más. Se descartaron 1."
- ✅ Subir esa foto lleva a 6 total

**Después de tener 6:**
- ✅ Botón "Seleccionar fotos" desaparece
- ✅ Aparece mensaje permanente azul: "Has alcanzado el máximo de 6 fotos permitidas para este paso."

---

### TEST 2: Selección con slots limitados

**Precondiciones:**
- Usuario con 4 fotos subidas
- 2 fotos en staging
- (Total: 6 = MAX)

**Pasos:**
1. Intentar seleccionar más fotos

**Resultado esperado:**
- ✅ Toast de error: "Has alcanzado el máximo de 6 fotos permitidas."
- ✅ No se añaden fotos a staging

---

### TEST 3: Ambos cumplen mínimo → Paso completa y wizard avanza

**Precondiciones:**
- Rental nuevo, ambos con 0 fotos de entrega
- Owner y renter logueados (sesiones separadas)

**Pasos (Owner):**
1. Subir 2 fotos como owner
2. Verificar banner

**Pasos (Renter):**
3. Subir 2 fotos como renter
4. Verificar banner y wizard

**Resultado esperado:**
- Con owner=2, renter=0: Banner dice "Pendiente"
- Con owner=2, renter=2: 
  - ✅ Banner dice "Evidencias completas: Ambas partes han cumplido el mínimo requerido"
  - ✅ Step "Fotos de entrega" muestra checkmark verde
  - ✅ Wizard avanza automáticamente al paso "Entrega confirmada"

---

### TEST 4: Eliminar reduce conteo (wizard retrocede si procede)

**Precondiciones:**
- Owner tiene 3 fotos, renter tiene 2 (paso "completo")
- Wizard está en paso "Entrega confirmada"

**Pasos:**
1. Renter elimina 1 foto (queda con 1)
2. Verificar estado

**Resultado esperado:**
- ✅ Banner cambia a "Pendiente: El paso se completará cuando ambas partes lleguen a 2/2"
- ✅ Step "Fotos de entrega" pierde checkmark
- ✅ El wizard puede retroceder visualmente (o mostrar paso como incompleto)

---

### TEST 5: Fotos rotas ("Object not found") - Comportamiento

**Precondiciones:**
- Usuario tiene fotos que muestran "Object not found" en el grid

**Verificaciones:**
1. ✅ Tile muestra estado de error con icono
2. ✅ Tile muestra texto "Object not found" o similar
3. ✅ Botón "Reintentar" está visible
4. ✅ Botón "Eliminar" está visible (si isDeletable=true)
5. ✅ Al eliminar, la foto se borra de DB y el conteo se actualiza

**Decisión de conteo:**
- ✅ Fotos rotas SÍ cuentan para min/max (son registros válidos en DB)
- ✅ Usuario puede eliminarlas si quiere y subir nuevas

---

### TEST 6: Consistencia banner ↔ step ↔ wizard

**Verificar que todos usan la misma condición:**

| Componente | Condición esperada |
|------------|-------------------|
| Banner "Evidencias completas" | `ownerCount >= 2 && renterCount >= 2` |
| Step `HANDOFF_PHOTOS.isComplete` | `ownerHandoff >= 2 && renterHandoff >= 2` |
| Wizard currentStep | Avanza cuando step anterior está complete |

**Test:**
1. Buscar en código que todas usen `MIN_PHOTOS_PER_PARTY` (no hardcodes)
2. Verificar que el banner y el step muestran el mismo estado

---

### TEST 7: Progreso en fotos de devolución (RETURN_PHOTOS)

**Mismo flujo que TEST 3 pero para devolución:**
- ✅ Requiere que paso HANDOFF_CONFIRMED esté completo primero
- ✅ Owner sube 2 + Renter sube 2 → paso completa
- ✅ Wizard avanza a "Devolución confirmada"

---

## 🔍 REGRESIONES A VERIFICAR

1. **Upload básico funciona** - subir 1 foto, aparece en grid
2. **Eliminar funciona** - eliminar foto, desaparece del grid
3. **Reintentar funciona** - foto fallida, click reintentar, intenta de nuevo
4. **Visor funciona** - click en foto, se abre modal ampliado
5. **Contador se actualiza** - "Tus fotos (X/6)" refleja el número real

---

## ✅ CHECKLIST DE VERIFICACIÓN POST-DEPLOY

- [ ] MIN_PHOTOS_PER_PARTY = 2 en código
- [ ] MAX_PHOTOS_PER_PARTY = 6 en código
- [ ] Mensaje de límite máximo aparece cuando yourCount >= 6
- [ ] Botón "Seleccionar fotos" deshabilitado/oculto cuando >= 6
- [ ] Selección clamps a slots disponibles con warning
- [ ] Banner y step usan misma condición
- [ ] Wizard avanza automáticamente cuando ambos llegan a mínimo
- [ ] Fotos rotas muestran error + reintentar + eliminar

