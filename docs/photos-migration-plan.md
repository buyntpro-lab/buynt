# Plan de Migración del Sistema de Fotos - Buynt

**Fecha:** Enero 2026  
**Sprint:** Fotos End-to-End  
**Estado:** En progreso

---

## 1. Análisis del Estado Actual

### 1.1 Esquema de Base de Datos Actual

#### Tabla `items` (productos/anuncios)
```sql
-- Campos relevantes para fotos:
id          UUID PRIMARY KEY
image_url   TEXT              -- URL externa de la imagen (ej: unsplash)
owner_id    UUID              -- Referencia al propietario
-- ... otros campos
```

**Observaciones:**
- Solo 1 imagen por item, guardada como URL string externa
- No hay tabla dedicada para imágenes
- No hay soporte para múltiples fotos
- Dependencia de URLs externas (no controlamos disponibilidad)

#### Tablas `rental_requests` y `rentals` (sistema de solicitudes/alquileres)
```sql
-- rental_requests: solicitudes pendientes
-- rentals: alquileres confirmados (bookings activos)
-- NO tienen campos de evidencias/fotos de handoff/return
```

### 1.2 Supabase Client
- Cliente en `/src/lib/supabaseClient.ts` con `anon_key`
- Re-exportado en `/src/services/supabase.ts`
- Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- NO se usa `service_role` en frontend (correcto)

### 1.3 Vistas que Muestran Imágenes

| Vista | Archivo | Uso de imagen |
|-------|---------|---------------|
| Feed (Home) | `src/pages/Home.tsx` | `ProductGrid` → `ProductCard` |
| ProductCard | `src/components/common/ProductCard.tsx` | `item.image_url` directo |
| Detalle Item | `src/pages/ItemDetail.tsx` | `item.image_url` hero |
| Publicar | `src/pages/Publish.tsx` | Input URL manual |
| Editar | `src/pages/EditItem.tsx` | ProductForm con URL |
| Solicitud Detalle | `src/pages/SolicitudDetail.tsx` | `item_image_url` de join |

---

## 2. Cambios Propuestos

### 2.1 Nuevas Tablas

#### A) `item_images` - Imágenes de anuncios
```sql
CREATE TABLE item_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    path TEXT NOT NULL,                    -- ruta en Storage
    bucket TEXT NOT NULL DEFAULT 'items-public',
    is_cover BOOLEAN NOT NULL DEFAULT false,
    sort INT NOT NULL DEFAULT 0,
    width INT,
    height INT,
    mime TEXT,
    bytes INT,
    source_url TEXT,                       -- URL original (migración)
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_item_images_item_id ON item_images(item_id);
CREATE UNIQUE INDEX idx_item_images_unique_cover 
    ON item_images(item_id) WHERE is_cover = true;
```

#### B) `booking_media` - Evidencias de alquiler
```sql
CREATE TABLE booking_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('handoff', 'return')),
    path TEXT NOT NULL,
    bucket TEXT NOT NULL DEFAULT 'booking-proof-private',
    uploaded_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    note TEXT,
    bytes INT
);

-- Índices
CREATE INDEX idx_booking_media_rental_id ON booking_media(rental_id);
CREATE INDEX idx_booking_media_type ON booking_media(type);
```

#### C) Modificación a `items`
```sql
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS image_migrated_at TIMESTAMPTZ;
```

### 2.2 Buckets de Storage

| Bucket | Visibilidad | Propósito |
|--------|-------------|-----------|
| `items-public` | Público | Fotos de anuncios (feed rápido) |
| `booking-proof-private` | Privado + RLS | Evidencias entrega/devolución |

### 2.3 Paths Normalizados

```
items-public/
  items/{itemId}/{uuid}-full.webp
  items/{itemId}/{uuid}-thumb.webp

booking-proof-private/
  bookings/{rentalId}/handoff/{uuid}-full.webp
  bookings/{rentalId}/handoff/{uuid}-thumb.webp
  bookings/{rentalId}/return/{uuid}-full.webp
  bookings/{rentalId}/return/{uuid}-thumb.webp
```

---

## 3. Archivos a Crear/Modificar

### 3.1 Nuevos Archivos

| Archivo | Propósito |
|---------|-----------|
| `supabase/migrations/20260121_photos_system.sql` | Migración SQL completa |
| `src/services/storageService.ts` | Helpers de Storage |
| `src/utils/imageCompression.ts` | Compresión WEBP en cliente |
| `src/components/upload/ImageUploader.tsx` | Componente multi-upload |
| `src/components/upload/ImagePreview.tsx` | Preview con reorder/delete |
| `src/components/gallery/ImageGallery.tsx` | Galería para detalle |
| `src/components/booking/BookingEvidence.tsx` | Upload evidencias |
| `scripts/migrate-images.ts` | Script migración URLs |
| `docs/SUPABASE_STORAGE_SETUP.md` | Instrucciones setup |

