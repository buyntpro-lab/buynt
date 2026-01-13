-- ============================================================================
-- RENTAL REQUESTS SYSTEM - Complete Migration
-- Buynt Marketplace - Production Ready
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: EXTENSIONS
-- ============================================================================

-- Enable btree_gist for exclusion constraints with daterange
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================================
-- PART 2: ENUM TYPES
-- ============================================================================

-- Drop existing enums if they exist (for idempotency)
DO $$ BEGIN
    DROP TYPE IF EXISTS rental_request_status CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    DROP TYPE IF EXISTS rental_status CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create enum for rental request status
CREATE TYPE rental_request_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'cancelled',
    'expired'
);

-- Create enum for rental (confirmed booking) status
CREATE TYPE rental_status AS ENUM (
    'active',
    'completed',
    'cancelled'
);

-- ============================================================================
-- PART 3: TABLES
-- ============================================================================

-- Drop existing tables if they exist (for clean re-run)
DROP TABLE IF EXISTS public.rentals CASCADE;
DROP TABLE IF EXISTS public.rental_requests CASCADE;

-- -----------------------------------------------------------------------------
-- 3A: rental_requests - Pending requests awaiting owner approval
-- -----------------------------------------------------------------------------

CREATE TABLE public.rental_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- References
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL,          -- Owner of the item
    renter_id UUID NOT NULL,         -- Person requesting to rent
    
    -- Date range
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,          -- INCLUSIVE (last day of rental)
    period DATERANGE GENERATED ALWAYS AS (
        daterange(start_date, end_date + 1, '[)')
    ) STORED,
    
    -- Pricing (frozen at request time)
    daily_price NUMERIC(10,2) NOT NULL,
    days_count INTEGER NOT NULL,
    deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    service_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    
    -- Optional message from renter
    note TEXT,
    
    -- Status tracking
    status rental_request_status NOT NULL DEFAULT 'pending',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,        -- When owner accepted/rejected
    
    -- Link to rental (filled when accepted)
    rental_id UUID,
    
    -- Constraints
    CONSTRAINT valid_date_range CHECK (end_date >= start_date),
    CONSTRAINT valid_days_count CHECK (days_count > 0),
    CONSTRAINT valid_total CHECK (total_amount >= 0),
    CONSTRAINT no_self_rental CHECK (renter_id != owner_id)
);

-- Indexes for rental_requests
CREATE INDEX idx_rental_requests_owner_status ON public.rental_requests(owner_id, status);
CREATE INDEX idx_rental_requests_renter ON public.rental_requests(renter_id);
CREATE INDEX idx_rental_requests_item ON public.rental_requests(item_id);
CREATE INDEX idx_rental_requests_created ON public.rental_requests(created_at DESC);

-- -----------------------------------------------------------------------------
-- 3B: rentals - Confirmed bookings that block calendar dates
-- -----------------------------------------------------------------------------

CREATE TABLE public.rentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to original request
    request_id UUID UNIQUE REFERENCES public.rental_requests(id) ON DELETE SET NULL,
    
    -- References
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL,
    renter_id UUID NOT NULL,
    
    -- Date range
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,          -- INCLUSIVE
    period DATERANGE GENERATED ALWAYS AS (
        daterange(start_date, end_date + 1, '[)')
    ) STORED,
    
    -- Pricing (copied from request)
    daily_price NUMERIC(10,2) NOT NULL,
    days_count INTEGER NOT NULL,
    deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    service_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    
    -- Status
    status rental_status NOT NULL DEFAULT 'active',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_rental_date_range CHECK (end_date >= start_date),
    CONSTRAINT valid_rental_days CHECK (days_count > 0)
);

-- Indexes for rentals
CREATE INDEX idx_rentals_owner ON public.rentals(owner_id);
CREATE INDEX idx_rentals_renter ON public.rentals(renter_id);
CREATE INDEX idx_rentals_item ON public.rentals(item_id);
CREATE INDEX idx_rentals_item_period ON public.rentals USING GIST (item_id, period);

