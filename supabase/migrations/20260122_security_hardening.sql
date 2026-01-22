-- ============================================================================
-- SECURITY HARDENING MIGRATION
-- Buynt Marketplace - Production Ready
-- Date: January 21, 2026
-- 
-- This migration implements:
-- 1. Helper functions for RLS
-- 2. Updated RLS policies with proper restrictions
-- 3. Immutability triggers for rental_requests and rentals
-- 4. Storage policies with ownership validation
-- 5. Audit trail table
--
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================================

-- ============================================================================
-- PART 1: HELPER FUNCTIONS
-- ============================================================================

-- 1.1 Safe UUID cast (handles invalid text gracefully)
CREATE OR REPLACE FUNCTION public.safe_uuid(p_text TEXT)
RETURNS UUID AS $$
BEGIN
    IF p_text IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN p_text::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1.2 Check if user owns an item
CREATE OR REPLACE FUNCTION public.is_item_owner(p_item_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_item_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.items 
        WHERE id = p_item_id AND owner_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1.3 Check if user is participant in a rental
CREATE OR REPLACE FUNCTION public.is_rental_participant(p_rental_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_rental_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.rentals 
        WHERE id = p_rental_id 
        AND (owner_id = p_user_id OR renter_id = p_user_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1.4 Check if user is participant in a rental request
CREATE OR REPLACE FUNCTION public.is_rental_request_participant(p_request_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_request_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.rental_requests 
        WHERE id = p_request_id 
        AND (owner_id = p_user_id OR renter_id = p_user_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1.5 Check if user is participant in a conversation (TEXT email version)
CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conv_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_email TEXT;
BEGIN
    IF p_conv_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get user's email from auth.users
    SELECT email INTO v_user_email
    FROM auth.users WHERE id = p_user_id;
    
    IF v_user_email IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN EXISTS (
        SELECT 1 FROM public.conversations 
        WHERE id = p_conv_id 
        AND (owner_id = v_user_email OR renter_id = v_user_email)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1.6 Get current user's email (for TEXT-based tables)
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT AS $$
BEGIN
    RETURN (auth.jwt() ->> 'email');
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 2: VIEW FOR PUBLIC ITEMS (Without PII)
-- ============================================================================

-- Drop existing view if any
DROP VIEW IF EXISTS public.items_public CASCADE;

-- Create public view that excludes owner_contact (PII)
CREATE VIEW public.items_public AS
SELECT 
    id,
    title,
    description,
    price_day,
    city,
    category,
    image_url,
    owner_id,
    owner_name,
    created_at,
    image_migrated_at
FROM public.items;

-- Grant access to the view
GRANT SELECT ON public.items_public TO anon, authenticated;

-- ============================================================================
-- PART 3: RENTAL REQUESTS - UPDATE POLICY + IMMUTABILITY
-- ============================================================================

-- Drop existing policies that we'll replace
DROP POLICY IF EXISTS rental_requests_update ON public.rental_requests;
DROP POLICY IF EXISTS rental_requests_update_owner ON public.rental_requests;
DROP POLICY IF EXISTS rental_requests_update_renter ON public.rental_requests;

-- 3.1 UPDATE policy for rental_requests
-- Owner can accept/reject, Renter can cancel
CREATE POLICY rental_requests_update ON public.rental_requests
    FOR UPDATE
    USING (
        auth.uid() = owner_id OR auth.uid() = renter_id
    )
    WITH CHECK (
        auth.uid() = owner_id OR auth.uid() = renter_id
    );

-- 3.2 Trigger to enforce status transitions and immutability
CREATE OR REPLACE FUNCTION public.enforce_rental_request_rules()
RETURNS TRIGGER AS $$
BEGIN
    -- =========================================
    -- IMMUTABILITY: Block changes to core fields
    -- =========================================
    IF OLD.item_id IS DISTINCT FROM NEW.item_id THEN
        RAISE EXCEPTION 'Cannot change item_id after creation';
    END IF;
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
        RAISE EXCEPTION 'Cannot change owner_id after creation';
    END IF;
    IF OLD.renter_id IS DISTINCT FROM NEW.renter_id THEN
        RAISE EXCEPTION 'Cannot change renter_id after creation';
    END IF;
    IF OLD.start_date IS DISTINCT FROM NEW.start_date THEN
        RAISE EXCEPTION 'Cannot change start_date after creation';
    END IF;
    IF OLD.end_date IS DISTINCT FROM NEW.end_date THEN
        RAISE EXCEPTION 'Cannot change end_date after creation';
    END IF;
    IF OLD.daily_price IS DISTINCT FROM NEW.daily_price THEN
        RAISE EXCEPTION 'Cannot change daily_price after creation';
    END IF;
    IF OLD.days_count IS DISTINCT FROM NEW.days_count THEN
        RAISE EXCEPTION 'Cannot change days_count after creation';
    END IF;
    IF OLD.deposit_amount IS DISTINCT FROM NEW.deposit_amount THEN
        RAISE EXCEPTION 'Cannot change deposit_amount after creation';
    END IF;
    IF OLD.service_fee IS DISTINCT FROM NEW.service_fee THEN
        RAISE EXCEPTION 'Cannot change service_fee after creation';
    END IF;
    IF OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN
        RAISE EXCEPTION 'Cannot change total_amount after creation';
    END IF;
    IF OLD.currency IS DISTINCT FROM NEW.currency THEN
        RAISE EXCEPTION 'Cannot change currency after creation';
    END IF;
    
    -- =========================================
    -- STATUS TRANSITIONS
    -- =========================================
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Must be pending to change status
        IF OLD.status != 'pending' THEN
            RAISE EXCEPTION 'Can only change status from pending state. Current: %', OLD.status;
        END IF;
        
        -- Validate who can do what
        IF auth.uid() = OLD.owner_id THEN
            -- Owner can accept or reject
            IF NEW.status NOT IN ('accepted', 'rejected') THEN
                RAISE EXCEPTION 'Owner can only accept or reject requests';
            END IF;
        ELSIF auth.uid() = OLD.renter_id THEN
            -- Renter can only cancel
            IF NEW.status != 'cancelled' THEN
                RAISE EXCEPTION 'Renter can only cancel requests';
            END IF;
        ELSE
            -- Unknown user (should be blocked by RLS, but extra safety)
            RAISE EXCEPTION 'Not authorized to change request status';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_enforce_rental_request_rules ON public.rental_requests;

-- Create the trigger
CREATE TRIGGER trg_enforce_rental_request_rules
    BEFORE UPDATE ON public.rental_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_rental_request_rules();

-- ============================================================================
-- PART 4: RENTALS - UPDATE POLICY + IMMUTABILITY
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS rentals_update ON public.rentals;
DROP POLICY IF EXISTS rentals_update_owner ON public.rentals;

-- 4.1 UPDATE policy for rentals (owner only)
CREATE POLICY rentals_update ON public.rentals
    FOR UPDATE
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- 4.2 Trigger to enforce status transitions and immutability
CREATE OR REPLACE FUNCTION public.enforce_rental_rules()
RETURNS TRIGGER AS $$
BEGIN
    -- =========================================
    -- IMMUTABILITY: Block changes to core fields
    -- =========================================
    IF OLD.request_id IS DISTINCT FROM NEW.request_id THEN
        RAISE EXCEPTION 'Cannot change request_id after creation';
    END IF;
    IF OLD.item_id IS DISTINCT FROM NEW.item_id THEN
        RAISE EXCEPTION 'Cannot change item_id after creation';
    END IF;
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
        RAISE EXCEPTION 'Cannot change owner_id after creation';
    END IF;
    IF OLD.renter_id IS DISTINCT FROM NEW.renter_id THEN
        RAISE EXCEPTION 'Cannot change renter_id after creation';
    END IF;
    IF OLD.start_date IS DISTINCT FROM NEW.start_date THEN
        RAISE EXCEPTION 'Cannot change start_date after creation';
    END IF;
    IF OLD.end_date IS DISTINCT FROM NEW.end_date THEN
        RAISE EXCEPTION 'Cannot change end_date after creation';
    END IF;
    IF OLD.daily_price IS DISTINCT FROM NEW.daily_price THEN
        RAISE EXCEPTION 'Cannot change daily_price after creation';
    END IF;
    IF OLD.days_count IS DISTINCT FROM NEW.days_count THEN
        RAISE EXCEPTION 'Cannot change days_count after creation';
    END IF;
    IF OLD.deposit_amount IS DISTINCT FROM NEW.deposit_amount THEN
        RAISE EXCEPTION 'Cannot change deposit_amount after creation';
    END IF;
    IF OLD.service_fee IS DISTINCT FROM NEW.service_fee THEN
        RAISE EXCEPTION 'Cannot change service_fee after creation';
    END IF;
    IF OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN
        RAISE EXCEPTION 'Cannot change total_amount after creation';
    END IF;
    IF OLD.currency IS DISTINCT FROM NEW.currency THEN
        RAISE EXCEPTION 'Cannot change currency after creation';
    END IF;
    
    -- =========================================
    -- STATUS TRANSITIONS (owner only via RLS)
    -- =========================================
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Only owner can change status (enforced by RLS)
        -- Valid transitions from active
        IF OLD.status = 'active' THEN
            IF NEW.status NOT IN ('completed', 'cancelled') THEN
                RAISE EXCEPTION 'Active rental can only become completed or cancelled';
            END IF;
        ELSE
            -- Cannot change from terminal states
            RAISE EXCEPTION 'Cannot change status from terminal state: %', OLD.status;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_enforce_rental_rules ON public.rentals;

-- Create the trigger
CREATE TRIGGER trg_enforce_rental_rules
    BEFORE UPDATE ON public.rentals
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_rental_rules();

-- ============================================================================
-- PART 5: FIX NOTIFICATIONS INSERT POLICY
-- ============================================================================

-- Drop the permissive INSERT policy
DROP POLICY IF EXISTS notifications_insert ON public.notifications;

-- Notifications INSERT should ONLY happen via SECURITY DEFINER functions
-- No direct client access allowed
-- (The function create_notification will be used instead)

-- Create the secure insert function
CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id TEXT,
    p_type TEXT,
    p_conversation_id UUID DEFAULT NULL,
    p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO public.notifications (
        user_id,
        type,
        conversation_id,
        payload
    ) VALUES (
        p_user_id,
        p_type,
        p_conversation_id,
        p_payload
    )
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute only to authenticated (for internal use) and service role
GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;

-- ============================================================================
-- PART 6: LEGACY REQUESTS TABLE - LOCK DOWN
-- ============================================================================

-- Enable RLS if not already
ALTER TABLE IF EXISTS public.requests ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS requests_select ON public.requests;
DROP POLICY IF EXISTS requests_insert ON public.requests;
DROP POLICY IF EXISTS requests_update ON public.requests;
DROP POLICY IF EXISTS requests_delete ON public.requests;

-- Block all direct access to legacy requests table
-- If you need to access it, use a SECURITY DEFINER function
CREATE POLICY requests_deny_all ON public.requests
    FOR ALL
    USING (false)
    WITH CHECK (false);

-- ============================================================================
-- PART 7: STORAGE POLICIES WITH OWNERSHIP VALIDATION
-- ============================================================================

-- First, drop the existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated upload items-public" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete items-public" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload booking-proof-private" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete booking-proof-private" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read booking-proof-private" ON storage.objects;
DROP POLICY IF EXISTS "Public read items-public" ON storage.objects;
DROP POLICY IF EXISTS "Owner upload items-public" ON storage.objects;
DROP POLICY IF EXISTS "Owner delete items-public" ON storage.objects;
DROP POLICY IF EXISTS "Participant read booking-proof-private" ON storage.objects;
DROP POLICY IF EXISTS "Participant upload booking-proof-private" ON storage.objects;
DROP POLICY IF EXISTS "Participant delete booking-proof-private" ON storage.objects;

-- 7.1 items-public: Upload only to owned items
CREATE POLICY "Owner upload items-public"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'items-public'
    AND public.is_item_owner(
        -- Extract item_id from path: items/{item_id}/...
        (string_to_array(name, '/'))[2]::UUID,
        auth.uid()
    )
);

-- 7.2 items-public: Delete only own item images
CREATE POLICY "Owner delete items-public"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'items-public'
    AND public.is_item_owner(
        (string_to_array(name, '/'))[2]::UUID,
        auth.uid()
    )
);

-- 7.3 booking-proof-private: Read only for rental participants
CREATE POLICY "Participant read booking-proof-private"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'booking-proof-private'
    AND public.is_rental_participant(
        -- Extract rental_id from path: rentals/{rental_id}/...
        (string_to_array(name, '/'))[2]::UUID,
        auth.uid()
    )
);

-- 7.4 booking-proof-private: Upload only for rental participants
CREATE POLICY "Participant upload booking-proof-private"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'booking-proof-private'
    AND public.is_rental_participant(
        (string_to_array(name, '/'))[2]::UUID,
        auth.uid()
    )
);

-- 7.5 booking-proof-private: Delete only for rental participants
CREATE POLICY "Participant delete booking-proof-private"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'booking-proof-private'
    AND public.is_rental_participant(
        (string_to_array(name, '/'))[2]::UUID,
        auth.uid()
    )
);

-- ============================================================================
-- PART 8: AUDIT EVENTS TABLE
-- ============================================================================

-- Create audit events table
CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event info
    event_type TEXT NOT NULL,           -- e.g., 'item.created', 'rental_request.accepted'
    actor_id UUID,                       -- User who performed the action (null for system)
    actor_email TEXT,                    -- Email at time of action (denormalized)
    
    -- Target info
    target_type TEXT,                    -- e.g., 'item', 'rental_request', 'rental'
    target_id UUID,                      -- ID of affected record
    
    -- Details
    payload JSONB DEFAULT '{}'::JSONB,   -- Additional context
    ip_address INET,                     -- Client IP (if available)
    user_agent TEXT,                     -- Client user agent
    
    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying
CREATE INDEX idx_audit_events_actor ON public.audit_events(actor_id);
CREATE INDEX idx_audit_events_target ON public.audit_events(target_type, target_id);
CREATE INDEX idx_audit_events_type ON public.audit_events(event_type);
CREATE INDEX idx_audit_events_created ON public.audit_events(created_at DESC);

-- RLS: Only admins/service role can read audit events directly
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- No policies = deny all to regular users
-- Admin access via service role or explicit policy if needed

-- Function to log audit events (called from triggers or app)
CREATE OR REPLACE FUNCTION public.log_audit_event(
    p_event_type TEXT,
    p_target_type TEXT DEFAULT NULL,
    p_target_id UUID DEFAULT NULL,
    p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
    v_user_id UUID;
    v_user_email TEXT;
BEGIN
    -- Get current user info
    v_user_id := auth.uid();
    v_user_email := auth.jwt() ->> 'email';
    
    INSERT INTO public.audit_events (
        event_type,
        actor_id,
        actor_email,
        target_type,
        target_id,
        payload
    ) VALUES (
        p_event_type,
        v_user_id,
        v_user_email,
        p_target_type,
        p_target_id,
        p_payload
    )
    RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.log_audit_event TO authenticated;

-- ============================================================================
-- PART 9: AUDIT TRIGGERS FOR CRITICAL TABLES
-- ============================================================================

-- 9.1 Items audit trigger
CREATE OR REPLACE FUNCTION public.audit_items_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM public.log_audit_event(
            'item.created',
            'item',
            NEW.id,
            jsonb_build_object('title', NEW.title)
        );
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM public.log_audit_event(
            'item.updated',
            'item',
            NEW.id,
            jsonb_build_object('title', NEW.title)
        );
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM public.log_audit_event(
            'item.deleted',
            'item',
            OLD.id,
            jsonb_build_object('title', OLD.title)
        );
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_items ON public.items;
CREATE TRIGGER trg_audit_items
    AFTER INSERT OR UPDATE OR DELETE ON public.items
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_items_changes();

-- 9.2 Rental requests audit trigger
CREATE OR REPLACE FUNCTION public.audit_rental_requests_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM public.log_audit_event(
            'rental_request.created',
            'rental_request',
            NEW.id,
            jsonb_build_object('item_id', NEW.item_id, 'status', NEW.status)
        );
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            PERFORM public.log_audit_event(
                'rental_request.' || NEW.status,
                'rental_request',
                NEW.id,
                jsonb_build_object(
                    'item_id', NEW.item_id, 
                    'old_status', OLD.status, 
                    'new_status', NEW.status
                )
            );
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_rental_requests ON public.rental_requests;
CREATE TRIGGER trg_audit_rental_requests
    AFTER INSERT OR UPDATE ON public.rental_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_rental_requests_changes();

-- 9.3 Rentals audit trigger
CREATE OR REPLACE FUNCTION public.audit_rentals_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM public.log_audit_event(
            'rental.created',
            'rental',
            NEW.id,
            jsonb_build_object('item_id', NEW.item_id, 'status', NEW.status)
        );
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            PERFORM public.log_audit_event(
                'rental.' || NEW.status,
                'rental',
                NEW.id,
                jsonb_build_object(
                    'item_id', NEW.item_id,
                    'old_status', OLD.status,
                    'new_status', NEW.status
                )
            );
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_rentals ON public.rentals;
CREATE TRIGGER trg_audit_rentals
    AFTER INSERT OR UPDATE ON public.rentals
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_rentals_changes();

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================

-- Check all tables have RLS enabled
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename IN (
--     'items', 'item_images', 'rental_requests', 'rentals', 
--     'booking_media', 'conversations', 'messages', 'notifications',
--     'user_blocks', 'message_attachments', 'requests', 'audit_events'
-- );

-- List all policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT '✅ Security hardening migration completed successfully!' as status;
