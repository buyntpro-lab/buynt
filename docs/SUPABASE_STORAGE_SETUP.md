# Configuración de Supabase Storage para Fotos

Esta guía explica cómo configurar los buckets de almacenamiento y políticas necesarias para el sistema de fotos de Buynt.

## 1. Crear Buckets

### Desde el Dashboard de Supabase

1. Ve a **Storage** en el menú lateral
2. Click en **New Bucket**

#### Bucket: `items-public`
- **Name:** `items-public`
- **Public bucket:** ✅ Sí (marcado)
- **File size limit:** 10 MB
- **Allowed MIME types:** `image/webp, image/jpeg, image/png`

Este bucket almacena las fotos de los anuncios (items). Son públicas para que el feed cargue rápido sin necesidad de URLs firmadas.

#### Bucket: `booking-proof-private`
- **Name:** `booking-proof-private`
- **Public bucket:** ❌ No (desmarcado)
- **File size limit:** 10 MB
- **Allowed MIME types:** `image/webp, image/jpeg, image/png`

Este bucket almacena las evidencias de entrega/devolución. Son privadas y solo accesibles por los participantes del booking.

## 2. Ejecutar Migración SQL

Ve a **SQL Editor** en el dashboard y ejecuta el archivo:

```
supabase/migrations/20260121_photos_system.sql
```

Esto crea:
- Tabla `item_images` con RLS
- Tabla `booking_media` con RLS
- Funciones helper (`set_item_cover`, `reorder_item_images`)
- Columna `image_migrated_at` en `items`

## 3. Configurar Políticas de Storage

Después de crear los buckets, necesitas configurar las políticas RLS para controlar el acceso.

### Desde SQL Editor, ejecuta:

```sql
-- ============================================================================
-- STORAGE POLICIES FOR items-public
-- ============================================================================

-- Permitir lectura pública
CREATE POLICY "Public read items-public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'items-public');

-- Permitir subida a usuarios autenticados
CREATE POLICY "Authenticated upload items-public"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'items-public');

-- Permitir borrado a usuarios autenticados (el owner check se hace en la app)
CREATE POLICY "Authenticated delete items-public"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'items-public');

-- ============================================================================
-- STORAGE POLICIES FOR booking-proof-private
-- ============================================================================

-- Permitir lectura a usuarios autenticados
-- (El filtro de participantes se hace en RLS de booking_media)
CREATE POLICY "Authenticated read booking-proof-private"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'booking-proof-private');

-- Permitir subida a usuarios autenticados
CREATE POLICY "Authenticated upload booking-proof-private"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'booking-proof-private');

-- Permitir borrado a usuarios autenticados
CREATE POLICY "Authenticated delete booking-proof-private"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'booking-proof-private');
```

## 4. Verificar Configuración

### Test 1: Verificar tablas
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('item_images', 'booking_media');
```

### Test 2: Verificar políticas RLS
```sql
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('item_images', 'booking_media');
```

### Test 3: Verificar buckets
```sql
SELECT id, name, public FROM storage.buckets 
WHERE name IN ('items-public', 'booking-proof-private');
```

## 5. Variables de Entorno

### Frontend (.env.local)
```bash
# Ya existentes
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Script de Migración (solo local/CI)
```bash
# NUNCA en frontend o repositorio público
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## 6. Ejecutar Migración de Imágenes Existentes

Una vez configurado todo, migra las imágenes existentes desde URLs externas:

```bash
# Desde la raíz del proyecto

# 1. Instalar dependencias del script
npm install @supabase/supabase-js

# 2. Configurar variables de entorno (crear .env.local si no existe)
# VITE_SUPABASE_URL=...
# SUPABASE_SERVICE_ROLE_KEY=...

# 3. Preview (dry-run)
npx tsx scripts/migrate-images.ts --dry-run

# 4. Ejecutar migración
npx tsx scripts/migrate-images.ts --execute

# Opciones adicionales:
# --batch=10    Procesar 10 items por lote
# --delay=2000  Esperar 2 segundos entre lotes
```

## Estructura de Paths

### items-public
```
items-public/
  items/{itemId}/{imageId}-full.webp    # Imagen completa (max 1600px)
  items/{itemId}/{imageId}-thumb.webp   # Miniatura (max 400px)
```

### booking-proof-private
```
booking-proof-private/
  bookings/{rentalId}/handoff/{imageId}-full.webp  # Evidencias de entrega
  bookings/{rentalId}/return/{imageId}-full.webp   # Evidencias de devolución
```

## Troubleshooting

### Error: "new row violates row-level security policy"
- Verifica que el usuario esté autenticado
- Verifica que las políticas RLS estén creadas
- Verifica que el usuario sea el owner del item (para item_images)
- Verifica que el usuario sea participante del rental (para booking_media)

### Error: "Bucket not found"
- Verifica que los buckets estén creados en Storage
- Verifica el nombre exacto (case-sensitive)

### Las imágenes no cargan en el feed
- Verifica que `items-public` sea público (Public bucket: ✅)
- Verifica que la política de SELECT exista para public

### Las evidencias no cargan
- Verifica que el usuario esté autenticado
- Verifica que sea participante del booking
- Las URLs firmadas expiran después de 1 hora
