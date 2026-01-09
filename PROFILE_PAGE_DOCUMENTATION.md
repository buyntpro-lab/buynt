# 👤 Página de Perfil de Usuario - Documentación Técnica

## 📋 Descripción General

He creado una página de Perfil de Usuario completamente funcional e integrada con Supabase. Cumple con todos los requisitos especificados y sigue las mejores prácticas de React, TypeScript y Tailwind CSS.

**Ruta**: `/profile` (Protegida - requiere autenticación)

---

## ✨ Características Implementadas

### 1. **Header de Perfil** 
- Avatar del usuario con foto de perfil (avatar dinámico de fallback)
- Opción de **cambiar avatar** (hover en la foto)
- Nombre completo y email
- Etiqueta **"✓ Usuario Verificado"** (si `dni_verified` es true)
- Botón **"Cerrar Sesión"** con función de logout
- Estadísticas principales:
  - Número de productos activos
  - Número de alquileres
  - Mes de unión al platform
  - Estado de verificación de DNI

### 2. **Navegación por Tabs**
Tres pestañas dinámicas que cambian el contenido:

#### **Tab 1: Mis Alquileres** (Arrendatario)
- Lista de todos los productos que ha alquilado
- Muestra por cada alquiler:
  - Imagen del producto
  - Nombre del producto  
  - Fechas de alquiler (inicio y fin)
  - Precio total
  - Estado del alquiler (Confirmado/Pendiente/Rechazado)
  - Botón "Contactar" para abrir chat
- Mensaje vacío con enlace si no tiene alquileres

#### **Tab 2: Mis Artículos** (Propietario)
- Grid de productos que el usuario ha subido
- Para cada producto:
  - Imagen principal
  - Precio por día
  - Título y descripción
  - Ciudad y categoría
  - Botón **"Editar"** (link a `/item/{id}/edit`)
  - Botón **"Eliminar"** con confirmación
- Botón flotante **"Subir Nuevo"** para ir a `/publish`
- Mensaje vacío si no hay productos

#### **Tab 3: Ajustes**
- **Modo lectura**: Muestra datos actuales
  - Nombre completo
  - Email (no editable)
  - Teléfono
  - Botón "Editar Información"

- **Modo edición**: Permite cambiar
  - Nombre completo
  - Teléfono
  - Botones Guardar/Cancelar

- **Sección de Verificación de Identidad**:
  - Si verificado: Muestra badge verde con ✓
  - Si no verificado: Opción para subir foto del DNI
  - Mensaje explicativo sobre seguridad
  - Upload de archivo (PNG, JPG, PDF)

### 3. **Gestión de Archivos**
- **Avatar Upload**: Sube a Storage de Supabase (`/avatars`)
- **DNI Upload**: Sube a Storage (`/dni-documents`) 
- Estados de carga (disabled durante upload)
- Toast notifications de éxito/error

### 4. **Seguridad y UX**
- **Protección de Ruta**: Redirige a login si no está autenticado
- **Estados de Carga**: Spinner mientras se cargan datos
- **Confirmaciones**: Pide confirmación para eliminar productos
- **Feedback**: Toast notifications para acciones (guardar, eliminar, upload)
- **Responsive Design**: Funciona en mobile, tablet y desktop

---

## 🔧 Estructura Técnica

### Componente Principal: `Profile.tsx`

```tsx
export const Profile: React.FC = () => {
  // Estados
  const [activeTab, setActiveTab] = useState<TabType>('rentals');
  const [profileData, setProfileData] = useState<ProfileData>({...});
  const [items, setItems] = useState<Item[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  
  // Funciones principales
  const handleUpdateProfile = async () => {...};
  const handleDeleteItem = async (itemId) => {...};
  const handleAvatarUpload = async (e) => {...};
  const handleDNIUpload = async (e) => {...};
  const handleSignOut = async () => {...};
}
```

### Interfaces Utilizadas

```typescript
type TabType = 'rentals' | 'articles' | 'settings';

interface ProfileData {
    full_name: string;
    phone?: string;
    dni_verified: boolean;
    avatar_url?: string;
}
```

### Servicios Utilizados

```typescript
// Del servicio itemsService
- getByUserId(userId)  // Obtiene artículos del usuario
- delete(itemId)       // Elimina un producto

// Del servicio bookingsService  
- getByUserId(userId)  // Obtiene alquileres del usuario

// De AuthContext
- user                 // Usuario actual
- signOut()            // Cierra sesión
- isAuthenticated      // Verifica autenticación

// De Supabase Auth & Storage
- supabase.auth.signOut()
- supabase.storage.from('avatars').upload()
- supabase.storage.from('dni-documents').upload()
- supabase.from('profiles').update()
```

---

## 🎨 Diseño y Estilos

### Colores Principales
- **Primary**: `#5C40F2` (Indigo) - acciones principales
- **Secondary**: `#EC4899` (Pink) - acentos
- **Backgrounds**: `slate-50` a `slate-900` gradientes
- **Success**: `green-600` (verificación)
- **Pending**: `amber-600` (en espera)
- **Error**: `red-600` (rechazado)

### Bordes y Espaciado
- Bordes redondeados: `rounded-[20px]`, `rounded-[12px]`
- Sombras sutiles: `shadow-lg`, `hover:shadow-lg`
- Espaciado: Sistema basado en Tailwind (p-6, gap-4, etc.)

