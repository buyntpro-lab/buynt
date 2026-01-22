# 🔧 SQL Execution Checklist - False Error Toast Fix

## ⚠️ IMPORTANTE: ORDEN DE EJECUCIÓN

**Ejecuta EN ESTE ORDEN en Supabase SQL Editor:**

### PASO 1: Crear la migración de refactor
**Archivo:** `supabase/migrations/20260122_fix_rpc_return_types.sql`

Copia TODO el contenido del archivo y pégalo en Supabase SQL Editor.

**Qué hace:**
- Refactoriza 5 RPCs para retornar JSONB en lugar de UUID
- Cambios atomáticos: cada RPC se crea con CREATE OR REPLACE
- Sin efectos secundarios (no toca datos existentes)
- Cada RPC es idempotente (si ya existe un evento, retorna ok=true sin duplicar)

**RPCs afectadas:**
1. `mark_handoff_uploaded` - RETURNS JSONB
2. `mark_return_uploaded` - RETURNS JSONB
3. `confirm_handoff` - RETURNS JSONB
4. `confirm_return` - RETURNS JSONB
5. `complete_rental` - RETURNS JSONB

---

## ✅ VERIFICACIÓN POST-EJECUCIÓN

Después de ejecutar el SQL, verifica que todo está bien:

### Check 1: Verificar que las funciones retornan JSONB
```sql
SELECT proname, prorettype::regtype::text as return_type
FROM pg_proc
WHERE proname IN (
    'mark_handoff_uploaded',
    'mark_return_uploaded',
    'confirm_handoff',
    'confirm_return',
    'complete_rental'
)
AND pronamespace = 'public'::regnamespace;
```

**Resultado esperado:**
```
proname                  | return_type
------------------------+-----------
mark_handoff_uploaded    | jsonb
mark_return_uploaded     | jsonb
confirm_handoff          | jsonb
confirm_return           | jsonb
complete_rental          | jsonb
```

### Check 2: Verificar estructura de respuesta
```sql
-- Prueba mark_handoff_uploaded (reemplaza con un rental_id válido)
SELECT public.mark_handoff_uploaded('00000000-0000-0000-0000-000000000000'::uuid);
```

**Resultado esperado:**
```json
{
  "ok": false,
  "code": "not_authorized",
  "message": "No tienes permiso para esta acción"
}
```

### Check 3: Verificar RPC de confirmación (si tienes datos reales)
```sql
-- Si tienes un rental_id real con datos completos
SELECT public.confirm_handoff('your-rental-id'::uuid);
```

**Resultado esperado (éxito):**
```json
{
  "ok": true,
  "code": "success",
  "message": "Entrega confirmada correctamente",
  "data": {
    "event_id": "uuid-value",
    "photo_count": 3
  }
}
```

---

## 🔄 ROLLBACK (si es necesario)

Si algo sale mal, ejecuta esto para revertir a las versiones anteriores (ANTES de aplicar el patch):

```sql
-- Nota: Esto restaura las FIRMAS pero los eventos creados permanecerán
-- Solo sirve si NO has ejecutado acciones exitosas tras aplicar el patch

-- Cambiar mark_handoff_uploaded de vuelta a UUID
CREATE OR REPLACE FUNCTION public.mark_handoff_uploaded(
    p_rental_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS UUID AS $$
-- ... (original function body from 20260121_timeline_disputes_system.sql)
-- Copia la definición completa del archivo de migración original
$$
LANGUAGE plpgsql SECURITY DEFINER;

-- Repetir para las otras 4 funciones
-- (confirm_handoff, confirm_return, mark_return_uploaded, complete_rental)
```

⚠️ **Mejor alternativa:** Si las cosas no funcionan, contacta soporte para un snapshot restore.

---

## 📊 Impacto del Cambio

### ¿Qué cambia en el frontend?

| Aspecto | Antes | Después |
|--------|-------|---------|
| Return type | `boolean` | `RpcResponse` (JSONB) |
| Success check | `if (success)` | `if (response.ok)` |
| Error message | Genérico | `response.message` |
| Handling | `toast.error()` si `!success` | `toast.error()` si `!response.ok` |
| False errors | ✅ EXISTEN | ❌ ELIMINADOS |

### ¿Qué cambia en BD?

| Aspecto | Cambio |
|--------|--------|
| Datos existentes | NINGUNO |
| Eventos en `rental_events` | NINGUNO |
| Fotos en `booking_media` | NINGUNO |
| Estructura de tablas | NINGUNA |

---

## 🚀 DEPLOYMENT

### Orden de Despliegue

1. ✅ **SQL primero** → Ejecuta en Supabase SQL Editor
   - Archivo: `20260122_fix_rpc_return_types.sql`
   
2. ✅ **Frontend luego** → Deploy código actualizado
   - Cambios en `rentalEventsService.ts`
   - Cambios en `RentalProgressWizard.tsx`
   - Cambios en `RentalActions.tsx`

**¿Por qué SQL primero?**
- El frontend actualizado llama a RPCs que esperan JSONB
- Si no actualizas SQL primero, obtendrás UUID de las RPCs viejas
- Las RPCs antiguas tenían `RETURNS UUID`, las nuevas `RETURNS JSONB`

---

## 💡 Nota de Arquitectura

**Nuevo contrato de respuesta:**
```typescript
interface RpcResponse {
    ok: boolean;           // true si operación exitosa
    code: string;          // 'success', 'not_authorized', 'not_found', etc.
    message: string;       // Mensaje legible para el usuario
    data?: any;            // Datos adicionales (event_id, idempotent flag, etc.)
    warnings?: string[];   // Advertencias no-bloqueantes
}
```

Todas las RPCs de acción usan este contrato:
- ✅ Consistencia
- ✅ Extensibilidad (si necesitas agregar warnings)
- ✅ Debugging más fácil (ves qué falló)

---

## ❓ Troubleshooting

### Problema: "Column 'prorettype' does not exist"
**Solución:** Usa esta query alternativa:
```sql
SELECT routine_name, data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'mark_handoff_uploaded',
    'mark_return_uploaded',
    'confirm_handoff',
    'confirm_return',
    'complete_rental'
);
```

### Problema: "RPC doesn't exist" después de ejecutar SQL
**Solución:**
1. Verifica que copiaste TODO el contenido
2. Verifica que no hay errores de sintaxis (míralos en la consola)
3. Recarga la página en Supabase (F5)

### Problema: Frontend sigue mostrando error
**Solución:**
1. Verifica que el SQL se ejecutó sin errores
2. Verifica que recargaste la aplicación (Ctrl+Shift+R)
3. Abre DevTools → Network → ejecuta una acción
4. Verifica que la respuesta RPC es JSONB, no UUID

---

## 📝 Resumen de Cambios

| Archivo | Cambios |
|---------|---------|
| `20260122_fix_rpc_return_types.sql` | NUEVO - Refactor de 5 RPCs |
| `rentalEventsService.ts` | Actualiza tipos y parsing |
| `RentalProgressWizard.tsx` | Manejo de RpcResponse |
| `RentalActions.tsx` | Manejo de RpcResponse |

---

## ✨ Resultado Final

✅ Sin false error toast
✅ Mensajes claros y específicos
✅ Mejor debugging
✅ Arquitectura escalable
✅ Backward compatible con eventos existentes
