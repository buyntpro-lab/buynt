-- ============================================================================
-- TIMELINE & DISPUTES SYSTEM - Complete Migration
-- Buynt Marketplace
-- Date: 2026-01-21
--
-- This migration implements:
-- 1. rental_events table for timeline tracking
-- 2. disputes + dispute_messages tables for dispute handling
-- 3. RLS policies using existing is_rental_participant()
-- 4. RPCs for all business logic
-- 5. Triggers for automatic event creation
--
-- IMPORTANT: Run this AFTER all previous migrations have been applied
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE TABLES
-- ============================================================================

-- 1.1 rental_events - Timeline events for each rental
CREATE TABLE IF NOT EXISTS public.rental_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id UUID NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'RENTAL_CREATED',
        'HANDOFF_PHOTOS_UPLOADED',
        'HANDOFF_CONFIRMED',
        'RETURN_PHOTOS_UPLOADED',
        'RETURN_CONFIRMED',
        'RENTAL_COMPLETED',
        'RENTAL_CANCELLED',
        'DISPUTE_OPENED',
        'DISPUTE_RESOLVED'
    )),
    actor_id UUID REFERENCES auth.users(id),
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for rental_events
CREATE INDEX IF NOT EXISTS idx_rental_events_rental_id_created_at 
    ON public.rental_events(rental_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rental_events_event_type 
    ON public.rental_events(event_type);

-- 1.2 disputes - Dispute cases
CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id UUID NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
    opened_by UUID NOT NULL REFERENCES auth.users(id),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_note TEXT
);

-- Indexes for disputes
CREATE INDEX IF NOT EXISTS idx_disputes_rental_id ON public.disputes(rental_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_opened_by ON public.disputes(opened_by);

-- 1.3 dispute_messages - Messages within a dispute
CREATE TABLE IF NOT EXISTS public.dispute_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for dispute_messages
CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute_id ON public.dispute_messages(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_created_at ON public.dispute_messages(dispute_id, created_at ASC);

-- ============================================================================
-- PART 2: TRIGGERS FOR updated_at
-- ============================================================================

-- Apply existing set_updated_at trigger to disputes
DROP TRIGGER IF EXISTS trg_disputes_updated_at ON public.disputes;
CREATE TRIGGER trg_disputes_updated_at
    BEFORE UPDATE ON public.disputes
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- PART 3: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE public.rental_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3.1 rental_events policies
-- -----------------------------------------------------------------------------

-- SELECT: Only rental participants can view events
DROP POLICY IF EXISTS rental_events_select ON public.rental_events;
CREATE POLICY rental_events_select ON public.rental_events
    FOR SELECT
    USING (public.is_rental_participant(rental_id, auth.uid()));

-- INSERT: Only rental participants can insert (via RPC)
DROP POLICY IF EXISTS rental_events_insert ON public.rental_events;
CREATE POLICY rental_events_insert ON public.rental_events
    FOR INSERT
    WITH CHECK (
        public.is_rental_participant(rental_id, auth.uid())
        AND (actor_id IS NULL OR actor_id = auth.uid())
    );

-- UPDATE/DELETE: Denied - events are immutable
-- (No policies = denied by default with RLS enabled)

-- -----------------------------------------------------------------------------
-- 3.2 disputes policies
-- -----------------------------------------------------------------------------

-- SELECT: Only rental participants can view disputes
DROP POLICY IF EXISTS disputes_select ON public.disputes;
CREATE POLICY disputes_select ON public.disputes
    FOR SELECT
    USING (public.is_rental_participant(rental_id, auth.uid()));

-- INSERT: Only rental participants can open disputes
DROP POLICY IF EXISTS disputes_insert ON public.disputes;
CREATE POLICY disputes_insert ON public.disputes
    FOR INSERT
    WITH CHECK (
        public.is_rental_participant(rental_id, auth.uid())
        AND opened_by = auth.uid()
    );

-- UPDATE: Only rental participants can update (resolve)
DROP POLICY IF EXISTS disputes_update ON public.disputes;
CREATE POLICY disputes_update ON public.disputes
    FOR UPDATE
    USING (public.is_rental_participant(rental_id, auth.uid()))
    WITH CHECK (public.is_rental_participant(rental_id, auth.uid()));

-- DELETE: Denied - disputes are not deletable
-- (No policy = denied)

-- -----------------------------------------------------------------------------
-- 3.3 dispute_messages policies
-- -----------------------------------------------------------------------------

-- SELECT: Only rental participants can view messages
DROP POLICY IF EXISTS dispute_messages_select ON public.dispute_messages;
CREATE POLICY dispute_messages_select ON public.dispute_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.disputes d
            WHERE d.id = dispute_id
            AND public.is_rental_participant(d.rental_id, auth.uid())
        )
    );

