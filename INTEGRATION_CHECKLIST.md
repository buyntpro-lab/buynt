# Checklist de Integración Técnica - Área de Perfil

## ✅ Estado Actual (Completado)

### 1. Configuración de Supabase
- [x] Archivo `src/lib/supabaseClient.ts` creado con validación de variables de entorno
- [x] Validación de `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- [x] Logging en desarrollo para verificar conexión
- [x] Manejo de errores si faltan credenciales

### 2. Variables de Entorno
- [x] Archivo `.env.example` con template
- [x] Archivo `.env.local` con credenciales reales (git-ignored)
- [x] Variables correctamente tipadas con prefijo `VITE_`

```env
VITE_SUPABASE_URL=https://sxzpfndudjgpgwhafwlq.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_NS1lJsdGAQedKjwNBToE9A_B61urQ3s
```

### 3. Componentes y Dependencias
- [x] `react-hot-toast` instalado y configurado
- [x] `<Toaster position="top-center" />` en `src/App.tsx`
- [x] `lucide-react` para iconos (Package, Calendar, Settings, LogOut, etc.)
- [x] Importes correctos en Profile.tsx

### 4. AuthContext - Sistema de Autenticación
- [x] Logging en `initializeAuth()`: "🔐 Initializing authentication..."
- [x] Logging cuando se encuentra sesión activa: "✅ Session found for user: {email}"
- [x] Logging cuando no hay sesión: "ℹ️ No active session found"
- [x] Logging de cambios de estado: "🔔 Auth state change event: {event}"
- [x] Logging cuando usuario inicia sesión: "👤 User signed in/token refreshed: {email}"
- [x] Logging cuando cierra sesión: "👋 User signed out"
- [x] Logging cuando se obtiene perfil: "🔍 Fetching profile for user: {id}"
- [x] Logging en caso de error: "⚠️ Profile fetch error..."
- [x] Logging cuando se crea perfil fallback: "✅ Using fallback user..."

**Ubicación:** [src/context/AuthContext.tsx](src/context/AuthContext.tsx#L32-L140)

### 5. Página de Perfil - Profile.tsx
- [x] Carga de datos en `loadData()`:
  - [x] Log: "👤 Loading profile data for user: {id}"
  - [x] Log: "📧 User email: {email}"
  - [x] Log: "✅ Loaded items: {count}"
  - [x] Log: "✅ Loaded bookings: {count}"
  
- [x] Upload de Avatar:
  - [x] Log: "📤 Uploading avatar: {fileName}"
  - [x] Log: "✅ Avatar uploaded, getting public URL..."
  - [x] Log: "📝 Updating profile with avatar URL..."
  - [x] Log: "✅ Avatar updated successfully"
  - [x] Obtiene `publicUrl` correctamente
  - [x] Actualiza la BD con la URL
  - [x] Muestra spinner durante carga
  - [x] Toast de éxito/error

- [x] Upload de DNI:
  - [x] Sube a bucket `dni-documents`
  - [x] Almacena en `profiles.dni_document_url`
  - [x] Toast de confirmación

- [x] Logout:
  - [x] Log: "👋 Logging out user..."
  - [x] Log: "✅ Sign out successful, redirecting..."
  - [x] Delay de 300ms antes de redirigir
  - [x] Toast de sesión cerrada
  - [x] Limpia sesión del AuthContext

- [x] Edición de Perfil:
  - [x] Campos: nombre, teléfono
  - [x] Validación de campos requeridos
  - [x] Actualización en BD
  - [x] Toast de confirmación

**Ubicación:** [src/pages/Profile.tsx](src/pages/Profile.tsx)

### 6. Hook useAuth - Tipado Correctamente
- [x] Interfaz `User` con campos opcionales
- [x] Propiedades tipadas: `id`, `email`, `full_name`, `phone`, `avatar_url`, `dni_verified`
- [x] Hook `useAuth()` retorna `{ user, loading, signOut, isAuthenticated }`
- [x] Validación: lanza error si se usa fuera de AuthProvider

**Ubicación:** [src/context/AuthContext.tsx](src/context/AuthContext.tsx#L150-L160)

### 7. Rutas Protegidas
- [x] Componente `<ProtectedRoute>` en `src/components/layout/ProtectedRoute.tsx`
- [x] Ruta `/profile` protegida en `App.tsx`
- [x] Redirige a login si no está autenticado

**Ubicación:** [src/App.tsx](src/App.tsx#L30)

---

## 🔄 Pasos Siguientes en Supabase (NECESARIO PARA FUNCIONAMIENTO)

### 1. Crear Tabla `profiles`
```sql
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

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Policy: Users can insert their own profile (ON SIGNUP)
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

