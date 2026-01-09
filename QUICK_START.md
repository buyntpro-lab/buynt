# 🚀 Guía Rápida de Inicio - Buynt

## 1️⃣ Variables de Entorno (NECESARIO)

Copia `.env.example` a `.env.local`:

```bash
cp .env.example .env.local
```

Verifica que tiene las variables correctas:
```env
VITE_SUPABASE_URL=https://sxzpfndudjgpgwhafwlq.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_NS1lJsdGAQedKjwNBToE9A_B61urQ3s
```

⚠️ **IMPORTANTE:** `.env.local` está en `.gitignore` (no se sube a Git)

---

## 2️⃣ Instalar Dependencias

```bash
npm install
```

Verifica que se instaló `react-hot-toast`:
```bash
npm list react-hot-toast
```

---

## 3️⃣ Iniciar Servidor de Desarrollo

```bash
npm run dev
```

**Esperado en Console (F12):**
```
✅ Supabase Cliente configurado correctamente
🌐 URL: https://sxzpfndudjgpgwhafwlq.supabase.co
🔐 Initializing authentication...
ℹ️ No active session found
```

---

## 4️⃣ Crear Tablas en Supabase (UNA SOLA VEZ)

1. Ve a [supabase.com](https://supabase.com) → Dashboard del proyecto
2. SQL Editor → New Query
3. Copia todo el contenido de [INTEGRATION_CHECKLIST.md](INTEGRATION_CHECKLIST.md#pasos-siguientes-en-supabase-necesario-para-funcionamiento)
4. Ejecuta cada script SQL por separado

**Tablas a crear:**
- ✅ `profiles` (usuarios)
- ✅ `items` (productos)
- ✅ `bookings` (alquileres)

---

## 5️⃣ Crear Storage Buckets

En Supabase Dashboard → Storage:

1. **Nuevo Bucket: `avatars`**
   - [x] Público (Public)
   - [x] Crear

2. **Nuevo Bucket: `dni-documents`**
   - [x] Privado (Private)
   - [x] Crear

---

## 6️⃣ Prueba el Flujo Completo

### Registrarse
- http://localhost:5173/register
- Email: `test@example.com`
- Contraseña: cualquiera

### Iniciar Sesión
- http://localhost:5173/login
- Usa las mismas credenciales

### Ir a Perfil
- http://localhost:5173/profile
- Deberías ver 3 tabs: Alquileres, Artículos, Ajustes

### Abrir Console (F12)
Verás logs como:
```
👤 Loading profile data for user: 123e4567-e89b-12d3-a456-426614174000
📧 User email: test@example.com
✅ Loaded items: 0
✅ Loaded bookings: 0
```

---

## 🆘 Solucionar Problemas

### ❌ "VITE_SUPABASE_URL no está configurada"
**Solución:** Crea `.env.local` con las variables (ver paso 1️⃣)

### ❌ "No puedo registrarme"
**Solución:** Habilita "Email/Password" en Supabase:
- Settings → Authentication → Providers → Email

### ❌ Avatar no se sube
**Solución:** Verifica que el bucket `avatars` existe y es público:
- Storage → avatars → Policies → Public Read

### ❌ Perfil no carga datos
**Solución:** Crea la tabla `profiles` (ver paso 4️⃣)

---

## 📚 Documentación Completa

- [INTEGRATION_CHECKLIST.md](INTEGRATION_CHECKLIST.md) - Checklist técnico detallado
- [PROFILE_PAGE_DOCUMENTATION.md](PROFILE_PAGE_DOCUMENTATION.md) - Guía de la página de Perfil
- [SUPABASE_ITEMS_SETUP.md](SUPABASE_ITEMS_SETUP.md) - Setup de items/productos
- [DEBUG_FEED_ISSUE.md](DEBUG_FEED_ISSUE.md) - Cómo debuggear problemas

---

## 🎯 Comandos Útiles

```bash
# Desarrollo
npm run dev

# Build para producción
npm run build

# Preview del build
npm run preview

# Linting
npm run lint
```

---

## ✨ Stack Tecnológico

- **React** 19 + TypeScript 5
- **Vite** 7 (build tool)
- **Tailwind CSS** 4
- **Supabase** (Backend)
- **React Router** 7
- **react-hot-toast** (notificaciones)
- **lucide-react** (iconos)

---

## 🔒 Seguridad

⚠️ **Credenciales públicas (MVP):**
- Las credenciales de Supabase en código son OK para MVP
- En producción, usar variables de entorno en el servidor

✅ **Protecciones implementadas:**
- Row Level Security (RLS) en todas las tablas
- Rutas protegidas (`/profile`, `/publish`, etc.)
- Storage buckets con políticas de acceso

---

