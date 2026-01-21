-- ============================================================================
-- PHOTOS SYSTEM - Complete Migration
-- Buynt Marketplace
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: ITEM IMAGES TABLE (Public photos for listings)
-- ============================================================================

-- Drop if exists for clean re-run (development only)
DROP TABLE IF EXISTS public.item_images CASCADE;

CREATE TABLE public.item_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference to item
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    
    -- Storage info
    path TEXT NOT NULL,                              -- e.g. items/{itemId}/{uuid}-full.webp
    bucket TEXT NOT NULL DEFAULT 'items-public',
    
    -- Image metadata
    is_cover BOOLEAN NOT NULL DEFAULT false,         -- Primary image for feed
    sort INT NOT NULL DEFAULT 0,                     -- Order in gallery
    width INT,                                        -- Original width
    height INT,                                       -- Original height
    mime TEXT,                                        -- image/webp, image/jpeg, etc.
    bytes INT,                                        -- File size
    
    -- Migration tracking
    source_url TEXT,                                  -- Original URL if migrated
    
    -- Audit
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_item_images_item_id ON public.item_images(item_id);
CREATE INDEX idx_item_images_sort ON public.item_images(item_id, sort);

-- Unique constraint: only one cover per item
CREATE UNIQUE INDEX idx_item_images_unique_cover 
    ON public.item_images(item_id) 
    WHERE is_cover = true;

-- ============================================================================
-- PART 2: BOOKING MEDIA TABLE (Private evidence photos)
-- ============================================================================

DROP TABLE IF EXISTS public.booking_media CASCADE;

CREATE TABLE public.booking_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference to rental (confirmed booking)
    rental_id UUID NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
    
    -- Type: handoff (delivery) or return
    type TEXT NOT NULL CHECK (type IN ('handoff', 'return')),
    
    -- Storage info
    path TEXT NOT NULL,                              -- e.g. bookings/{rentalId}/handoff/{uuid}.webp
    bucket TEXT NOT NULL DEFAULT 'booking-proof-private',
    
    -- Metadata
    bytes INT,
    note TEXT,                                        -- Optional description
    
    -- Audit
    uploaded_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_booking_media_rental_id ON public.booking_media(rental_id);
CREATE INDEX idx_booking_media_type ON public.booking_media(type);
CREATE INDEX idx_booking_media_rental_type ON public.booking_media(rental_id, type);

-- ============================================================================
-- PART 3: ADD MIGRATION TRACKING TO ITEMS
-- ============================================================================

-- Add column to track which items have been migrated
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS image_migrated_at TIMESTAMPTZ;

-- ============================================================================
-- PART 4: ROW LEVEL SECURITY - ITEM_IMAGES
-- ============================================================================

ALTER TABLE public.item_images ENABLE ROW LEVEL SECURITY;

-- SELECT: Anyone can view item images (public marketplace)
CREATE POLICY item_images_select ON public.item_images
    FOR SELECT USING (true);

-- INSERT: Only authenticated users, and they must own the item
CREATE POLICY item_images_insert ON public.item_images
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.items 
            WHERE items.id = item_id 
            AND items.owner_id = auth.uid()
        )
        AND created_by = auth.uid()
    );

-- UPDATE: Only the item owner can update (reorder, change cover)
CREATE POLICY item_images_update ON public.item_images
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.items 
            WHERE items.id = item_id 
            AND items.owner_id = auth.uid()
        )
    );

-- DELETE: Only the item owner can delete
CREATE POLICY item_images_delete ON public.item_images
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.items 
            WHERE items.id = item_id 
            AND items.owner_id = auth.uid()
        )
    );

-- ============================================================================
-- PART 5: ROW LEVEL SECURITY - BOOKING_MEDIA
-- ============================================================================

ALTER TABLE public.booking_media ENABLE ROW LEVEL SECURITY;

-- SELECT: Only rental participants (owner or renter) can view
CREATE POLICY booking_media_select ON public.booking_media
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.rentals 
            WHERE rentals.id = rental_id 
            AND (rentals.owner_id = auth.uid() OR rentals.renter_id = auth.uid())
        )
    );

-- INSERT: Only rental participants can upload
CREATE POLICY booking_media_insert ON public.booking_media
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.rentals 
            WHERE rentals.id = rental_id 
            AND (rentals.owner_id = auth.uid() OR rentals.renter_id = auth.uid())
        )
        AND uploaded_by = auth.uid()
    );