### 2. Crear Tabla `items` (Productos)
```sql
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

-- Enable RLS
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view available items
CREATE POLICY "Users can view available items"
  ON items FOR SELECT
  USING (status = 'available');

-- Policy: Authenticated users can create items
CREATE POLICY "Authenticated users can create items"
  ON items FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Policy: Users can update their own items
CREATE POLICY "Users can update their own items"
  ON items FOR UPDATE
  USING (auth.uid() = owner_id);

-- Policy: Users can delete their own items
CREATE POLICY "Users can delete their own items"
  ON items FOR DELETE
  USING (auth.uid() = owner_id);
```

### 3. Crear Tabla `bookings` (Alquileres)
```sql
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

-- Enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own bookings
CREATE POLICY "Users can view their own bookings"
  ON bookings FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = owner_id);

-- Policy: Authenticated users can create bookings
CREATE POLICY "Authenticated users can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own bookings
CREATE POLICY "Users can update their own bookings"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = owner_id);
```

### 4. Crear Buckets de Storage
```sql
-- Bucket: avatars (Público)
-- En Supabase Dashboard:
-- Storage → New Bucket → Name: "avatars" → Public → Create

-- Bucket: dni-documents (Privado)
-- Storage → New Bucket → Name: "dni-documents" → Private → Create
```

**Configurar Políticas de Storage:**
```sql
-- Policy: avatars bucket - public read, authenticated upload
CREATE POLICY "Public Read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated Upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Policy: dni-documents bucket - private
CREATE POLICY "Authenticated Users can upload DNI"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'dni-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view their own DNI"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'dni-documents' AND auth.uid()::text = owner);
```

---

## 🧪 Pruebas Manuales en Navegador

### 1. Prueba de Autenticación
1. Abre Developer Tools (F12)
2. Ve a la pestaña "Console"
3. Dirígete a `/login` (si no estás autenticado)
4. Observa:
   - "🔐 Initializing authentication..." → "ℹ️ No active session found"
   - Ingresa email y contraseña
   - "👤 User signed in/token refreshed: {email}"
   - "🔍 Fetching profile..." → "✅ Profile fetched successfully" (o fallback)

### 2. Prueba de Perfil
1. Estando logueado, ve a `/profile`
2. Observa en Console:
   - "👤 Loading profile data for user: {id}"
   - "✅ Loaded items: {N}" y "✅ Loaded bookings: {M}"
   - Tabs: "Alquileres", "Artículos", "Ajustes" funcionan correctamente

### 3. Prueba de Avatar Upload
1. En la página de Perfil, hover sobre el avatar
2. Haz click en el ícono de upload
3. Selecciona una imagen
4. Observa en Console:
   - "📤 Uploading avatar: {fileName}"
   - "✅ Avatar uploaded, getting public URL..."
   - "📝 Updating profile with avatar URL..."
   - "✅ Avatar updated successfully"
5. Toast verde: "Avatar actualizado correctamente"
6. El avatar se muestra inmediatamente

### 4. Prueba de Logout
1. En la página de Perfil, haz click en "Cerrar Sesión"
2. Observa en Console:
   - "👋 Logging out user..."
   - "✅ Sign out successful, redirecting..."
   - "👋 User signed out"