### 3.2 Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/services/types.ts` | Añadir `ItemImage`, `BookingMedia` |
| `src/services/supabaseDb.ts` | Métodos para item_images |
| `src/pages/Publish.tsx` | Reemplazar URL input por uploader |
| `src/pages/EditItem.tsx` | Añadir gestión de imágenes |
| `src/pages/ItemDetail.tsx` | Galería con fallback |
| `src/components/common/ProductCard.tsx` | Usar thumb + fallback |
| `src/components/common/ProductGrid.tsx` | Pasar thumb URL |
| `src/pages/SolicitudDetail.tsx` | Sección evidencias |

---

## 4. Estrategia de Compatibilidad

### 4.1 Fallback en Lectura

```typescript
function getItemImageUrl(item: Item, images?: ItemImage[]): string {
  // 1. Buscar cover en item_images
  const cover = images?.find(img => img.is_cover);
  if (cover) return getPublicUrl('items-public', cover.path);
  
  // 2. Fallback a image_url legacy
  if (item.image_url) return item.image_url;
  
  // 3. Placeholder
  return '/placeholder-item.svg';
}
```

### 4.2 Campos Legacy
- **NO eliminar** `items.image_url` durante este sprint
- Añadir `items.image_migrated_at` para tracking
- Permitir lectura híbrida hasta migración completa

---

## 5. Migración de URLs Existentes

### 5.1 Proceso
1. Script Node ejecutable localmente
2. Usa `service_role` key (solo en entorno local/CI)
3. Protecciones SSRF (bloqueo IPs privadas)
4. Modos: `dry-run` y `execute`
5. Batch processing con delay configurable

### 5.2 Lógica
```
Para cada item donde:
  - image_url IS NOT NULL
  - image_migrated_at IS NULL
  - NO existe row en item_images con is_cover=true

1. Validar URL (https, no IP privada)
2. Descargar imagen (timeout 30s, max 10MB)
3. Validar Content-Type image/*
4. Comprimir a WEBP (full + thumb)
5. Subir a Storage
6. Insertar en item_images
7. Marcar item.image_migrated_at = now()
```

### 5.3 Fallback en Fallos
- Log del error con item_id
- Item mantiene image_url funcional
- No marca como migrado
- Reintentable en próxima ejecución

---

## 6. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| URL externa no disponible | Media | Bajo | Fallback mantiene URL, reintento |
| CORS en descarga | Alta | Bajo | Descarga server-side solamente |
| Bucket mal configurado | Baja | Alto | Documentación paso a paso |
| RLS bloquea upload | Media | Alto | Tests antes de merge |
| Imágenes muy pesadas | Media | Medio | Compresión obligatoria |
| SSRF en migración | Baja | Alto | Whitelist protocolos, blacklist IPs |

---

## 7. Checklist de Pruebas

### Creación de Items
- [ ] Crear item nuevo con 3 fotos
- [ ] Verificar preview y reorder
- [ ] Marcar cover diferente
- [ ] Borrar una foto
- [ ] Guardar y verificar en feed
- [ ] Verificar detalle con galería

### Edición de Items
- [ ] Editar item existente con fotos
- [ ] Añadir nueva foto
- [ ] Cambiar cover
- [ ] Reordenar
- [ ] Borrar foto
- [ ] Verificar permisos (solo owner)

### Evidencias de Booking
- [ ] Subir fotos handoff como renter
- [ ] Verificar owner puede ver
- [ ] Subir fotos return como owner
- [ ] Verificar renter puede ver
- [ ] Verificar terceros NO pueden ver

### Migración
- [ ] Ejecutar dry-run, verificar lista
- [ ] Ejecutar migrate 5 items
- [ ] Verificar imágenes en Storage
- [ ] Verificar rows en item_images
- [ ] Verificar feed muestra desde Storage
- [ ] Item fallido mantiene URL legacy

---

## 8. Orden de Implementación

1. ✅ Documentación (este archivo)
2. ⬜ Migración SQL (tablas + RLS)
3. ⬜ Helpers de Storage
4. ⬜ Utilidades de compresión
5. ⬜ Componente ImageUploader
6. ⬜ Integrar en Publish.tsx
7. ⬜ Integrar en EditItem.tsx
8. ⬜ Actualizar ProductCard (thumb + fallback)
9. ⬜ Galería en ItemDetail
10. ⬜ Evidencias en SolicitudDetail
11. ⬜ Script de migración
12. ⬜ Documentación setup Supabase
13. ⬜ Tests manuales

---

## 9. Configuración Requerida

### Variables de Entorno
```bash
# Ya existentes
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Nueva para script de migración (solo local/CI)
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # NUNCA en frontend
```

### Supabase Dashboard
1. Crear bucket `items-public` (público)
2. Crear bucket `booking-proof-private` (privado)
3. Configurar políticas RLS en buckets
4. Ejecutar migración SQL