-- INSERT: Only rental participants can send messages
DROP POLICY IF EXISTS dispute_messages_insert ON public.dispute_messages;
CREATE POLICY dispute_messages_insert ON public.dispute_messages
    FOR INSERT
    WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.disputes d
            WHERE d.id = dispute_id
            AND public.is_rental_participant(d.rental_id, auth.uid())
        )
    );

-- UPDATE/DELETE: Denied
-- (No policies = denied)

-- ============================================================================
-- PART 4: HELPER FUNCTION - Get other participant
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_other_rental_participant(
    p_rental_id UUID,
    p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_rental RECORD;
BEGIN
    SELECT owner_id, renter_id INTO v_rental
    FROM public.rentals WHERE id = p_rental_id;
    
    IF v_rental IS NULL THEN
        RETURN NULL;
    END IF;
    
    IF v_rental.owner_id = p_user_id THEN
        RETURN v_rental.renter_id;
    ELSE
        RETURN v_rental.owner_id;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- PART 5: RPCs FOR TIMELINE EVENTS
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 5.1 log_rental_event - Internal helper (called by other RPCs)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_rental_event(
    p_rental_id UUID,
    p_event_type TEXT,
    p_payload JSONB DEFAULT '{}'::JSONB,
    p_notify_other BOOLEAN DEFAULT TRUE
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_event_id UUID;
    v_other_user UUID;
    v_user_email TEXT;
BEGIN
    v_user_id := auth.uid();
    v_user_email := auth.jwt() ->> 'email';
    
    -- Validate participant
    IF NOT public.is_rental_participant(p_rental_id, v_user_id) THEN
        RAISE EXCEPTION 'not_authorized'
            USING HINT = 'Solo los participantes del alquiler pueden registrar eventos';
    END IF;
    
    -- Insert event
    INSERT INTO public.rental_events (rental_id, event_type, actor_id, payload)
    VALUES (p_rental_id, p_event_type, v_user_id, p_payload)
    RETURNING id INTO v_event_id;
    
    -- Log to audit_events
    PERFORM public.log_audit_event(
        'rental_event.' || p_event_type,
        'rental',
        p_rental_id,
        jsonb_build_object('event_id', v_event_id, 'payload', p_payload)
    );
    
    -- Notify other participant
    IF p_notify_other THEN
        v_other_user := public.get_other_rental_participant(p_rental_id, v_user_id);
        IF v_other_user IS NOT NULL THEN
            -- Get other user's email for notification
            PERFORM public.create_notification(
                (SELECT email FROM auth.users WHERE id = v_other_user),
                'rental_event',
                NULL,
                jsonb_build_object(
                    'rental_id', p_rental_id,
                    'event_type', p_event_type,
                    'actor_email', v_user_email
                )
            );
        END IF;
    END IF;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.log_rental_event TO authenticated;

-- -----------------------------------------------------------------------------
-- 5.2 mark_handoff_uploaded - Called after uploading handoff photos
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_handoff_uploaded(
    p_rental_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_photo_count INTEGER;
    v_event_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;
    
    -- Validate participant
    IF NOT public.is_rental_participant(p_rental_id, v_user_id) THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;
    
    -- Check that handoff photos exist
    SELECT COUNT(*) INTO v_photo_count
    FROM public.booking_media
    WHERE rental_id = p_rental_id AND type = 'handoff';
    
    IF v_photo_count = 0 THEN
        RAISE EXCEPTION 'no_photos'
            USING HINT = 'Debes subir al menos una foto de entrega';
    END IF;
    
    -- Check not already marked
    IF EXISTS (
        SELECT 1 FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'HANDOFF_PHOTOS_UPLOADED'
    ) THEN
        -- Already marked, return existing event
        SELECT id INTO v_event_id
        FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'HANDOFF_PHOTOS_UPLOADED'
        LIMIT 1;
        RETURN v_event_id;
    END IF;
    
    -- Log event
    v_event_id := public.log_rental_event(
        p_rental_id,
        'HANDOFF_PHOTOS_UPLOADED',
        jsonb_build_object('photo_count', v_photo_count, 'note', p_note)
    );
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.mark_handoff_uploaded TO authenticated;

-- -----------------------------------------------------------------------------
-- 5.3 confirm_handoff - Owner confirms handoff is complete
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_handoff(p_rental_id UUID)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_rental RECORD;
    v_event_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;
    
    -- Get rental
    SELECT * INTO v_rental FROM public.rentals WHERE id = p_rental_id;
    
    IF v_rental IS NULL THEN
        RAISE EXCEPTION 'rental_not_found';
    END IF;
    
    -- Only owner can confirm handoff
    IF v_rental.owner_id != v_user_id THEN
        RAISE EXCEPTION 'not_authorized'
            USING HINT = 'Solo el propietario puede confirmar la entrega';
    END IF;
    
    -- Check rental is active
    IF v_rental.status != 'active' THEN
        RAISE EXCEPTION 'rental_not_active'
            USING HINT = 'El alquiler no está activo';
    END IF;
    
    -- Check handoff photos were uploaded
    IF NOT EXISTS (
        SELECT 1 FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'HANDOFF_PHOTOS_UPLOADED'
    ) THEN
        -- Check if there are at least photos even without event
        IF NOT EXISTS (
            SELECT 1 FROM public.booking_media
            WHERE rental_id = p_rental_id AND type = 'handoff'
        ) THEN
            RAISE EXCEPTION 'no_handoff_photos'
                USING HINT = 'Primero deben subirse fotos de la entrega';
        END IF;
    END IF;
    
    -- Check not already confirmed
    IF EXISTS (
        SELECT 1 FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'HANDOFF_CONFIRMED'
    ) THEN
        SELECT id INTO v_event_id
        FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'HANDOFF_CONFIRMED'
        LIMIT 1;
        RETURN v_event_id;
    END IF;
    
    -- Log event
    v_event_id := public.log_rental_event(
        p_rental_id,
        'HANDOFF_CONFIRMED',
        '{}'::JSONB
    );
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.confirm_handoff TO authenticated;

-- -----------------------------------------------------------------------------
-- 5.4 mark_return_uploaded - Called after uploading return photos
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_return_uploaded(
    p_rental_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_photo_count INTEGER;
    v_event_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;
    
    -- Validate participant
    IF NOT public.is_rental_participant(p_rental_id, v_user_id) THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;
    
    -- Check that return photos exist
    SELECT COUNT(*) INTO v_photo_count
    FROM public.booking_media
    WHERE rental_id = p_rental_id AND type = 'return';
    
    IF v_photo_count = 0 THEN
        RAISE EXCEPTION 'no_photos'
            USING HINT = 'Debes subir al menos una foto de devolución';
    END IF;
    
    -- Check not already marked
    IF EXISTS (
        SELECT 1 FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'RETURN_PHOTOS_UPLOADED'
    ) THEN
        SELECT id INTO v_event_id
        FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'RETURN_PHOTOS_UPLOADED'
        LIMIT 1;
        RETURN v_event_id;
    END IF;
    
    -- Log event
    v_event_id := public.log_rental_event(
        p_rental_id,
        'RETURN_PHOTOS_UPLOADED',
        jsonb_build_object('photo_count', v_photo_count, 'note', p_note)
    );
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.mark_return_uploaded TO authenticated;

-- -----------------------------------------------------------------------------
-- 5.5 confirm_return - Owner confirms return is complete
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_return(p_rental_id UUID)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_rental RECORD;
    v_event_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;
    
    -- Get rental
    SELECT * INTO v_rental FROM public.rentals WHERE id = p_rental_id;
    
    IF v_rental IS NULL THEN
        RAISE EXCEPTION 'rental_not_found';
    END IF;
    
    -- Only owner can confirm return
    IF v_rental.owner_id != v_user_id THEN
        RAISE EXCEPTION 'not_authorized'
            USING HINT = 'Solo el propietario puede confirmar la devolución';
    END IF;
    
    -- Check rental is active
    IF v_rental.status != 'active' THEN
        RAISE EXCEPTION 'rental_not_active'
            USING HINT = 'El alquiler no está activo';
    END IF;
    
    -- Check return photos were uploaded
    IF NOT EXISTS (
        SELECT 1 FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'RETURN_PHOTOS_UPLOADED'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.booking_media
            WHERE rental_id = p_rental_id AND type = 'return'
        ) THEN
            RAISE EXCEPTION 'no_return_photos'
                USING HINT = 'Primero deben subirse fotos de la devolución';
        END IF;
    END IF;
    
    -- Check not already confirmed
    IF EXISTS (
        SELECT 1 FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'RETURN_CONFIRMED'
    ) THEN
        SELECT id INTO v_event_id
        FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'RETURN_CONFIRMED'
        LIMIT 1;
        RETURN v_event_id;
    END IF;
    
    -- Log event
    v_event_id := public.log_rental_event(
        p_rental_id,
        'RETURN_CONFIRMED',
        '{}'::JSONB
    );
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.confirm_return TO authenticated;

-- -----------------------------------------------------------------------------
-- 5.6 complete_rental - Owner marks rental as completed
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_rental(p_rental_id UUID)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_rental RECORD;
    v_event_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;
    
    -- Get rental
    SELECT * INTO v_rental FROM public.rentals WHERE id = p_rental_id;
    
    IF v_rental IS NULL THEN
        RAISE EXCEPTION 'rental_not_found';
    END IF;
    
    -- Only owner can complete
    IF v_rental.owner_id != v_user_id THEN
        RAISE EXCEPTION 'not_authorized'
            USING HINT = 'Solo el propietario puede completar el alquiler';
    END IF;
    
    -- Check rental is active
    IF v_rental.status != 'active' THEN
        RAISE EXCEPTION 'rental_not_active'
            USING HINT = 'El alquiler no está activo';
    END IF;
    
    -- Check return was confirmed
    IF NOT EXISTS (
        SELECT 1 FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'RETURN_CONFIRMED'
    ) THEN
        RAISE EXCEPTION 'return_not_confirmed'
            USING HINT = 'La devolución debe estar confirmada antes de completar';
    END IF;
    
    -- Check not already completed
    IF EXISTS (
        SELECT 1 FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'RENTAL_COMPLETED'
    ) THEN
        SELECT id INTO v_event_id
        FROM public.rental_events
        WHERE rental_id = p_rental_id AND event_type = 'RENTAL_COMPLETED'
        LIMIT 1;
        RETURN v_event_id;
    END IF;
    
    -- Update rental status
    UPDATE public.rentals
    SET status = 'completed'
    WHERE id = p_rental_id;
    
    -- Log event
    v_event_id := public.log_rental_event(
        p_rental_id,
        'RENTAL_COMPLETED',
        '{}'::JSONB
    );
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.complete_rental TO authenticated;

-- ============================================================================
-- PART 6: RPCs FOR DISPUTES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 6.1 open_dispute - Either party opens a dispute
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.open_dispute(
    p_rental_id UUID,
    p_reason TEXT
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_dispute_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;
    
    -- Validate participant
    IF NOT public.is_rental_participant(p_rental_id, v_user_id) THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;
    
    -- Rate limit
    IF NOT public.check_rate_limit('open_dispute', 5, 60) THEN
        RAISE EXCEPTION 'rate_limit_exceeded'
            USING HINT = 'Has abierto demasiadas disputas. Espera un momento.';
    END IF;
    
    -- Check no open dispute exists
    IF EXISTS (
        SELECT 1 FROM public.disputes
        WHERE rental_id = p_rental_id AND status = 'open'
    ) THEN
        RAISE EXCEPTION 'dispute_already_open'
            USING HINT = 'Ya existe una disputa abierta para este alquiler';
    END IF;
    
    -- Create dispute
    INSERT INTO public.disputes (rental_id, opened_by, reason)
    VALUES (p_rental_id, v_user_id, p_reason)
    RETURNING id INTO v_dispute_id;
    
    -- Log rental event
    PERFORM public.log_rental_event(
        p_rental_id,
        'DISPUTE_OPENED',
        jsonb_build_object('dispute_id', v_dispute_id, 'reason', p_reason)
    );
    
    RETURN v_dispute_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.open_dispute TO authenticated;

-- -----------------------------------------------------------------------------
-- 6.2 add_dispute_message - Add message to dispute
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.add_dispute_message(
    p_dispute_id UUID,
    p_body TEXT
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_dispute RECORD;
    v_message_id UUID;
    v_other_user UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;
    
    -- Get dispute
    SELECT * INTO v_dispute FROM public.disputes WHERE id = p_dispute_id;
    
    IF v_dispute IS NULL THEN
        RAISE EXCEPTION 'dispute_not_found';
    END IF;
    
    -- Validate participant
    IF NOT public.is_rental_participant(v_dispute.rental_id, v_user_id) THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;
    
    -- Check dispute is open
    IF v_dispute.status != 'open' THEN
        RAISE EXCEPTION 'dispute_not_open'
            USING HINT = 'Esta disputa ya está cerrada';
    END IF;
    
    -- Rate limit
    IF NOT public.check_rate_limit('dispute_message', 20, 1) THEN
        RAISE EXCEPTION 'rate_limit_exceeded'
            USING HINT = 'Has enviado demasiados mensajes. Espera un momento.';
    END IF;
    
    -- Insert message
    INSERT INTO public.dispute_messages (dispute_id, sender_id, body)
    VALUES (p_dispute_id, v_user_id, p_body)
    RETURNING id INTO v_message_id;
    
    -- Notify other participant
    v_other_user := public.get_other_rental_participant(v_dispute.rental_id, v_user_id);
    IF v_other_user IS NOT NULL THEN
        PERFORM public.create_notification(
            (SELECT email FROM auth.users WHERE id = v_other_user),
            'dispute_message',
            NULL,
            jsonb_build_object(
                'dispute_id', p_dispute_id,
                'rental_id', v_dispute.rental_id
            )
        );
    END IF;
    
    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.add_dispute_message TO authenticated;

-- -----------------------------------------------------------------------------
-- 6.3 resolve_dispute - Either party resolves the dispute
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_dispute(
    p_dispute_id UUID,
    p_resolution_note TEXT,
    p_new_status TEXT DEFAULT 'resolved'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_dispute RECORD;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;
    
    -- Validate status
    IF p_new_status NOT IN ('resolved', 'closed') THEN
        RAISE EXCEPTION 'invalid_status'
            USING HINT = 'El estado debe ser "resolved" o "closed"';
    END IF;
    
    -- Get dispute
    SELECT * INTO v_dispute FROM public.disputes WHERE id = p_dispute_id FOR UPDATE;
    
    IF v_dispute IS NULL THEN
        RAISE EXCEPTION 'dispute_not_found';
    END IF;
    
    -- Validate participant
    IF NOT public.is_rental_participant(v_dispute.rental_id, v_user_id) THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;
    
    -- Check dispute is open
    IF v_dispute.status != 'open' THEN
        RAISE EXCEPTION 'dispute_not_open'
            USING HINT = 'Esta disputa ya está cerrada';
    END IF;
    
    -- Update dispute
    UPDATE public.disputes
    SET status = p_new_status,
        resolved_at = NOW(),
        resolved_by = v_user_id,
        resolution_note = p_resolution_note
    WHERE id = p_dispute_id;
    
    -- Log rental event
    PERFORM public.log_rental_event(
        v_dispute.rental_id,
        'DISPUTE_RESOLVED',
        jsonb_build_object(
            'dispute_id', p_dispute_id,
            'resolution_note', p_resolution_note,
            'new_status', p_new_status
        )
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.resolve_dispute TO authenticated;

-- ============================================================================
-- PART 7: AUTO-CREATE RENTAL_CREATED EVENT (Trigger)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_create_rental_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert RENTAL_CREATED event
    INSERT INTO public.rental_events (rental_id, event_type, actor_id, payload)
    VALUES (
        NEW.id,
        'RENTAL_CREATED',
        NEW.renter_id,  -- The renter initiated the rental
        jsonb_build_object(
            'item_id', NEW.item_id,
            'start_date', NEW.start_date,
            'end_date', NEW.end_date,
            'total_amount', NEW.total_amount
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS trg_auto_create_rental_event ON public.rentals;
CREATE TRIGGER trg_auto_create_rental_event
    AFTER INSERT ON public.rentals
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_create_rental_event();

-- ============================================================================
-- PART 8: VIEW FOR RENTAL WITH EVENTS COUNT (Optional helper)
-- ============================================================================

CREATE OR REPLACE VIEW public.rentals_with_progress AS
SELECT 
    r.*,
    i.title AS item_title,
    i.image_url AS item_image_url,
    i.city AS item_city,
    owner_p.full_name AS owner_name,
    owner_p.email AS owner_email,
    renter_p.full_name AS renter_name,
    renter_p.email AS renter_email,
    -- Progress flags
    EXISTS (
        SELECT 1 FROM public.rental_events re 
        WHERE re.rental_id = r.id AND re.event_type = 'HANDOFF_PHOTOS_UPLOADED'
    ) AS handoff_uploaded,
    EXISTS (
        SELECT 1 FROM public.rental_events re 
        WHERE re.rental_id = r.id AND re.event_type = 'HANDOFF_CONFIRMED'
    ) AS handoff_confirmed,
    EXISTS (
        SELECT 1 FROM public.rental_events re 
        WHERE re.rental_id = r.id AND re.event_type = 'RETURN_PHOTOS_UPLOADED'
    ) AS return_uploaded,
    EXISTS (
        SELECT 1 FROM public.rental_events re 
        WHERE re.rental_id = r.id AND re.event_type = 'RETURN_CONFIRMED'
    ) AS return_confirmed,
    EXISTS (
        SELECT 1 FROM public.disputes d 
        WHERE d.rental_id = r.id AND d.status = 'open'
    ) AS has_open_dispute
FROM public.rentals r
LEFT JOIN public.items i ON r.item_id = i.id
LEFT JOIN public.profiles owner_p ON r.owner_id = owner_p.id
LEFT JOIN public.profiles renter_p ON r.renter_id = renter_p.id;

-- ============================================================================
-- PART 9: HELPER FUNCTION - Get rental events
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_rental_events(p_rental_id UUID)
RETURNS TABLE (
    id UUID,
    event_type TEXT,
    actor_id UUID,
    actor_email TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    -- Verify participant
    IF NOT public.is_rental_participant(p_rental_id, auth.uid()) THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;
    
    RETURN QUERY
    SELECT 
        re.id,
        re.event_type,
        re.actor_id,
        u.email AS actor_email,
        re.payload,
        re.created_at
    FROM public.rental_events re
    LEFT JOIN auth.users u ON re.actor_id = u.id
    WHERE re.rental_id = p_rental_id
    ORDER BY re.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_rental_events TO authenticated;

-- ============================================================================
-- PART 10: HELPER FUNCTION - Get dispute with messages
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_dispute_with_messages(p_dispute_id UUID)
RETURNS TABLE (
    dispute_id UUID,
    rental_id UUID,
    opened_by UUID,
    opener_email TEXT,
    reason TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    resolver_email TEXT,
    resolution_note TEXT,
    messages JSONB
) AS $$
DECLARE
    v_dispute RECORD;
BEGIN
    -- Get dispute
    SELECT * INTO v_dispute FROM public.disputes WHERE id = p_dispute_id;
    
    IF v_dispute IS NULL THEN
        RAISE EXCEPTION 'dispute_not_found';
    END IF;
    
    -- Verify participant
    IF NOT public.is_rental_participant(v_dispute.rental_id, auth.uid()) THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;
    
    RETURN QUERY
    SELECT 
        d.id AS dispute_id,
        d.rental_id,
        d.opened_by,
        opener.email AS opener_email,
        d.reason,
        d.status,
        d.created_at,
        d.resolved_at,
        d.resolved_by,
        resolver.email AS resolver_email,
        d.resolution_note,
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'id', dm.id,
                    'sender_id', dm.sender_id,
                    'sender_email', s.email,
                    'body', dm.body,
                    'created_at', dm.created_at
                ) ORDER BY dm.created_at ASC
            )
            FROM public.dispute_messages dm
            LEFT JOIN auth.users s ON dm.sender_id = s.id
            WHERE dm.dispute_id = d.id),
            '[]'::JSONB
        ) AS messages
    FROM public.disputes d
    LEFT JOIN auth.users opener ON d.opened_by = opener.id
    LEFT JOIN auth.users resolver ON d.resolved_by = resolver.id
    WHERE d.id = p_dispute_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_dispute_with_messages TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================

/*
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('rental_events', 'disputes', 'dispute_messages');

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('rental_events', 'disputes', 'dispute_messages');

-- Check functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'log_rental_event', 
    'mark_handoff_uploaded', 
    'confirm_handoff',
    'mark_return_uploaded',
    'confirm_return',
    'complete_rental',
    'open_dispute',
    'add_dispute_message',
    'resolve_dispute',
    'get_rental_events',
    'get_dispute_with_messages'
);

-- Check policies
SELECT tablename, policyname, cmd FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('rental_events', 'disputes', 'dispute_messages');

-- Test: Check a rental has RENTAL_CREATED event after being created
-- (This should show events for any existing rental after trigger is applied)
SELECT r.id, r.status, 
       (SELECT COUNT(*) FROM rental_events WHERE rental_id = r.id) as event_count
FROM rentals r
LIMIT 5;
*/

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT '✅ Timeline & Disputes migration completed successfully!' as status;
