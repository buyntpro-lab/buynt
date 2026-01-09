# 🔧 Diagnóstico: Productos No Se Publican

## Problema
Cuando intentas publicar un anuncio, rellenan todos los datos pero al hacer clic en "Publicar Anuncio", nada sucede.

## ✅ Cambios Implementados

He mejorado significativamente el flujo de publicación:

### 1. **Mejor Manejo de Errores en Publish.tsx**
- Agregado estado `loading` para mostrar que está procesando
- Toast notifications para feedback del usuario
- Logs detallados en consola para debugging
- Try-catch para capturar errores
- Redirección a `/my-items` después de publicar

### 2. **Mejorado itemsService.add() en supabaseDb.ts**
- Logs detallados de lo que se envía a Supabase
- Error handling más robusto
- Lanzamiento de excepciones en lugar de devolver null silenciosamente

### 3. **Botón con Estado de Carga**
- Spinner mientras se publica
- Botón deshabilitado durante el proceso
- Previene clicks duplicados

---

## 🔍 Cómo Diagnosticar el Problema

### Paso 1: Abre la Consola del Navegador
1. Presiona **F12**
2. Ve a la pestaña **Console**
3. Busca mensajes que empiecen con:
   - `📝 Intentando publicar producto:`
   - `📤 Enviando item a Supabase:`
   - `✅ Producto publicado exitosamente:` o `❌ Error adding item:`

### Paso 2: Analiza el Error Exacto

Dependiendo de lo que veas, aquí están las causas más comunes:

#### **Error Típico #1: "Tabla no existe"**
```
Error code: 42P01
Error: relation "items" does not exist
```
**Solución**: Crear la tabla `items` en Supabase
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
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON items
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON items
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

#### **Error Típico #2: "Permiso denegado (RLS)"**
```
Error code: 42501
Error: new row violates row-level security policy
```
**Solución**: Revisar políticas RLS en la tabla `items`
- Debe haber una política que permita INSERT para usuarios autenticados
- O una política que permita INSERT para todos

#### **Error Típico #3: "Campos requeridos faltantes"**
```
Error: column "owner_id" does not exist
o
Error: NOT NULL violation
```
**Solución**: Verificar que el schema de la tabla coincida con los campos que se envían
- Campos que se envían: `title`, `description`, `price_day`, `city`, `image_url`, `category`, `owner_id`, `owner_name`, `owner_contact`
- Todos estos deben existir en la tabla

#### **Error Típico #4: "Tipo de dato incorrecto"**
```
Error: invalid input syntax for type numeric
```
**Solución**: Asegurarse que `price_day` es un número
- En el formulario: `Number(formData.price_day)`
- En Supabase: columna `price_day` debe ser DECIMAL o NUMERIC

---

## 🧪 Pasos para Probar

### 1. **Abre DevTools (F12) → Console**

### 2. **Rellena el formulario con datos de prueba:**
- Título: "Laptop MacBook"
- Descripción: "En perfecto estado"
- Precio/día: 25
- Ciudad: "Madrid"
- Categoría: "Otros"
- (Imagen URL es opcional)

### 3. **Haz clic en "Publicar Anuncio"**

### 4. **Observa los logs en Console:**
   - Deberías ver: `📝 Intentando publicar producto:`
   - Luego: `📤 Enviando item a Supabase:`
   - Luego: `✅ Producto publicado exitosamente:` o un error

### 5. **Si hay error, copia exactamente qué dice y compara con la tabla arriba**

---

## 🔐 Requisitos en Supabase

### Tabla `items` - Estructura Requerida

| Columna | Tipo | Requerido | Default |
|---------|------|-----------|---------|
| id | UUID | Sí | gen_random_uuid() |
| title | TEXT | Sí | - |
| description | TEXT | No | NULL |
| price_day | DECIMAL(10,2) | Sí | - |
| city | TEXT | Sí | - |
| image_url | TEXT | No | NULL |
| category | TEXT | No | NULL |
| owner_id | UUID | No | NULL |
| owner_name | TEXT | Sí | - |
| owner_contact | TEXT | Sí | - |
| created_at | TIMESTAMP | Sí | NOW() |

### Políticas RLS (Row Level Security)

Debe haber al menos UNA de estas políticas habilitadas:

**Opción A: Lectura pública, escribir si autenticado**
```sql
-- Lectura pública
CREATE POLICY "Allow public read" ON items
  FOR SELECT USING (true);

-- Insertar si autenticado
CREATE POLICY "Allow authenticated insert" ON items
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

**Opción B: Todo público (solo para MVP)**
```sql
CREATE POLICY "Allow all" ON items
  FOR ALL USING (true);
```

---

## 📱 Flujo Después de Publicar

Una vez que el producto se publica correctamente:

1. ✅ Se inserta en tabla `items` en Supabase
2. ✅ Se muestra toast de éxito
3. ✅ Se redirige a `/my-items` (tu perfil)
4. ✅ El producto aparece en la tab "Mis Artículos" del perfil
5. ✅ El producto también aparece en Home (feed principal)

Si no ves el producto en estos lugares después de publicar:
- Recarga la página (F5)
- Limpia el caché del navegador (Ctrl+Shift+Delete)
- Verifica en Supabase dashboard que el registro esté en la tabla

---

## 🛠️ Debug Avanzado

### Ver exactamente qué se envía a Supabase

En la consola del navegador ejecuta:
```javascript
// Simular lo que se envía
const item = {
    title: "Test Item",
    description: "Test",
    price_day: 25,
    city: "Madrid",
    image_url: "https://...",
    category: "Otros",
    owner_id: "user-uuid-here",
    owner_name: "John Doe",
    owner_contact: "john@example.com"
};
console.log("Item a enviar:", item);
```

### Ver si Supabase está respondiendo

```javascript
// En Publish.tsx, mira los logs
// Debería decir: "✅ Item agregado exitosamente: {datos}"
```

---

## ✨ Nuevo Flujo Mejorado

El código ahora es mucho más robusto:

```tsx
const handleSubmit = async (e) => {
    setLoading(true);
    try {
        // 1. Validar
        if (!title || !price_day || !city) {
            toast.error('Campos requeridos');
            return;
        }

        // 2. Log de qué se envía
        console.log('📝 Intentando publicar...', {title, price_day, city});

        // 3. Enviar a Supabase
        const newItem = await itemsService.add({...});

        // 4. Verificar que se insertó
        if (!newItem) {
            toast.error('Error al publicar');
            return;
        }

        // 5. Éxito
        toast.success('¡Anuncio publicado!');
        
        // 6. Redirigir
        setTimeout(() => navigate('/my-items'), 500);

    } catch (error) {
        // 7. Si hay error, mostrarlo
        toast.error(error.message);
    } finally {
        setLoading(false);
    }
};
```

---

## 📞 Checklist Final

- [ ] Abrí DevTools (F12) y veo la consola
- [ ] Rellené todos los campos requeridos
- [ ] Hice clic en "Publicar Anuncio"
- [ ] Vi logs en la consola (empezando con 📝 o 📤)
- [ ] Busqué el error exacto en la tabla arriba
- [ ] Creé la tabla `items` en Supabase
- [ ] Habilitué RLS y creé políticas
- [ ] Recarguué la página después de publicar
- [ ] ¿Aparece el producto en /my-items? ✅
- [ ] ¿Aparece en Home feed? ✅

---

**Si después de todo sigue sin funcionar**, comparte:
1. El error exacto de la consola (todo lo que dice después de "Error")
2. Una captura de la tabla `items` en Supabase
3. Las políticas RLS configuradas

---

Generado: 2026-01-09
Versión: 2.0