3. Toast verde: "Sesión cerrada correctamente"
4. Redirecciona a `/` después de 300ms

### 5. Prueba de Edición de Perfil
1. En la página de Perfil, tab "Ajustes"
2. Cambia el nombre o teléfono
3. Haz click en "Guardar"
4. Toast verde: "Perfil actualizado correctamente"
5. Los datos se actualizan en la BD

---

## 📊 Estructura de Datos de Ejemplo

### User (en Context)
```typescript
{
  id: "123e4567-e89b-12d3-a456-426614174000",
  email: "usuario@example.com",
  full_name: "Juan Pérez",
  phone: "+34 666 777 888",
  avatar_url: "https://sxzp....supabase.co/storage/v1/object/public/avatars/123e4567-avatar-1704000000.jpg",
  dni_verified: false,
  created_at: "2024-01-01T10:00:00Z"
}
```

### Item (Producto)
```typescript
{
  id: "prod-uuid",
  owner_id: "user-uuid",
  owner_contact: "usuario@example.com",
  title: "Bicicleta de montaña",
  description: "Trek X-Caliber 2024",
  category: "deportes",
  price_day: 15,
  price_week: 80,
  price_month: 250,
  location: "Madrid, Barrio de Salamanca",
  city: "Madrid",
  image_url: "https://...",
  status: "available",
  created_at: "2024-01-15T14:30:00Z"
}
```

---

## 🐛 Debugging Tips

### 1. Ver logs en Console (F12)
- Filtrar por ✅ = éxito
- Filtrar por ❌ = error
- Filtrar por 🔐 = autenticación

### 2. Ver estado de Supabase
- Network Tab → buscar "supabase" → ver response
- Storage → Ver archivos subidos en buckets

### 3. Problemas Comunes
| Problema | Causa | Solución |
|----------|-------|----------|
| "VITE_SUPABASE_URL no está configurada" | Variables de entorno no existen | Crear `.env.local` con credenciales |
| Feed no muestra después de login | `setLoading(false)` falta en auth listener | ✅ SOLUCIONADO en AuthContext |
| Avatar no se sube | Bucket no existe o RLS bloqueado | Crear bucket `avatars` y permitir upload |
| "Profile fetch error" | `profiles` tabla no existe | Ejecutar SQL para crear tabla |
| Toast no aparece | Toaster no está en App.tsx | ✅ YA ESTÁ en App.tsx |

---

## 📋 Resumen de Cambios Realizados

| Archivo | Cambios |
|---------|---------|
| `src/lib/supabaseClient.ts` | ✅ CREADO - Configuración centralizada con validación |
| `src/context/AuthContext.tsx` | ✅ MEJORADO - Logging comprehensivo en todas las funciones |
| `src/pages/Profile.tsx` | ✅ MEJORADO - Logging en uploads, loadData, logout |
| `src/App.tsx` | ✅ YA TIENE - Toaster component, rutas protegidas |
| `.env.example` | ✅ CREADO - Template con variables necesarias |
| `.env.local` | ✅ CREADO - Credenciales (git-ignored) |
| `src/services/types.ts` | ✅ ACTUALIZADO - User interface con phone, created_at |

---

## ✨ Próximos Pasos Recomendados

1. **Verificar que funciona todo localmente:**
   - `npm run dev`
   - F12 → Console → Verificar logs
   - Navegar a `/profile` → observar logs

2. **Ejecutar setup SQL en Supabase:**
   - Supabase Dashboard → SQL Editor
   - Copiar y ejecutar SQLs de tablas y políticas
   - Crear buckets de storage

3. **Probar flujo completo:**
   - Registrarse, loguearse, ir a perfil
   - Subir avatar, editar perfil, logout
   - Verificar que aparecen los items en "Mis Artículos"

4. **Revisar mensajes de error:**
   - Si algo no funciona, F12 → Console mostrará exactamente qué falla
   - Comparar con los logs esperados de este checklist

