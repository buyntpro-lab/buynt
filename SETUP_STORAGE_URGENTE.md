# 🔧 URGENTE: Configurar Buckets en Supabase

Los buckets `items-public` y `booking-proof-private` **no existen en tu Supabase** y por eso falla la subida de fotos.

## Paso 1: Crear los Buckets

Ve a tu dashboard de **Supabase** → **Storage** → **New Bucket**

### Bucket 1: `items-public`
- **Name:** `items-public`
- **Public bucket:** ✅ SÍ (marcado como público)
- **File size limit:** 10 MB
- **Allowed MIME types:** `image/webp, image/jpeg, image/png`

### Bucket 2: `booking-proof-private`
- **Name:** `booking-proof-private`
- **Public bucket:** ❌ NO (privado)
- **File size limit:** 10 MB
- **Allowed MIME types:** `image/webp, image/jpeg, image/png`

## Paso 2: Configurar las Políticas RLS

1. Ve a **SQL Editor** en Supabase
2. Copia y ejecuta el contenido de: `supabase/migrations/20260121_setup_storage_buckets.sql`

Este script crea automáticamente todas las políticas de acceso para ambos buckets.

## Paso 3: Verificar

Una vez hecho esto, recarga la página de Buynt y prueba:

✅ Crear nuevo artículo con fotos
✅ Editar artículo y cambiar fotos
✅ Ver las fotos en el feed

---

**Si aún tienes problemas**, verifica en la consola del navegador (F12) qué error específico muestra.
