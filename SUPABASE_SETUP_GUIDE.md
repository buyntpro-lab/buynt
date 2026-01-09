# 🚨 Diagnóstico: Error de Conexión a Supabase

## Problema Actual
Cuando te logas, aparece: **"Error de conexión - Hubo un problema al conectar con la base de datos"**

Esto significa que `itemsService.getAll()` está fallando al consultar la tabla `items` en Supabase.

---

## 🔧 Paso 1: Ver el Error Exacto en la Consola

1. Abre la página web en tu navegador
2. Presiona **F12** para abrir DevTools
3. Ve a la pestaña **Console**
4. Busca mensajes que comienzen con:
   ```
   Error fetching items (Supabase):
   Error details:
   Error code:
   Error message:
   ```

**Anota el `Error code` exacto** - esto es crucial para diagnosticar.

### Errores Comunes:

| Error Code | Significado | Solución |
|------------|-------------|----------|
| `PGRST116` | Fila no encontrada | Tabla existe pero no hay datos |
| `42P01` | Tabla no existe | Crear la tabla en Supabase |
| `42501` | Permiso denegado (RLS) | Revisar permisos RLS |
| `CORS_ERROR` | Error de origen | Problema de dominio permitido |
| `Unauthorized` | No autenticado | Problema de token de sesión |

---

## 🔧 Paso 2: Verificar en Dashboard de Supabase

Ve a **https://app.supabase.com** y entra en tu proyecto:

### 2.1 Verificar que la tabla `items` existe

1. En el menú izquierdo → **SQL Editor** o **Table Editor**
2. Deberías ver una tabla llamada `items`
3. Si NO existe, ve a **Step 3** más abajo

### 2.2 Verificar que hay datos en la tabla

1. Haz clic en la tabla `items`
2. Deberías ver al menos 1 fila de datos
3. Si está vacía, **inserta datos de prueba** (ver Step 4)

### 2.3 Verificar los permisos RLS

1. Tabla `items` → Click derecho → **Edit Policies** (o el ícono de RLS)
2. Deberías ver políticas que permitan `SELECT` para:
   - Usuarios anónimos, O
   - Usuarios autenticados
3. Si no hay políticas, debes crear una

---

## 🔧 Paso 3: Crear la Tabla `items` (si no existe)

En **Supabase Dashboard** → **SQL Editor**, ejecuta este SQL:

```sql
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  price_day DECIMAL(10, 2) NOT NULL,
  city TEXT NOT NULL,
  image_url TEXT,
  category TEXT,
  owner_id UUID,
  owner_name TEXT,
  owner_contact TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Crear índice para búsquedas rápidas
CREATE INDEX idx_items_created_at ON items(created_at DESC);
CREATE INDEX idx_items_owner_contact ON items(owner_contact);
```

---

## 🔧 Paso 4: Habilitar RLS y crear políticas de lectura

En **Supabase Dashboard** → **SQL Editor**, ejecuta:

```sql
-- Habilitar RLS
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Permitir que TODOS (anónimos y autenticados) lean los items
CREATE POLICY "Allow public read access" ON items
  FOR SELECT
  USING (true);

-- Permitir que los dueños inserten sus propios items
CREATE POLICY "Allow owners to insert" ON items
  FOR INSERT
  WITH CHECK (owner_contact = auth.jwt() ->> 'email');

-- Permitir que los dueños actualicen sus propios items
CREATE POLICY "Allow owners to update" ON items
  FOR UPDATE
  USING (owner_contact = auth.jwt() ->> 'email');

-- Permitir que los dueños eliminen sus propios items
CREATE POLICY "Allow owners to delete" ON items
  FOR DELETE
  USING (owner_contact = auth.jwt() ->> 'email');
```

---

## 🔧 Paso 5: Insertar Datos de Prueba

En **Supabase Dashboard** → **SQL Editor**, ejecuta:

```sql
INSERT INTO items (title, description, price_day, city, image_url, category, owner_name, owner_contact)
VALUES
  ('PlayStation 5', 'Consola última generación en excelente estado', 15.00, 'Madrid', 
   'https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=500&h=400&fit=crop', 
   'Electrónica', 'Juan', 'juan@example.com'),
   
  ('Bicicleta de montaña', 'Trek X-Caliber, 29", perfecta para off-road', 8.00, 'Barcelona', 
   'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=400&fit=crop', 
   'Deportes', 'Maria', 'maria@example.com'),
   
  ('Cámara Canon 5D', 'Cámara profesional DSLR con 2 lentes incluidos', 25.00, 'Valencia', 
   'https://images.unsplash.com/photo-1606986628025-35d57e735ae0?w=500&h=400&fit=crop', 
   'Fotografía', 'Carlos', 'carlos@example.com');
```

---

## 🧪 Paso 6: Verificar que funciona

1. Cierra el navegador completamente (o abre una ventana privada)
2. Ve a http://localhost:5174
3. Intenta hacer **login** con un usuario válido
4. Si ves los 3 items de prueba → **¡Funciona!** ✅

Si aún ves error:
1. Abre DevTools (F12)
2. Ve a **Network** tab
3. Haz logout y login de nuevo
4. Busca una request a `items` 
5. Haz click en ella → revisa la **Response**
6. El error estará ahí

---

## ⚠️ Solución Temporal Implementada

Mientras diagnosticas, he agregado datos de prueba en el código:

```typescript
// Si Supabase falla, muestra estos items:
- PlayStation 5 (Madrid, 15€/día)
- Bicicleta de montaña (Barcelona, 8€/día)
- Cámara Canon 5D (Valencia, 25€/día)
```

Esto se mostará cuando Supabase devuelva un error, para que puedas verificar que el resto funciona.

**IMPORTANTE**: Quita este fallback cuando Supabase esté configurado correctamente en `src/services/supabaseDb.ts` líneas ~48.

---

## 📞 Checklist Final

- [ ] Abrí DevTools y anoté el `Error code` exacto
- [ ] Verifiqué que tabla `items` existe en Supabase
- [ ] Verifiqué que la tabla tiene al menos 1 item
- [ ] Habilitué RLS y creé políticas de lectura
- [ ] Reinicié el servidor (npm run dev)
- [ ] Probé login de nuevo
- [ ] ¿Aparecen los items ahora? ✅

Si seguiste todos los pasos y aún tienes problemas, comparte:
1. El `Error code` exacto de la consola
2. Una captura de pantalla de la tabla `items` en Supabase
3. El contenido de las políticas RLS

---

**Generado**: 2026-01-09