-- DELETE: Only the uploader can delete their own evidence
CREATE POLICY booking_media_delete ON public.booking_media
    FOR DELETE USING (
        uploaded_by = auth.uid()
    );

-- ============================================================================
-- PART 6: HELPER FUNCTIONS
-- ============================================================================

-- Function to get item cover image URL (with fallback)
CREATE OR REPLACE FUNCTION get_item_cover_path(p_item_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_path TEXT;
BEGIN
    -- Try to get cover from item_images
    SELECT path INTO v_path
    FROM public.item_images
    WHERE item_id = p_item_id AND is_cover = true
    LIMIT 1;
    
    RETURN v_path;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get all item images ordered
CREATE OR REPLACE FUNCTION get_item_images(p_item_id UUID)
RETURNS TABLE (
    id UUID,
    path TEXT,
    is_cover BOOLEAN,
    sort INT,
    width INT,
    height INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ii.id,
        ii.path,
        ii.is_cover,
        ii.sort,
        ii.width,
        ii.height
    FROM public.item_images ii
    WHERE ii.item_id = p_item_id
    ORDER BY ii.sort ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to set cover image (ensures only one cover per item)
CREATE OR REPLACE FUNCTION set_item_cover(p_image_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_item_id UUID;
BEGIN
    -- Get item_id from the image
    SELECT item_id INTO v_item_id
    FROM public.item_images
    WHERE id = p_image_id;
    
    IF v_item_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Verify ownership
    IF NOT EXISTS (
        SELECT 1 FROM public.items 
        WHERE id = v_item_id AND owner_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;
    
    -- Remove current cover
    UPDATE public.item_images
    SET is_cover = false
    WHERE item_id = v_item_id AND is_cover = true;
    
    -- Set new cover
    UPDATE public.item_images
    SET is_cover = true
    WHERE id = p_image_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reorder images
CREATE OR REPLACE FUNCTION reorder_item_images(p_image_ids UUID[])
RETURNS BOOLEAN AS $$
DECLARE
    v_item_id UUID;
    v_idx INT;
    v_id UUID;
BEGIN
    -- Get item_id from first image
    IF array_length(p_image_ids, 1) = 0 THEN
        RETURN false;
    END IF;
    
    SELECT item_id INTO v_item_id
    FROM public.item_images
    WHERE id = p_image_ids[1];
    
    -- Verify ownership
    IF NOT EXISTS (
        SELECT 1 FROM public.items 
        WHERE id = v_item_id AND owner_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;
    
    -- Update sort order
    v_idx := 0;
    FOREACH v_id IN ARRAY p_image_ids
    LOOP
        UPDATE public.item_images
        SET sort = v_idx
        WHERE id = v_id AND item_id = v_item_id;
        v_idx := v_idx + 1;
    END LOOP;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 7: STORAGE BUCKET POLICIES (run separately in Storage settings)
-- ============================================================================

/*
STORAGE BUCKET SETUP (do this in Supabase Dashboard > Storage):

1. Create bucket: items-public
   - Public: YES
   - File size limit: 10MB
   - Allowed MIME types: image/webp, image/jpeg, image/png

2. Create bucket: booking-proof-private  
   - Public: NO
   - File size limit: 10MB
   - Allowed MIME types: image/webp, image/jpeg, image/png

STORAGE POLICIES (SQL to run in SQL Editor):

-- items-public: anyone can read
CREATE POLICY "Public read items-public"
ON storage.objects FOR SELECT
USING (bucket_id = 'items-public');

-- items-public: authenticated users can upload to their items
CREATE POLICY "Authenticated upload items-public"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'items-public'
    AND auth.role() = 'authenticated'
);

-- items-public: item owners can delete
CREATE POLICY "Owner delete items-public"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'items-public'
    AND auth.role() = 'authenticated'
);

-- booking-proof-private: rental participants can read
CREATE POLICY "Participants read booking-proof-private"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'booking-proof-private'
    AND auth.role() = 'authenticated'
);

-- booking-proof-private: rental participants can upload
CREATE POLICY "Participants upload booking-proof-private"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'booking-proof-private'
    AND auth.role() = 'authenticated'
);

-- booking-proof-private: uploader can delete
CREATE POLICY "Uploader delete booking-proof-private"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'booking-proof-private'
    AND auth.role() = 'authenticated'
);

*/

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Run these to verify tables were created:
-- SELECT * FROM information_schema.tables WHERE table_name IN ('item_images', 'booking_media');
-- SELECT * FROM pg_policies WHERE tablename IN ('item_images', 'booking_media');