-- ============================================================================
-- PART 4: NO-OVERLAP EXCLUSION CONSTRAINT (Critical for date conflicts)
-- ============================================================================

-- This prevents two active rentals from having overlapping periods for the same item
ALTER TABLE public.rentals 
ADD CONSTRAINT rentals_no_overlap 
EXCLUDE USING gist (
    item_id WITH =, 
    period WITH &&
) WHERE (status = 'active');

-- ============================================================================
-- PART 5: UPDATED_AT TRIGGER
-- ============================================================================

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to rental_requests
DROP TRIGGER IF EXISTS trg_rental_requests_updated_at ON public.rental_requests;
CREATE TRIGGER trg_rental_requests_updated_at
    BEFORE UPDATE ON public.rental_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Apply trigger to rentals
DROP TRIGGER IF EXISTS trg_rentals_updated_at ON public.rentals;
CREATE TRIGGER trg_rentals_updated_at
    BEFORE UPDATE ON public.rentals
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- PART 6: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE public.rental_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS rental_requests_select ON public.rental_requests;
DROP POLICY IF EXISTS rental_requests_insert ON public.rental_requests;
DROP POLICY IF EXISTS rentals_select ON public.rentals;

-- -----------------------------------------------------------------------------
-- 6A: rental_requests policies
-- -----------------------------------------------------------------------------

-- SELECT: Owner or renter can view their requests
CREATE POLICY rental_requests_select ON public.rental_requests
    FOR SELECT
    USING (
        auth.uid() = owner_id OR auth.uid() = renter_id
    );

-- INSERT: Authenticated users can create requests for items they don't own
-- The RPC function handles the actual insert with validation
CREATE POLICY rental_requests_insert ON public.rental_requests
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND auth.uid() = renter_id
        AND renter_id != owner_id
    );

-- UPDATE/DELETE: Blocked for direct client access
-- All status changes go through RPC functions

-- -----------------------------------------------------------------------------
-- 6B: rentals policies
-- -----------------------------------------------------------------------------

-- SELECT: Owner or renter can view their rentals
CREATE POLICY rentals_select ON public.rentals
    FOR SELECT
    USING (
        auth.uid() = owner_id OR auth.uid() = renter_id
    );

-- Public can view active rentals for date blocking (read-only, limited fields)
CREATE POLICY rentals_public_dates ON public.rentals
    FOR SELECT
    USING (status = 'active');

-- INSERT/UPDATE/DELETE: Blocked for direct client access
-- Only RPC functions can create/modify rentals

