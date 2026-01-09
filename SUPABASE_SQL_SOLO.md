# 🗄️ SUPABASE - Solo SQL (Copiar y Pegar)

## ⚠️ IMPORTANTE - LEE PRIMERO

**NO copies las líneas que digan `\`\`\` o `\`\`\`sql`**

Solo copia el código SQL puro:
- Empieza en: `-- Crear tabla`
- Termina en: el último `;`

Las líneas con backticks (` ``` `) son SOLO para el documento Markdown, no para Supabase.

---

## 📋 Pasos Rápidos

1. Abre: https://supabase.com → Tu proyecto
2. Ve a: **SQL Editor**
3. **Copia UN bloque** (sin backticks)
4. **Pégalo** en el editor SQL blanco
5. Haz click en **▶️ Run** (botón verde)
6. **Espera** a que termine (debe verse verde = OK)
7. **Repite** con el siguiente bloque

**Total: 4 bloques SQL**

---

## 📍 BLOQUE 1: Tabla `profiles` (usuarios)

**⚠️ IMPORTANTE: Copia SOLO el código SQL que ves abajo (SIN las líneas de triple backticks)**

Copia desde `-- Crear tabla` hasta `WITH CHECK (auth.uid() = id);` y pégalo en SQL Editor:

```
-- Crear tabla profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  dni_document_url TEXT,
  dni_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Ver tu propio perfil
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Policy: Actualizar tu propio perfil
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Policy: Insertar tu propio perfil
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

Haz click en **▶️ Run** (botón verde en Supabase)

✅ **Espera a que termine** (deberías ver un mensaje verde de éxito)

---

## 📍 BLOQUE 2: Tabla `items` (productos)

**⚠️ IMPORTANTE: Copia SOLO el código SQL (SIN las líneas de triple backticks)**

Copia desde `-- Crear tabla items` hasta el último `;` y pégalo en SQL Editor:

```
-- Crear tabla items
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_contact TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price_day DECIMAL(10, 2) NOT NULL,
  price_week DECIMAL(10, 2),
  price_month DECIMAL(10, 2),
  location TEXT NOT NULL,
  city TEXT NOT NULL,
  image_url TEXT,
  status TEXT DEFAULT 'available',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Policy: Ver productos disponibles
CREATE POLICY "Users can view available items"
  ON items FOR SELECT
  USING (status = 'available');

-- Policy: Crear productos (solo autenticados)
CREATE POLICY "Authenticated users can create items"
  ON items FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Policy: Editar tus propios productos
CREATE POLICY "Users can update their own items"
  ON items FOR UPDATE
  USING (auth.uid() = owner_id);

-- Policy: Eliminar tus propios productos
CREATE POLICY "Users can delete their own items"
  ON items FOR DELETE
  USING (auth.uid() = owner_id);
```

Haz click en **▶️ Run**

✅ **Espera a que termine** (deberías ver un mensaje verde de éxito)

---

## 📍 BLOQUE 3: Tabla `bookings` (alquileres)

**⚠️ IMPORTANTE: Copia SOLO el código SQL (SIN las líneas de triple backticks)**

Copia desde `-- Crear tabla bookings` hasta el último `;` y pégalo en SQL Editor:

```
-- Crear tabla bookings
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  total_price DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Ver tus propios bookings
CREATE POLICY "Users can view their own bookings"
  ON bookings FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = owner_id);

-- Policy: Crear bookings (solo autenticados)
CREATE POLICY "Authenticated users can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Actualizar tus propios bookings
CREATE POLICY "Users can update their own bookings"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = owner_id);
```

Haz click en **▶️ Run**

✅ **Espera a que termine** (deberías ver un mensaje verde de éxito)

---

## 📍 BLOQUE 4: Tablas `requests` (solicitudes)

**⚠️ IMPORTANTE: Copia SOLO el código SQL (SIN las líneas de triple backticks)**

Copia desde `-- Crear tabla requests` hasta el último `;` y pégalo en SQL Editor:

```
-- Crear tabla requests
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

-- Policy: Ver tus propias requests
CREATE POLICY "Users can view their own requests"
  ON requests FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = owner_id);

-- Policy: Crear requests
CREATE POLICY "Authenticated users can create requests"
  ON requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Actualizar requests
CREATE POLICY "Users can update their own requests"
  ON requests FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = owner_id);
```

Haz click en **▶️ Run**

✅ **Espera a que termine** (deberías ver un mensaje verde de éxito)

---

## 🪣 BLOQUE 5: Crear Storage Buckets

### Opción A: GUI (Más fácil)

1. En Supabase Dashboard
2. Ve a: **Storage**
3. Haz click en **Create new bucket**
4. Nombre: `avatars` → Haz público → Create
5. Repite:
   - Nombre: `dni-documents` → Haz privado (NO públic) → Create

### Opción B: SQL (Si prefieres)

Copia y pega esto en SQL Editor:

```sql
-- Crear bucket avatars (público)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- Crear bucket dni-documents (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('dni-documents', 'dni-documents', false);
```

---

## ✅ Verifica que TODO está creado

### En SQL Editor, ejecuta esto:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Deberías ver:
- `bookings` ✅
- `items` ✅
- `profiles` ✅
- `requests` ✅

---

## 🎉 ¡LISTO!

Ahora abre tu app y prueba:

1. Abre http://localhost:5174
2. Regístrate
3. Login
4. Ve a `/profile`
5. Abre F12 → Console
6. Deberías ver logs verdes (✅)

---

## ⚠️ Si algo falla

**Error: "relation already exists"**
→ Significa que ya existe la tabla, está bien, continúa

**Error: "permission denied"**
→ Verifica que tienes permisos de admin en Supabase

**Error: "policy not found"**
→ Copia el bloque completo (incluyendo policies)

---

## 📝 Resumen rápido

| Bloque | Qué hace | Run? |
|--------|----------|------|
| 1 | Crea tabla `profiles` + RLS | ✅ |
| 2 | Crea tabla `items` + RLS | ✅ |
| 3 | Crea tabla `bookings` + RLS | ✅ |
| 4 | Crea tabla `requests` + RLS | ✅ |
| 5 | Crea buckets de storage | ✅ |

**TOTAL: 5 pasos = 5 minutos = APP FUNCIONAL** 🚀

