# 🔧 Technical Reference - Buynt Integración de Perfil

## Quick Reference Index

### 🔐 Authentication Flow
- [Entry Point](#entry-point) - `src/context/AuthContext.tsx`
- [Session Validation](#session-validation) - `initializeAuth()`
- [Profile Fetching](#profile-fetching) - `fetchProfile()`
- [State Changes](#state-changes) - `onAuthStateChange()`

### 👤 Profile Implementation
- [Profile Page](#profile-page) - `src/pages/Profile.tsx`
- [Avatar Upload](#avatar-upload) - `handleAvatarUpload()`
- [DNI Upload](#dni-upload) - `handleDNIUpload()`
- [Profile Editing](#profile-editing) - `handleUpdateProfile()`

### ⚙️ Infrastructure
- [Supabase Client](#supabase-client) - `src/lib/supabaseClient.ts`
- [Environment Variables](#environment-variables) - `.env.local`
- [Type Definitions](#type-definitions) - `src/services/types.ts`

### 📊 Data Models
- [User Interface](#user-interface)
- [Item Interface](#item-interface)
- [Booking Interface](#booking-interface)

---

## 🔐 Authentication Flow

### Entry Point
**File:** [src/context/AuthContext.tsx](src/context/AuthContext.tsx)

```typescript
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        // 1. initializeAuth() - Check existing session
        // 2. onAuthStateChange() - Listen for auth changes
    }, []);
    
    return (
        <AuthContext.Provider value={{ user, loading, signOut, isAuthenticated }}>
            {children}
        </AuthContext.Provider>
    );
};
```

### Session Validation
**Function:** `initializeAuth()`

```typescript
const initializeAuth = async () => {
    try {
        console.log('🔐 Initializing authentication...');
        const { data: { session } } = await supabase.auth.getSession();

        if (mounted && session?.user) {
            console.log('✅ Session found for user:', session.user.email);
            await fetchProfile(session.user.id, session.user.email || `user_${session.user.id}@buynt.com`);
        } else {
            console.log('ℹ️ No active session found');
        }
    } catch (error) {
        console.error('❌ Error checking auth session:', error);
    } finally {
        if (mounted) {
            console.log('✅ Auth initialization complete');
            setLoading(false);
        }
    }
};
```

**Expected Console Output:**
```
🔐 Initializing authentication...
✅ Session found for user: user@example.com
👤 Loading profile data for user: 123e4567
✅ Auth initialization complete
```

### Profile Fetching
**Function:** `fetchProfile(id, email)`

```typescript
const fetchProfile = async (id: string, email: string) => {
    try {
        console.log('🔍 Fetching profile for user:', id, 'email:', email);
        
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.log('⚠️ Profile fetch error, attempting to create profile:', error.code);
            // Create fallback profile
            const fallbackUser = { id, email, full_name: email.split('@')[0] };
            if (mounted) setUser(fallbackUser);
        } else {
            console.log('✅ Profile fetched successfully:', data);
            if (mounted) setUser(data as User);
        }
    } catch (error) {
        console.error('❌ Error in fetchProfile:', error);
        if (mounted) setUser({ id, email, full_name: email.split('@')[0] });
    }
};
```

### State Changes
**Listener:** `onAuthStateChange(event, session)`

```typescript
supabase.auth.onAuthStateChange(async (event, session) => {
    if (!mounted) return;

    console.log('🔔 Auth state change event:', event);

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        console.log('👤 User signed in/token refreshed:', session?.user?.email);
        if (session?.user) {
            await fetchProfile(session.user.id, session.user.email || `user_${session.user.id}@buynt.com`);
            if (mounted) {
                console.log('✅ Loading state set to false');
                setLoading(false);
            }
        }
    } else if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out');
        setUser(null);
        setLoading(false);
    }
});
```

---

## 👤 Profile Implementation

### Profile Page Structure
**File:** [src/pages/Profile.tsx](src/pages/Profile.tsx) (581 lines)

```typescript
export const Profile: React.FC = () => {
    const { user, signOut, isAuthenticated, loading: authLoading } = useAuth();
    const [items, setItems] = useState<Item[]>([]);
    const [bookings, setBookings] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('rentals');
    
    // ... render header, 3 tabs, forms
};
```

### Tab Structure
```
Profile Page
├── Header (Avatar, Name, Email, Stats, Logout)
├── Tab: "Alquileres" (Bookings List)
├── Tab: "Artículos" (Items Grid)
└── Tab: "Ajustes" (Edit Form + Uploads)
```

### Avatar Upload
**Function:** `handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>)`

```typescript
const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) {
        console.warn('⚠️ Avatar upload: No user or file selected');
        return;
    }
    
    setUploadingAvatar(true);
    const file = e.target.files[0];
    const fileName = `${user.id}-avatar-${Date.now()}`;

    try {
        console.log('📤 Uploading avatar:', fileName, 'Size:', file.size);
        
        // 1. Upload file to storage
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, { upsert: true });

        if (uploadError) throw uploadError;

        console.log('✅ Avatar uploaded, getting public URL...');
        
        // 2. Get public URL
        const { data } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

        if (!data?.publicUrl) {
            throw new Error('No se pudo obtener la URL pública del avatar');
        }

        console.log('📝 Updating profile with avatar URL:', data.publicUrl);
        
        // 3. Update database
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: data.publicUrl })
            .eq('id', user.id);

        if (updateError) throw updateError;

        // 4. Update local state
        setProfileData(prev => ({ ...prev, avatar_url: data.publicUrl }));
        console.log('✅ Avatar updated successfully');
        toast.success('Avatar actualizado correctamente');
    } catch (error: any) {
        console.error('❌ Avatar upload error:', error);
        toast.error(error.message || 'Error al subir el avatar');
    } finally {
        setUploadingAvatar(false);
    }
};
```

**Step-by-Step:**
1. ✅ Validate user and file
2. 📤 Upload to `avatars` bucket
3. 🌐 Get public URL from storage
4. 📝 Update `profiles.avatar_url` in DB
5. 👁️ Update local state
6. ✅ Show toast notification

### DNI Upload
**Function:** `handleDNIUpload(e: React.ChangeEvent<HTMLInputElement>)`

```typescript
const handleDNIUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    
    setUploadingDNI(true);
    const file = e.target.files[0];
    const fileName = `${user.id}-dni-${Date.now()}`;

    try {
        console.log('📄 Uploading DNI document...');
        
        const { error } = await supabase.storage
            .from('dni-documents')
            .upload(fileName, file, { upsert: true });

        if (error) throw error;

        console.log('✅ DNI uploaded successfully');
        toast.success('Documento DNI subido. Pendiente de verificación.');
    } catch (error: any) {
        console.error('❌ DNI upload error:', error);
        toast.error('Error al subir el DNI');
    } finally {
        setUploadingDNI(false);
    }
};
```

**Differences from Avatar:**
- Uploads to `dni-documents` (private bucket)
- No public URL needed
- Stored for manual verification
- Shows "Pendiente de verificación" message

### Profile Editing
**Function:** `handleUpdateProfile()`

```typescript
const handleUpdateProfile = async () => {
    if (!user) return;
    
    try {
        console.log('📝 Updating profile...');
        
        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: profileData.full_name,
                phone: profileData.phone
            })
            .eq('id', user.id);

        if (error) throw error;

        toast.success('Perfil actualizado correctamente');
        setEditingProfile(false);
    } catch (error: any) {
        toast.error(error.message || 'Error al actualizar el perfil');
    }
};
```

**Validation:**
- Name: Required, min 2 characters
- Phone: Optional, must be valid format
- Both fields updated together

---

## ⚙️ Infrastructure

### Supabase Client Configuration
**File:** [src/lib/supabaseClient.ts](src/lib/supabaseClient.ts)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validar que las variables de entorno estén configuradas
if (!supabaseUrl) {
    throw new Error(
        '❌ VITE_SUPABASE_URL no está configurada. ' +
        'Por favor, agrégala a tu archivo .env.local'
    );
}

if (!supabaseAnonKey) {
    throw new Error(
        '❌ VITE_SUPABASE_ANON_KEY no está configurada. ' +
        'Por favor, agrégala a tu archivo .env.local'
    );
}

// Crear instancia del cliente
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Log en desarrollo
if (import.meta.env.DEV) {
    console.log('✅ Supabase Cliente configurado correctamente');
    console.log('🌐 URL:', supabaseUrl);
}
```

**Validation Logic:**
1. Read `VITE_SUPABASE_URL` from `import.meta.env`
2. Read `VITE_SUPABASE_ANON_KEY` from `import.meta.env`
3. Throw error if either is missing
4. Create Supabase client with credentials
5. Log connection in development mode

### Environment Variables
**File:** [.env.local](.env.local)

```env
VITE_SUPABASE_URL=https://sxzpfndudjgpgwhafwlq.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_NS1lJsdGAQedKjwNBToE9A_B61urQ3s
```

**Vite Requirements:**
- Must start with `VITE_` prefix
- Only loaded from `.env.local` (not from `.env`)
- `.env.local` must be in `.gitignore`
- Accessed via `import.meta.env.VITE_*`

---

## 📊 Data Models

### User Interface
**File:** [src/services/types.ts](src/services/types.ts)

```typescript
export interface User {
    id: string;
    email: string;
    full_name?: string;
    phone?: string;
    avatar_url?: string;
    dni_verified?: boolean;
    created_at?: string;
}
```

**Fields:**
- `id`: UUID from Supabase Auth
- `email`: User's email (from Auth)
- `full_name`: Display name (optional)
- `phone`: Contact number (optional)
- `avatar_url`: Public URL from storage
- `dni_verified`: Admin-set verification flag
- `created_at`: Account creation timestamp

### Item Interface
```typescript
export interface Item {
    id: string;
    owner_id: string;
    owner_contact: string;
    title: string;
    description?: string;
    category: string;
    price_day: number;
    price_week?: number;
    price_month?: number;
    location: string;
    city: string;
    image_url?: string;
    status: 'available' | 'rented' | 'archived';
    created_at: string;
}
```

### Booking Interface
```typescript
export interface Booking {
    id: string;
    item_id: string;
    user_id: string;
    owner_id: string;
    start_date: string;
    end_date: string;
    status: 'pending' | 'accepted' | 'rejected';
    total_price: number;
    created_at: string;
}
```

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────┐
│         User Opens App                          │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│   AuthProvider renders in App.tsx               │
│   → initializeAuth() called in useEffect        │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│   Check existing session:                       │
│   supabase.auth.getSession()                    │
└─────────────┬───────────────────────────────────┘
              │
      ┌───────┴────────┐
      │                │
      ▼                ▼
   ✅ Session      ❌ No session
   Found           Found
      │                │
      ▼                ▼
   fetchProfile()  setLoading(false)
   │
   ├─ Try: SELECT * FROM profiles WHERE id = userId
   │
   ├─ Success? → setUser(profileData)
   │
   └─ Error? → Create fallback → setUser(fallbackUser)
      │
      ▼
   setLoading(false)
      │
      ▼
┌─────────────────────────────────────────────────┐
│   ProtectedRoute checks isAuthenticated         │
│   → Allows or redirects to /login               │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│   Component renders with user data              │
│   → useAuth() hook provides { user, signOut }   │
└─────────────────────────────────────────────────┘
```

---

## 🧪 Testing Checklist

### Browser Console Testing
```javascript
// Open F12 → Console
// Register/Login at /register

// Expected logs:
console.log('🔐 Initializing authentication...')
console.log('✅ Session found for user: user@example.com')
console.log('👤 User signed in/token refreshed: user@example.com')
console.log('🔍 Fetching profile for user: 123e4567...')
console.log('✅ Profile fetched successfully')

// Go to /profile
console.log('👤 Loading profile data for user: 123e4567')
console.log('✅ Loaded items: 0')
console.log('✅ Loaded bookings: 0')
```

### Manual Testing
1. ✅ Register with email
2. ✅ Login with credentials
3. ✅ Navigate to /profile
4. ✅ Upload avatar (observe spinner)
5. ✅ Edit name/phone
6. ✅ Upload DNI
7. ✅ Click logout
8. ✅ Verify redirected to /
9. ✅ Try accessing /profile → redirected to /login

---

## 🚨 Troubleshooting

### Issue: "VITE_SUPABASE_URL not configured"
**Cause:** Missing `.env.local` file  
**Solution:** Copy `.env.example` to `.env.local` with actual credentials

### Issue: "Cannot read property 'id' of undefined"
**Cause:** `user` is null when accessing properties  
**Solution:** Add null checks: `if (!user) return;`

### Issue: Avatar not uploading
**Cause:** `avatars` bucket doesn't exist in Supabase  
**Solution:** Create storage bucket named `avatars` (public)

### Issue: Profile data not loading
**Cause:** `profiles` table doesn't exist in Supabase  
**Solution:** Execute SQL to create `profiles` table with RLS

### Issue: Toast notifications not showing
**Cause:** `<Toaster />` missing from App.tsx  
**Solution:** Already in place, verify import `react-hot-toast`

---

## 📚 Related Files

- [QUICK_START.md](QUICK_START.md) - Quick setup guide
- [INTEGRATION_CHECKLIST.md](INTEGRATION_CHECKLIST.md) - Full integration checklist
- [PROFILE_PAGE_DOCUMENTATION.md](PROFILE_PAGE_DOCUMENTATION.md) - Profile page guide
- [SUPABASE_ITEMS_SETUP.md](SUPABASE_ITEMS_SETUP.md) - Database setup
- [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md) - Summary

---

