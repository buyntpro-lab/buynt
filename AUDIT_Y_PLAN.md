# 📋 AUDIT & PLAN - Buynt Marketplace UI/UX

## 🔍 AUDIT ACTUAL

### ✅ LO QUE YA EXISTE

**Páginas:**
- ✅ Login.tsx (estilo moderno)
- ✅ Register.tsx
- ✅ Home.tsx (feed con grid básico)
- ✅ ItemDetail.tsx (ficha de producto)
- ✅ Publish.tsx (form de publicación)
- ✅ MyItems.tsx (listado de items del usuario)
- ✅ MyRequests.tsx
- ✅ Inbox.tsx (chat)
- ✅ Chat.tsx
- ✅ Profile.tsx (perfil completo con tabs)

**Componentes:**
- ✅ Header.tsx (sticky, con logo, busca, botones)
- ✅ Layout.tsx (estructura base)
- ✅ ProtectedRoute.tsx (rutas protegidas)
- ✅ Button.tsx (variants: primary, secondary, outline, ghost)
- ✅ Card.tsx (wrapper reutilizable)
- ✅ Badge.tsx
- ✅ Input.tsx
- ✅ Modal.tsx
- ✅ BookingWidget.tsx (para reservas)
- ✅ ChatBubble.tsx

**Stack:**
- ✅ React 19, TypeScript, Vite
- ✅ Tailwind CSS 4
- ✅ React Router 7
- ✅ Supabase ready
- ✅ AuthContext completo

---

## ❌ LO QUE FALTA (CRÍTICO PARA MVP)

### 1. LANDING PAGE (Nueva)
**Estado:** ❌ NO EXISTE
**Impacto:** CRÍTICO - La app empieza directo en login, sin page pública
**Requisitos:**
- Hero section con copy claro
- 3 pasos de "cómo funciona"
- Categorías destacadas
- Sección de seguridad/confianza
- CTAs: "Explorar" (→ /home sin login requerido) y "Publicar" (→ /login)

### 2. HOME PÚBLICA (Explorar sin login)
**Estado:** ⚠️ EXISTE pero es ProtectedRoute
**Impacto:** CRÍTICO - Los visitantes no pueden ver productos sin estar logeados
**Requisitos:**
- Hacer HOME pública (sin ProtectedRoute)
- Buscador funcional
- Filtros chip: categoría, rango precio, ciudad
- ProductGrid responsivo
- EmptyState para sin resultados

### 3. ProductCard MEJORADO
**Estado:** ⚠️ EXISTE pero básico
**Impacto:** ALTO - Es el componente más visto
**Requisitos:**
- Imagen con badge de categoría
- Título + precio/día destacado
- Ubicación con icono
- Descripción truncada (2 líneas)
- Rating/reviews placeholder
- Hover effect: scale + shadow

### 4. ProductGrid / ProductList
**Estado:** ⚠️ EXISTE pero está en Home
**Impacto:** ALTO - Necesita ser componente reutilizable
**Requisitos:**
- Componente separado que reciba items[]
- 2 modos: GRID (3 cols desktop, 2 tablet, 1 móvil) y LIST
- Toggle para cambiar modo
- Infinite scroll placeholder

### 5. BUSCADOR AVANZADO
**Estado:** ⚠️ Header tiene input básico
**Impacto:** ALTO
**Requisitos:**
- SearchBar componente reutilizable
- Integración en Header
- Sugerencias de búsqueda (placeholder)
- Filtros en sidebar/drawer (móvil)

### 6. PÁGINA DE CATEGORÍAS
**Estado:** ❌ NO EXISTE
**Impacto:** MEDIO
**Requisitos:**
- Grid de categorías (Deportes, Electrónica, etc)
- Icono + nombre + cantidad de items
- Link a búsqueda filtrada por categoría

### 7. RESULTADOS DE BÚSQUEDA
**Estado:** ⚠️ Home con query params
**Impacto:** ALTO
**Requisitos:**
- Mostrar filtros aplicados como chips
- "X resultados encontrados"
- Opción limpiar filtros
- EmptyState si no hay coincidencias

### 8. FICHA DE PRODUCTO (ItemDetail)
**Estado:** ⚠️ EXISTE pero INCOMPLETO
**Impacto:** CRÍTICO
**Requisitos:**
- Galería de fotos (carousel/lightbox) - placeholder por ahora
- Precio/día destacado + "Depósito: $XX" 
- Descripción completa
- Disponibilidad con calendario placeholder
- Bloque "Sobre el propietario" (avatar, nombre, rating)
- Botones: "Solicitar alquiler" (primary) + "Enviar mensaje" (ghost)
- Sección "Productos similares"
- Reviews/reseñas (placeholder)

### 9. FORMULARIO DE PUBLICACIÓN (Publish)
**Estado:** ⚠️ EXISTE pero básico
**Impacto:** ALTO
**Requisitos:**
- Campos mejorados con labels claros
- Vista previa de fotos (con placeholder para subidas)
- Categoría con dropdown visual
- Depósito como campo opcional
- Preview del anuncio antes de publicar
- Validaciones visuales

