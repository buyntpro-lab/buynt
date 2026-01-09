# ✅ Checklist de Configuración de Supabase para Publicación de Productos

## 🎯 Objetivo
Asegurar que la tabla `items` esté correctamente configurada en Supabase para que los productos se publiquen correctamente.

---

## 📋 Paso 1: Verificar que Tabla `items` Existe

### En Supabase Dashboard:
1. Ve a **Database** → **Tables**
2. Busca tabla llamada `items`
3. Si NO existe, ejecuta este SQL:

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
  owner_name TEXT NOT NULL,
  owner_contact TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Crear índices para búsquedas rápidas
CREATE INDEX idx_items_created_at ON items(created_at DESC);
CREATE INDEX idx_items_owner_contact ON items(owner_contact);
CREATE INDEX idx_items_city ON items(city);
CREATE INDEX idx_items_category ON items(category);
```

---

## 🔐 Paso 2: Habilitar Row Level Security (RLS)

### En Supabase:
1. Ve a tabla `items`
2. Click en **RLS** (arriba a la derecha)
3. Click en **Enable RLS**
4. Deberías ver: "RLS is ON"

---

## 📝 Paso 3: Crear Políticas RLS

### Política 1: Lectura Pública
```sql
CREATE POLICY "Allow public read items"
ON items
FOR SELECT
USING (true);
```

**Qué hace**: Cualquiera puede ver los items (incluidos usuarios no autenticados)

### Política 2: Crear Items (Solo Autenticados)
```sql
CREATE POLICY "Allow authenticated users to insert items"
ON items
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');
```

**Qué hace**: Solo usuarios logueados pueden crear productos

### Política 3: Actualizar Items (Solo Propietario)
```sql
CREATE POLICY "Allow users to update their own items"
ON items
FOR UPDATE
USING (owner_contact = auth.jwt() ->> 'email')
WITH CHECK (owner_contact = auth.jwt() ->> 'email');
```

**Qué hace**: Los usuarios solo pueden editar sus propios productos

### Política 4: Eliminar Items (Solo Propietario)
```sql
CREATE POLICY "Allow users to delete their own items"
ON items
FOR DELETE
USING (owner_contact = auth.jwt() ->> 'email');
```

**Qué hace**: Los usuarios solo pueden eliminar sus propios productos

---

## 🧪 Paso 4: Verificar Políticas Están Activas

En Supabase:
1. Ve a tabla `items`
2. Click en **RLS Policies** tab
3. Deberías ver 4 políticas listadas:
   - ✅ "Allow public read items"
   - ✅ "Allow authenticated users to insert items"
   - ✅ "Allow users to update their own items"
   - ✅ "Allow users to delete their own items"

---

## 🧪 Paso 5: Probar Publicar un Producto

### En la aplicación:
1. Ir a `http://localhost:5173/publish`
2. Asegurarse de estar logueado (si no, ir a /login primero)
3. Rellenar formulario:
   - **Título**: "Laptop Test"
   - **Descripción**: "Para probar"
   - **Precio/día**: 20
   - **Ciudad**: "Madrid"
   - **Categoría**: "Otros"
4. Click en "Publicar Anuncio"
5. Abre **F12 → Console** y busca logs

### Logs esperados:
```
📝 Intentando publicar producto: {
  title: "Laptop Test",
  price_day: "20",
  city: "Madrid",
  ...
}

📤 Enviando item a Supabase: {...}

✅ Item agregado exitosamente: {
  id: "...",
  title: "Laptop Test",
  ...
}
```

---

## 📊 Paso 6: Verificar en Supabase Dashboard

Después de publicar:

1. Ve a **Database → Tables → items**
2. Deberías ver 1 nueva fila
3. Los datos deberían coincidir con lo que publicaste

**Columnas esperadas**:
- `id`: UUID autogenerado
- `title`: "Laptop Test"
- `price_day`: 20
- `city`: "Madrid"
- `owner_contact`: tu email
- `created_at`: timestamp actual

---

## 🏠 Paso 7: Verificar en Home Feed

1. Ve a `http://localhost:5173/`
2. Deberías ver el nuevo producto en el feed
3. Si no aparece:
   - Recarga (F5)
   - Limpia caché (Ctrl+Shift+Delete)

---

## 👤 Paso 8: Verificar en Mi Perfil

1. Ve a `http://localhost:5173/profile`
2. Click en tab "Mis Artículos"
3. Deberías ver el producto que acabas de publicar
4. Debería haber botones "Editar" y "Eliminar"

---

## 🐛 Solucionar Problemas Comunes

### Problema: "No puedo publicar, dice error"

**Solución**:
1. Abre F12 → Console
2. Busca el error exacto
3. Compara con esta tabla:

| Error | Causa | Solución |
|-------|-------|----------|
| "relation 'items' does not exist" | Tabla no creada | Ejecutar SQL de Paso 1 |
| "42501" o "violates row-level security" | RLS rechaza el INSERT | Crear Política 2 (INSERT) |
| "NOT NULL violation on column X" | Falta un campo requerido | Asegurar que se envían todos los campos |
| "invalid input syntax for type numeric" | price_day no es número | El formulario debe enviar `Number(price_day)` |
| "Unauthorized" | Token expirado | Re-iniciar sesión |

### Problema: "Aparece en Supabase pero no en la App"

**Solución**:
1. Recarga la página (F5)
2. Limpia caché (Ctrl+Shift+Delete)
3. Verifica que la política de lectura (Política 1) esté activa

### Problema: "Publicó pero no aparece en /my-items"

**Solución**:
1. Ve a `/profile`
2. Tab "Mis Artículos"
3. Si no aparece, revisa en Supabase que `owner_contact` sea igual a tu email

---

## 💡 Tips Importantes

1. **El campo `owner_contact` es crucial**:
   - Debe ser igual al email del usuario logueado
   - Se usa para filtrar "Mis Artículos"

2. **El campo `owner_id` es opcional**:
   - Puede ser NULL
   - Se usa para relaciones con tabla `users` (si existe)

3. **Las políticas RLS son obligatorias**:
   - Sin la Política 2 (INSERT), no se puede publicar
   - Sin la Política 1 (SELECT), no se ve en Home

4. **Los índices mejoran la velocidad**:
   - No son obligatorios pero recomendados
   - Ayudan cuando hay muchos productos

---

## ✅ Verificación Final

Marca cuando hayas completado:

- [ ] Tabla `items` existe
- [ ] RLS está ON
- [ ] 4 Políticas están creadas y activas
- [ ] Puedo publicar sin errores
- [ ] El producto aparece en Supabase dashboard
- [ ] El producto aparece en Home feed
- [ ] El producto aparece en /profile "Mis Artículos"
- [ ] Puedo eliminar el producto
- [ ] Puedo ver en /item/{id} los detalles

Si todos están ✅, ¡tu configuración de Supabase es correcta y la publicación funcionará!

---

## 📞 Si Algo Falla

Comparte:
1. El error **exacto** de la consola (todo lo que dice)
2. Una captura de la tabla `items` en Supabase
3. Una lista de las políticas RLS que ves en Supabase

---

Generado: 2026-01-09