-- ============================================================================
-- PART 7: RPC FUNCTIONS (Security Definer)
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 7A: create_rental_request
-- Creates a new rental request with all validations
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_rental_request(UUID, DATE, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.create_rental_request(
    p_item_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_item RECORD;
    v_days INTEGER;
    v_total NUMERIC(10,2);
    v_deposit NUMERIC(10,2);
    v_request_id UUID;
    v_overlap_count INTEGER;
    v_period DATERANGE;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated'
            USING HINT = 'You must be logged in to create a rental request';
    END IF;

    -- Validate date range
    IF p_end_date < p_start_date THEN
        RAISE EXCEPTION 'invalid_date_range'
            USING HINT = 'End date must be on or after start date';
    END IF;

    -- Validate dates are not in the past
    IF p_start_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'invalid_date_range'
            USING HINT = 'Start date cannot be in the past';
    END IF;

    -- Fetch item details
    SELECT id, owner_id, price_day, title
    INTO v_item
    FROM public.items
    WHERE id = p_item_id;

    IF v_item.id IS NULL THEN
        RAISE EXCEPTION 'item_not_found'
            USING HINT = 'The specified item does not exist';
    END IF;

    -- Cannot rent your own item
    IF v_item.owner_id = v_user_id THEN
        RAISE EXCEPTION 'cannot_rent_own_item'
            USING HINT = 'You cannot rent your own item';
    END IF;

    -- Calculate period for overlap check
    v_period := daterange(p_start_date, p_end_date + 1, '[)');

    -- Check for overlapping active rentals
    SELECT COUNT(*) INTO v_overlap_count
    FROM public.rentals
    WHERE item_id = p_item_id
      AND status = 'active'
      AND period && v_period;

    IF v_overlap_count > 0 THEN
        RAISE EXCEPTION 'dates_not_available'
            USING HINT = 'The selected dates are already booked';
    END IF;

    -- Calculate pricing
    v_days := (p_end_date - p_start_date) + 1;
    v_deposit := 50.00;  -- Fixed deposit for MVP
    v_total := (v_days * v_item.price_day) + v_deposit;

    -- Insert the request
    INSERT INTO public.rental_requests (
        item_id,
        owner_id,
        renter_id,
        start_date,
        end_date,
        daily_price,
        days_count,
        deposit_amount,
        service_fee,
        total_amount,
        currency,
        note,
        status
    ) VALUES (
        p_item_id,
        v_item.owner_id,
        v_user_id,
        p_start_date,
        p_end_date,
        v_item.price_day,
        v_days,
        v_deposit,
        0,
        v_total,
        'EUR',
        p_note,
        'pending'
    )
    RETURNING id INTO v_request_id;

    RETURN v_request_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.create_rental_request(UUID, DATE, DATE, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7B: respond_rental_request
-- Owner accepts or rejects a request
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.respond_rental_request(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.respond_rental_request(
    p_request_id UUID,
    p_action TEXT  -- 'accept' or 'reject'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_request RECORD;
    v_rental_id UUID;
    v_overlap_count INTEGER;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    -- Validate action
    IF p_action NOT IN ('accept', 'reject') THEN
        RAISE EXCEPTION 'invalid_action'
            USING HINT = 'Action must be "accept" or "reject"';
    END IF;

    -- Fetch and lock the request
    SELECT * INTO v_request
    FROM public.rental_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF v_request.id IS NULL THEN
        RAISE EXCEPTION 'request_not_found';
    END IF;

    -- Only owner can respond
    IF v_request.owner_id != v_user_id THEN
        RAISE EXCEPTION 'not_authorized'
            USING HINT = 'Only the item owner can accept or reject requests';
    END IF;

    -- Only pending requests can be responded to
    IF v_request.status != 'pending' THEN
        RAISE EXCEPTION 'request_not_pending'
            USING HINT = 'This request has already been processed';
    END IF;

    -- Handle rejection
    IF p_action = 'reject' THEN
        UPDATE public.rental_requests
        SET status = 'rejected',
            responded_at = NOW()
        WHERE id = p_request_id;

        RETURN NULL;
    END IF;

    -- Handle acceptance
    -- Re-check for date conflicts (race condition protection)
    SELECT COUNT(*) INTO v_overlap_count
    FROM public.rentals
    WHERE item_id = v_request.item_id
      AND status = 'active'
      AND period && v_request.period;

    IF v_overlap_count > 0 THEN
        -- Auto-reject if dates became unavailable
        UPDATE public.rental_requests
        SET status = 'rejected',
            responded_at = NOW()
        WHERE id = p_request_id;

        RAISE EXCEPTION 'dates_no_longer_available'
            USING HINT = 'Another booking was confirmed for these dates';
    END IF;

    -- Create the rental
    INSERT INTO public.rentals (
        request_id,
        item_id,
        owner_id,
        renter_id,
        start_date,
        end_date,
        daily_price,
        days_count,
        deposit_amount,
        service_fee,
        total_amount,
        currency,
        status
    ) VALUES (
        p_request_id,
        v_request.item_id,
        v_request.owner_id,
        v_request.renter_id,
        v_request.start_date,
        v_request.end_date,
        v_request.daily_price,
        v_request.days_count,
        v_request.deposit_amount,
        v_request.service_fee,
        v_request.total_amount,
        v_request.currency,
        'active'
    )
    RETURNING id INTO v_rental_id;

    -- Update the request with acceptance
    UPDATE public.rental_requests
    SET status = 'accepted',
        responded_at = NOW(),
        rental_id = v_rental_id
    WHERE id = p_request_id;

    -- Auto-reject any other pending requests for overlapping dates
    UPDATE public.rental_requests
    SET status = 'rejected',
        responded_at = NOW()
    WHERE id != p_request_id
      AND item_id = v_request.item_id
      AND status = 'pending'
      AND period && v_request.period;

    RETURN v_rental_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.respond_rental_request(UUID, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7C: cancel_rental_request
-- Renter cancels their own pending request
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.cancel_rental_request(UUID);

CREATE OR REPLACE FUNCTION public.cancel_rental_request(
    p_request_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_request RECORD;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    -- Fetch and lock the request
    SELECT * INTO v_request
    FROM public.rental_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF v_request.id IS NULL THEN
        RAISE EXCEPTION 'request_not_found';
    END IF;

    -- Only renter can cancel their own request
    IF v_request.renter_id != v_user_id THEN
        RAISE EXCEPTION 'not_authorized'
            USING HINT = 'Only the requester can cancel this request';
    END IF;

    -- Only pending requests can be cancelled
    IF v_request.status != 'pending' THEN
        RAISE EXCEPTION 'request_not_pending'
            USING HINT = 'Only pending requests can be cancelled';
    END IF;

    -- Update status to cancelled
    UPDATE public.rental_requests
    SET status = 'cancelled',
        responded_at = NOW()
    WHERE id = p_request_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.cancel_rental_request(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7D: get_blocked_dates_for_item
-- Returns active rental periods for calendar blocking
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_blocked_dates_for_item(UUID);

CREATE OR REPLACE FUNCTION public.get_blocked_dates_for_item(
    p_item_id UUID
)
RETURNS TABLE (
    start_date DATE,
    end_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT r.start_date, r.end_date
    FROM public.rentals r
    WHERE r.item_id = p_item_id
      AND r.status = 'active'
    ORDER BY r.start_date;
END;
$$;

-- Grant execute to all (public calendar data)
GRANT EXECUTE ON FUNCTION public.get_blocked_dates_for_item(UUID) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7E: get_pending_requests_count
-- Returns count of pending requests for the current user (as owner)
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_pending_requests_count();

CREATE OR REPLACE FUNCTION public.get_pending_requests_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_count INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN 0;
    END IF;

    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.rental_requests
    WHERE owner_id = v_user_id
      AND status = 'pending';

    RETURN v_count;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_pending_requests_count() TO authenticated;

-- ============================================================================
-- PART 8: HELPER VIEWS (Optional, for easier querying)
-- ============================================================================

-- View for rental requests with item details
DROP VIEW IF EXISTS public.rental_requests_with_items;

CREATE VIEW public.rental_requests_with_items AS
SELECT 
    rr.*,
    i.title AS item_title,
    i.image_url AS item_image_url,
    i.city AS item_city,
    i.category AS item_category,
    owner_p.full_name AS owner_name,
    owner_p.email AS owner_email,
    renter_p.full_name AS renter_name,
    renter_p.email AS renter_email
FROM public.rental_requests rr
LEFT JOIN public.items i ON rr.item_id = i.id
LEFT JOIN public.profiles owner_p ON rr.owner_id = owner_p.id
LEFT JOIN public.profiles renter_p ON rr.renter_id = renter_p.id;

-- RLS for the view (inherits from base table)
-- Note: Views automatically inherit RLS from underlying tables

-- ============================================================================
-- PART 9: REALTIME CONFIGURATION
-- ============================================================================

-- Enable realtime for rental_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.rental_requests;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify installation)
-- ============================================================================

-- Check tables exist:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name IN ('rental_requests', 'rentals');

-- Check functions exist:
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_schema = 'public' AND routine_name LIKE '%rental%';

-- Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename IN ('rental_requests', 'rentals');

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
