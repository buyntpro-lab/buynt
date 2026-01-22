-- ============================================================================
-- SUPABASE STORAGE BUCKETS SETUP
-- ============================================================================
-- Ejecuta este script en SQL Editor de Supabase para crear los buckets necesarios

-- 1. Create items-public bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'items-public',
    'items-public',
    true,
    10485760, -- 10MB
    ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create booking-proof-private bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'booking-proof-private',
    'booking-proof-private',
    false,
    10485760, -- 10MB
    ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE RLS POLICIES
-- ============================================================================

-- For items-public bucket
DROP POLICY IF EXISTS "Public read items-public" ON storage.objects;
CREATE POLICY "Public read items-public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'items-public');

DROP POLICY IF EXISTS "Authenticated upload items-public" ON storage.objects;
CREATE POLICY "Authenticated upload items-public"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'items-public');

DROP POLICY IF EXISTS "Authenticated delete items-public" ON storage.objects;
CREATE POLICY "Authenticated delete items-public"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'items-public');

-- For booking-proof-private bucket
DROP POLICY IF EXISTS "Authenticated read booking-proof-private" ON storage.objects;
CREATE POLICY "Authenticated read booking-proof-private"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'booking-proof-private');

DROP POLICY IF EXISTS "Authenticated upload booking-proof-private" ON storage.objects;
CREATE POLICY "Authenticated upload booking-proof-private"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'booking-proof-private');

DROP POLICY IF EXISTS "Authenticated delete booking-proof-private" ON storage.objects;
CREATE POLICY "Authenticated delete booking-proof-private"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'booking-proof-private');
