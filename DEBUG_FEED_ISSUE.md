# 🔍 Diagnóstico: Feed de productos no se mostraba al loguearse

## Problema Reportado
Cuando un usuario iniciaba sesión, el feed de productos (Home) no se mostraba. La página se quedaba con un spinner de carga.

---

## 🔴 Causa Principal Identificada

### Bug Crítico en `src/context/AuthContext.tsx`

**Ubicación**: Línea ~100-107 (en la función `onAuthStateChange`)

**Problema**: Cuando un usuario hacía login, Supabase Auth disparaba el evento `'SIGNED_IN'`, que llamaba a `fetchProfile()` para cargar/crear el perfil del usuario. PERO **NO ejecutaba `setLoading(false)` al finalizar**.

**Consecuencia**:
```
1. Usuario hace login ✅
2. AuthContext recibe evento 'SIGNED_IN' ✅
3. fetchProfile() intenta cargar perfil de Supabase
4. ❌ PROBLEMA: setLoading(false) NUNCA se ejecuta
5. ProtectedRoute ve loading=true indefinidamente
6. Home nunca se renderiza
7. Usuario ve spinner de carga infinito (o hasta timeout de 3s)
```

### Bug Secundario en `fetchProfile()`

**Ubicación**: Línea ~43 (manejo de errores)

**Problema**: El código solo buscaba específicamente el error con código `'PGRST116'` (record not found):
```typescript
if (error && error.code === 'PGRST116') { ... }
```

**Pero si la tabla `profiles` no existía**, Supabase devolvía un error diferente (ej: `'42P01'` - relation does not exist), y el código no lo capturaba correctamente.

**Además**: Si el error era ANY otro (permisos insuficientes, etc.), ninguna de las ramas se ejecutaba y `setUser` nunca se llamaba.

---

## ✅ Soluciones Aplicadas

### Fix #1: Agregar `setLoading(false)` en onAuthStateChange
**Archivo**: [src/context/AuthContext.tsx](src/context/AuthContext.tsx#L108)

```typescript
// ANTES ❌
if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    if (session?.user) {
        await fetchProfile(session.user.id, session.user.email || `user_${session.user.id}@buynt.com`);
    }
}

// DESPUÉS ✅
if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    if (session?.user) {
        await fetchProfile(session.user.id, session.user.email || `user_${session.user.id}@buynt.com`);
        if (mounted) setLoading(false);  // ← AGREGADO
    }
}
```

**Impacto**: Ahora el estado `loading` se actualiza correctamente después de que `fetchProfile()` completa, permitiendo que `ProtectedRoute` renderice `Home`.

---

### Fix #2: Mejorar manejo de errores en fetchProfile()
**Archivo**: [src/context/AuthContext.tsx](src/context/AuthContext.tsx#L32-L80)

**Cambio**: Reemplazar validación específica de error PGRST116 con un manejo más robusto:

```typescript
// ANTES ❌
if (error && error.code === 'PGRST116') {
    // Create profile if not exists
    // ...
} else if (data) {
    setUser(data);
} else {
    // Fallback...
}

// DESPUÉS ✅
if (error) {
    // ANY error → intentar crear profile
    // Si create también falla → usar minimal user
    // Si no hay error pero tampoco data → fallback minimal user
}
```

**Impacto**: 
- Maneja todos los tipos de error, no solo PGRST116
- Si falla la creación del perfil, usa un usuario minimal en lugar de quedar atrapado
- Garantiza que `setUser()` SIEMPRE se ejecuta (sin quedar en null)

---

### Fix #3: Logging mejorado en Home.tsx
**Archivo**: [src/pages/Home.tsx](src/pages/Home.tsx#L16-L32)

Agregué logs de console para facilitar debugging:
```typescript
console.log('Home: Fetching items...');
const allItems = await itemsService.getAll();
console.log('Home: Items fetched:', allItems);
```

**Impacto**: Ahora puedes ver en DevTools → Console si los items se están cargando correctamente.

---

## 🧪 Cómo Verificar que Funciona

### 1. **Abre la consola del navegador**
   - F12 → Pestaña "Console"

### 2. **Intenta hacer login**
   - Navega a http://localhost:5174/login
   - Usa email/password válidas

### 3. **Observa los logs**
   Deberías ver:
   ```
   Home: Fetching items...
   Home: Items fetched: [Array de items...]
   ```

### 4. **Verifica el estado**
   Si ves errores en la consola como:
   ```
   Error fetching items (Supabase): { ... }
   ```
   Significa que hay un problema de conexión a Supabase (ver siguiente sección).

---

## 🔧 Posibles Problemas Remanentes

### Problema: "Aún veo un spinner después del fix"
**Causas posibles**:
1. **Tabla `profiles` no existe en Supabase**: El código crea un perfil, pero si Supabase rechaza la inserción sin error explícito, puede quedar en limbo
   - **Solución**: Verifica en tu dashboard de Supabase que la tabla `profiles` existe y tiene permisos RLS correctos

2. **Tabla `items` no existe o está vacía**:
   - **Solución**: 
     - Verifica que la tabla `items` existe
     - Inserta al menos un item para que aparezca en el feed
     - Check los permisos RLS: debe permitir `SELECT` para usuarios anónimos o autenticados

3. **Problema de CORS o credenciales inválidas**:
   - **Solución**: Verifica que las credenciales en [src/services/supabase.ts](src/services/supabase.ts) son correctas:
     ```typescript
     const supabaseUrl = 'https://sxzpfndudjgpgwhafwlq.supabase.co';
     const supabaseAnonKey = 'sb_publishable_NS1lJsdGAQedKjwNBToE9A_B61urQ3s';
     ```

### Problema: "Recibo errores de tipo TypeScript"
No bloquean el dev server, pero sí la compilación. Los cambios que hice no introducen nuevos errores, pero hay errores preexistentes en:
- `src/pages/MyRequests.tsx` (usa `requester_id` que no existe)
- `src/services/db.ts` (usa `is_available` que no existe)

Estos no afectan el feed en Home, pero deberías arreglarlos.

---

## 📋 Resumen de Cambios

| Archivo | Líneas | Cambio |
|---------|--------|--------|
| [src/context/AuthContext.tsx](src/context/AuthContext.tsx#L32-L80) | 32-80 | Mejorar `fetchProfile()` con mejor manejo de errores |
| [src/context/AuthContext.tsx](src/context/AuthContext.tsx#L102-L110) | 102-110 | Agregar `setLoading(false)` en `onAuthStateChange` |
| [src/pages/Home.tsx](src/pages/Home.tsx#L16-L32) | 16-32 | Agregar logs de console para debugging |

---

## 🚀 Próximos Pasos Recomendados

1. **Test**: Intenta hacer login y verifica que se muestra el feed
2. **Check Supabase**: Asegúrate que:
   - Tabla `profiles` existe con columnas: `id`, `email`, `full_name`, `avatar_url`, `dni_verified`
   - Tabla `items` existe y tiene al menos 1 registro
   - Permisos RLS permiten lectura
3. **Arreglar errores TypeScript menores** en otros archivos si los necesitas

---

**Generado**: 2026-01-09  
**Versión del Fix**: 1.0