### Responsive
- Mobile-first design
- Grid dinámicas: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Flex layouts adaptables

---

## 📊 Flujo de Datos

```
Page Load
  ↓
useEffect hook
  ↓
¿Autenticado?
  ├─ No → Redirige a /login
  └─ Sí → Carga datos en paralelo
       ├─ itemsService.getByUserId(user.id)
       ├─ bookingsService.getByUserId(user.id)
       └─ Renderiza tabs con datos
```

---

## 🔐 Requisitos de Supabase

### Tablas Necesarias

1. **profiles** (ya debe existir)
   ```
   - id (UUID, PK)
   - email (text)
   - full_name (text)
   - phone (text, nullable)
   - avatar_url (text, nullable)
   - dni_verified (boolean, default false)
   - created_at (timestamp)
   ```

2. **items** (ya debe existir)
   ```
   - id (UUID, PK)
   - owner_id (UUID, FK a auth.users)
   - title (text)
   - description (text)
   - price_day (decimal)
   - city (text)
   - image_url (text)
   - category (text)
   - created_at (timestamp)
   ```

3. **bookings** o **requests** (para alquileres)
   ```
   - id (UUID, PK)
   - user_id / requester_id (text/UUID)
   - item_id (UUID)
   - start_date (date)
   - end_date (date)
   - total_price (decimal)
   - status ('pending'|'accepted'|'rejected')
   - created_at (timestamp)
   ```

### Storage Buckets

1. **avatars**
   - Público (readablePublic: true)
   - Política RLS: Permitir lectura pública

2. **dni-documents**
   - Privado
   - Política RLS: Solo propietario puede escribir/leer

---

## 🚀 Cómo Usar

### Para Usuarios

1. **Acceder a Perfil**:
   - Click en avatar en Header → Ir a /profile
   - O navegar directamente a `http://localhost:5173/profile`

2. **Ver Alquileres**:
   - Tab "Mis Alquileres"
   - Lista de todo lo que ha alquilado
   - Click en "Contactar" para mensaje

3. **Gestionar Productos**:
   - Tab "Mis Artículos"
   - Ver, editar o eliminar productos
   - Botón "Subir Nuevo" para publicar

4. **Actualizar Perfil**:
   - Tab "Ajustes"
   - Cambiar nombre y teléfono
   - Subir DNI para verificación

5. **Cerrar Sesión**:
   - Botón en el header
   - Redirige a Home desautenticado

### Para Desarrolladores

#### Agregar un nuevo campo a ProfileData

```typescript
// 1. Actualizar interfaz
interface ProfileData {
    full_name: string;
    phone?: string;
    dni_verified: boolean;
    avatar_url?: string;
    tu_nuevo_campo?: string;  // ← Agregar
}

// 2. Actualizar estado inicial
const [profileData, setProfileData] = useState<ProfileData>({
    full_name: '',
    phone: '',
    dni_verified: false,
    tu_nuevo_campo: ''  // ← Agregar
});

// 3. Agregar input en modo edición
<input
    value={profileData.tu_nuevo_campo || ''}
    onChange={(e) => setProfileData(prev => ({ 
        ...prev, 
        tu_nuevo_campo: e.target.value 
    }))}
    // ... resto del input
/>

// 4. Incluir en actualización
await supabase.from('profiles').update({
    // ...
    tu_nuevo_campo: profileData.tu_nuevo_campo
})
```

---

## ✅ Checklist de Integración

- [x] Componente Profile completo
- [x] 3 tabs funcionales (Rentals, Articles, Settings)
- [x] Avatar upload a Supabase Storage
- [x] DNI upload a Supabase Storage
- [x] Actualización de perfil (nombre, teléfono)
- [x] Eliminación de productos con confirmación
- [x] Protección de rutas (ProtectedRoute)
- [x] Estados de carga (spinners)
- [x] Toast notifications
- [x] Responsive design (mobile-first)
- [x] Integración con AuthContext
- [x] Integración con itemsService y bookingsService
- [x] Integración con Supabase Auth

---

## 🐛 Troubleshooting

### Problema: "Perfil no carga"
**Causa**: Usuario no autenticado  
**Solución**: Ir a /login primero

### Problema: "Avatar no sube"
**Causa**: Bucket 'avatars' no existe o sin permisos  
**Solución**: Crear bucket en Supabase Storage con permisos públicos

### Problema: "Alquileres no aparecen"
**Causa**: Tabla 'bookings' o 'requests' sin datos  
**Solución**: Verificar consultas en `bookingsService.getByUserId()`

### Problema: "Botón Editar no funciona"
**Causa**: Ruta `/item/{id}/edit` no existe  
**Solución**: Crear página de edición o cambiar link

---

## 📝 Futuras Mejoras Sugeridas

1. **Reseñas y Ratings**: Agregar sistema de puntuación
2. **Historial de Alquileres**: Archivar alquileres completados
3. **Documentos Verificados**: Mostrar lista de documentos subidos
4. **Estadísticas**: Gráficos de ingresos, ocupación, etc.
5. **Preferencias**: Notificaciones, privacidad, etc.
6. **Avatar con Crop**: Editor de foto antes de subir
7. **2FA**: Autenticación de dos factores

---

**Fecha**: 2026-01-09  
**Versión**: 1.0  
**Estado**: ✅ Producción Ready
