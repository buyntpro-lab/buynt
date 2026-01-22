# ✅ CHECKLIST VISUAL: Cómo Aplicar el Fix

## 📍 PASO 1: SQL 

```
[ ] Abre https://supabase.com
[ ] Login si es necesario
[ ] Selecciona proyecto "buynt"
[ ] Click en "SQL Editor" (lado izquierdo)
[ ] Abre archivo: SQL_A_EJECUTAR.md
[ ] Copia TODO el código SQL (desde "-- ====" hasta fin)
[ ] Pégalo en el editor de Supabase
[ ] Click en botón "Run" (o Cmd+Enter)
[ ] Espera... (toma ~5 segundos)
[ ] Verifica: Si dice "Success", ✅ OK

VERIFICACIÓN:
[ ] Ejecuta esta query en mismo editor:
    SELECT COUNT(*) FROM pg_proc 
    WHERE proname IN ('confirm_handoff', 'confirm_return', 'complete_rental', 
    'mark_handoff_uploaded', 'mark_return_uploaded')
    AND prorettype = 'jsonb'::regtype;

[ ] Resultado debe ser: 5
```

---

## 📍 PASO 2: Frontend

```
[ ] Terminal: cd c:\Users\Testing\Desktop\buynt
[ ] git add .
[ ] git commit -m "fix: false error toast + refactor photo uploader"
[ ] git push origin main
[ ] Espera a que Vercel deplogue (~2 min)
[ ] Verifica en Vercel dashboard: Green checkmark
[ ] O abre app: ¿carga sin errores?
```

---

## 📍 PASO 3: Verificación

```
[ ] Abre tu app en navegador
[ ] Navega a: /rentals/{rental_id_de_un_alquiler}/progress
    (o desde la página de solicitud → "Continuar")

PRUEBA FOTO:
[ ] Selecciona 1 foto
    → ¿Aparece en "Fotos para subir"? ✅
    → ¿NO se sube automáticamente? ✅
[ ] Selecciona 2 fotos más (total 3)
    → ¿Se ven en preview? ✅
[ ] Remove 1 foto (quedan 2)
    → ¿Se eliminó del staging? ✅
[ ] Selecciona 1 más (total 3 nuevamente)
[ ] Click botón "Subir 3 fotos"
    → ¿Comienza a subir? ✅
    → ¿Se ven "Fotos subidas (3)"? ✅
    → ¿Dice "Completado" en status? ✅

PRUEBA CONFIRMACIÓN:
[ ] Click "Confirmar entrega"
    → ¿Sale toast VERDE con mensaje? ✅
    → ¿SIN toast rojo "No se pudo"? ✅
[ ] Verifica que paso se marca completo ✅

PRUEBA DEVOLUCIÓN:
[ ] Haz scroll a paso 4 (Fotos devolución)
[ ] Repite mismo proceso con fotos devolución ✅

PRUEBA COMPLETAR:
[ ] Click "Completar alquiler"
    → ¿Toast VERDE? ✅
    → ¿SIN error rojo? ✅
[ ] Paso 6 debe decir "Completado" ✅
```

---

## 🎯 Si TODO esto está ✅

**¡ÉXITO!** El fix está funcionando.

No hay más false error toasts.
Las fotos tienen un flujo controlado.
Todos los pasos avanzan correctamente.

---

## ❌ Si Algo Falla

### Síntoma: Toast error rojo sigue apareciendo

**Solución:**
```
1. Abre DevTools (F12)
2. Ve a Network tab
3. Ejecuta una acción (ej. "Confirmar entrega")
4. Mira el request a RPC
5. Abre Response
6. ¿Dice "ok": true? → SQL funcionó, problema en frontend
7. ¿Dice "ok": false? → SQL no se ejecutó, reintentar PASO 1
```

### Síntoma: Foto sigue auto-subiéndose

**Solución:**
```
1. Verifica que RentalProgressWizard.tsx importa:
   BookingEvidenceUploader (no BookingEvidence)
2. Recarga la página (Ctrl+Shift+R)
3. Si sigue: git pull, rebuild, redeploy
```

### Síntoma: "RPC doesn't exist" error

**Solución:**
```
1. Verifica que copiaste TODO el SQL
   (desde primer "-- ===" hasta final)
2. No truncaste en medio
3. Ejecutaste en Supabase SQL Editor (no local)
4. Reintentar PASO 1
```

---

## 📞 Soporte

Documentación completa:
- **Resumen rápido:** RESUMEN_EJECUTIVO.md
- **Análisis técnico:** docs/progress_false_error_root_cause.md
- **SQL details:** docs/PHASE1_SQL_EXECUTION_CHECKLIST.md
- **UX details:** docs/PHASE2_UPLOADER_REFACTOR.md
- **Guía completa:** docs/ENTREGA_FINAL_COMPLETE.md

---

## ⏱️ Tiempo Total

```
SQL:      2 min
Deploy:   3 min
Testing:  5 min
─────────────
TOTAL:   ~10 min
```

---

## 🎉 Listo Para Producción

Una vez TODO está ✅, el fix está listo.

No requiere cambios adicionales.
No hay configuración extra.
Es backward compatible.

**Status: READY** ✅
