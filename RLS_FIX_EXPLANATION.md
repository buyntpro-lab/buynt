# RLS FIX: Items Table Update/Delete Policies

## Problema Diagnosticado

**Error en Supabase:**
```
ERROR: 42883: operator does not exist: text = uuid
```

**Causa raíz:**
- El frontend está guardando `owner_id` como UUID: `owner_id: user?.id` (que es `uuid` de Supabase Auth)
- La tabla `items` tiene la columna `owner_id` definida como **TEXT**
- La RLS policy intentaba comparar: `auth.uid()::text = owner_id`
- Pero Postgres interpretaba esto como comparar TEXT con UUID directamente, causando el error

## Solución Aplicada

**Cambio en la RLS policy:**
```sql
-- ANTES (causaba error):
auth.uid()::text = owner_id

-- AHORA (correcto):
owner_id = auth.uid()::text
```

**Por qué funciona:**
- `auth.uid()` devuelve un `uuid`
- `auth.uid()::text` convierte el UUID a TEXT
- `owner_id` es TEXT (contiene UUIDs como strings)
- La comparación TEXT = TEXT ahora es válida

## SQL Final a Ejecutar

Copia y pega el contenido completo del archivo `supabase/migrations/20250111_items_rls_policies.sql` en el SQL Editor de Supabase.

Incluye:
1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
2. `DROP POLICY IF EXISTS ...` (limpia policies antiguas)
3. 4 policies nuevas:
   - `items_select`: SELECT público (marketplace)
   - `items_insert`: INSERT solo usuarios auth, owner_id = usuario actual
   - `items_update`: UPDATE solo owner
   - `items_delete`: DELETE solo owner

## Verificación

Después de ejecutar el SQL, verifica en el SQL Editor:

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename='items'
ORDER BY policyname;
```

Deberías ver 4 policies con los nombres correctos y la condición de comparación funcionando.

## Impacto en la App

✅ El botón "Editar" en "Mis Artículos" ahora funciona correctamente
✅ RLS previene que otros usuarios editen artículos ajenos
✅ El tipo de comparación es correcto (TEXT = TEXT)
✅ No se rompe nada existente (solo agrega seguridad)