### 10. NAVEGACIÓN MÓVIL (Bottom Tab Bar)
**Estado:** ❌ NO EXISTE
**Impacto:** CRÍTICO - App debe parecer "app nativa"
**Requisitos:**
- TabBar en bottom con: Home, Buscar, Publicar (+), Mensajes, Perfil
- Solo visible en móvil (<md)
- Icono activo destacado
- Badge rojo en Mensajes si hay sin leer

### 11. COMPONENTES DE CARGA
**Estado:** ❌ NO EXISTEN
**Impacto:** MEDIO
**Requisitos:**
- LoadingSkeleton para ProductCard
- LoadingSkeleton para ItemDetail
- Shimmer effect básico

### 12. ESTADOS VACÍOS
**Estado:** ⚠️ Existen pero inconsistentes
**Impacto:** MEDIO
**Requisitos:**
- EmptyState reutilizable (icon, título, descripción, CTA)
- Uno para: "Sin productos", "Sin mensajes", "Sin favoritos"

### 13. PÁGINA DE FAVORITOS (No mencionada pero útil)
**Estado:** ❌ NO EXISTE
**Impacto:** BAJO
**Requisitos:**
- Grid de productos guardados
- Botón para borrar favoritos

### 14. MODAL DE COMPARTIR
**Estado:** ❌ NO EXISTE
**Impacto:** BAJO
**Requisitos:**
- Modal para copiar link o compartir en redes
- En ItemDetail (botón Share)

---

## 📊 IMPACTO DE CAMBIOS

| Componente | Estado | Impacto | Tiempo Est. |
|-----------|--------|--------|------------|
| Landing | ❌ | CRÍTICO | 2h |
| Home Pública | ⚠️ | CRÍTICO | 30min |
| Bottom TabBar | ❌ | CRÍTICO | 1h |
| ProductCard Mejorado | ⚠️ | ALTO | 1h |
| ProductGrid | ⚠️ | ALTO | 30min |
| Buscador Avanzado | ⚠️ | ALTO | 1h |
| ItemDetail Completo | ⚠️ | CRÍTICO | 2h |
| Categorías Page | ❌ | MEDIO | 1h |
| Publicación Mejorada | ⚠️ | ALTO | 1.5h |
| LoadingSkeleton | ❌ | MEDIO | 1h |
| EmptyState | ⚠️ | MEDIO | 30min |
| Compartir | ❌ | BAJO | 30min |
| Favoritos | ❌ | BAJO | 1h |

**TOTAL ESTIMADO:** ~15 horas

---

## 🎯 PLAN DE EJECUCIÓN (ORDEN PRIORIDAD)

### FASE 1: ESTRUCTURA BASE (4h)
- [ ] **1.1** Crear Landing.tsx pública
- [ ] **1.2** Hacer Home pública (quitar ProtectedRoute)
- [ ] **1.3** Crear BottomTabBar.tsx para móvil
- [ ] **1.4** Actualizar Layout.tsx para incluir TabBar

### FASE 2: PRODUCTOS & BÚSQUEDA (4h)
- [ ] **2.1** Mejorar ProductCard con más info y estilos
- [ ] **2.2** Crear ProductGrid.tsx componente reutilizable
- [ ] **2.3** Crear SearchBar.tsx componente
- [ ] **2.4** Crear FilterChips.tsx (visuales, no funcionales aún)
- [ ] **2.5** Crear página Categorías.tsx

### FASE 3: FICHA DE PRODUCTO (3h)
- [ ] **3.1** Mejorar ItemDetail con galería placeholder
- [ ] **3.2** Agregar bloque "Sobre el propietario"
- [ ] **3.3** Agregar "Productos similares"
- [ ] **3.4** Mejorar botones de acción
- [ ] **3.5** Agregar modal compartir

### FASE 4: FORMULARIOS & UX (2h)
- [ ] **4.1** Mejorar Publish.tsx con validaciones visuales
- [ ] **4.2** Agregar preview de anuncio
- [ ] **4.3** Crear componentes LoadingSkeleton
- [ ] **4.4** Mejorar EmptyStates

### FASE 5: REFINAMIENTO (2h)
- [ ] **5.1** Revisar responsive en móvil y desktop
- [ ] **5.2** Ajustar spacing, tipografía, colores
- [ ] **5.3** Agregar transiciones suaves
- [ ] **5.4** Testing de navegación completa

---

## 🚀 SIGUIENTE PASO (Backend Integration)
Una vez completada esta fase:
- Conectar API calls a Supabase
- Implementar búsqueda real
- Agregar filtros funcionales
- Integrar favoritos
- Agregar pagos/transacciones

---

## 📋 NOTAS IMPORTANTES

✅ **SIN backend por ahora:** Solo UI/UX con datos mock
✅ **Reutilización de componentes:** ProductCard, SearchBar, etc
✅ **Mobile-first:** Diseñar para móvil primero
✅ **Consistencia visual:** Seguir Wallapop pero con estilo Buynt
✅ **Accesibilidad:** Buenas prácticas de a11y

