-- ============================================================================
-- RATE LIMITING WITH SUPABASE
-- Buynt Marketplace
-- 
-- Since Buynt is a Vite SPA without a backend server, rate limiting must be
-- implemented at the Supabase level using RPC functions with rate tracking.
-- ============================================================================

-- ============================================================================
-- PART 1: RATE LIMIT TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    action_type TEXT NOT NULL,           -- 'message', 'rental_request', 'upload'
    window_start TIMESTAMPTZ NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    
    -- Unique constraint per user/action/window
    UNIQUE(user_id, action_type, window_start)
);

-- Index for cleanup
CREATE INDEX idx_rate_limits_window ON public.rate_limits(window_start);

-- RLS: Users can only see their own rate limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY rate_limits_select ON public.rate_limits
    FOR SELECT USING (user_id = auth.uid());

-- ============================================================================
-- PART 2: RATE LIMIT CHECKER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_action_type TEXT,
    p_max_count INTEGER,
    p_window_minutes INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_window_start TIMESTAMPTZ;
    v_current_count INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        -- Anonymous users: stricter limits or deny
        RETURN FALSE;
    END IF;
    
    -- Calculate current window start (rounded to window_minutes)
    v_window_start := date_trunc('minute', NOW()) - 
        (EXTRACT(minute FROM NOW())::INTEGER % p_window_minutes) * INTERVAL '1 minute';
    
    -- Get or create rate limit record
    INSERT INTO public.rate_limits (user_id, action_type, window_start, count)
    VALUES (v_user_id, p_action_type, v_window_start, 1)
    ON CONFLICT (user_id, action_type, window_start)
    DO UPDATE SET count = public.rate_limits.count + 1
    RETURNING count INTO v_current_count;
    
    -- Check if over limit
    IF v_current_count > p_max_count THEN
        RETURN FALSE;  -- Rate limited
    END IF;
    
    RETURN TRUE;  -- Allowed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_rate_limit TO authenticated;

-- ============================================================================
-- PART 3: CLEANUP OLD RATE LIMIT RECORDS (Run periodically)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM public.rate_limits
    WHERE window_start < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 4: RATE LIMITED MESSAGE SENDING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.send_message_rate_limited(
    p_conversation_id UUID,
    p_body TEXT
)
RETURNS UUID AS $$
DECLARE
    v_user_email TEXT;
    v_is_participant BOOLEAN;
    v_message_id UUID;
BEGIN
    -- Check rate limit: 20 messages per minute
    IF NOT public.check_rate_limit('message', 20, 1) THEN
        RAISE EXCEPTION 'rate_limit_exceeded'
            USING HINT = 'Has enviado demasiados mensajes. Espera un momento.';
    END IF;
    
    -- Verify participation
    IF NOT public.is_conversation_participant(p_conversation_id, auth.uid()) THEN
        RAISE EXCEPTION 'not_authorized'
            USING HINT = 'No eres participante de esta conversación';
    END IF;
    
    -- Get user email
    v_user_email := auth.jwt() ->> 'email';
    
    -- Insert message
    INSERT INTO public.messages (
        conversation_id,
        sender_id,
        body
    ) VALUES (
        p_conversation_id,
        v_user_email,
        p_body
    )
    RETURNING id INTO v_message_id;
    
    -- Update conversation timestamp
    UPDATE public.conversations
    SET updated_at = NOW()
    WHERE id = p_conversation_id;
    
    -- Log audit event
    PERFORM public.log_audit_event(
        'message.sent',
        'message',
        v_message_id,
        jsonb_build_object('conversation_id', p_conversation_id)
    );
    
    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.send_message_rate_limited TO authenticated;

-- ============================================================================
-- PART 5: UPDATE EXISTING RPC TO USE RATE LIMITS
-- ============================================================================

-- Update create_rental_request to check rate limit
-- (This modifies the existing function from rental_requests_system.sql)

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
    -- Rate limit: 10 requests per hour
    IF NOT public.check_rate_limit('rental_request', 10, 60) THEN
        RAISE EXCEPTION 'rate_limit_exceeded'
            USING HINT = 'Has enviado demasiadas solicitudes. Intenta de nuevo más tarde.';
    END IF;

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

-- ============================================================================
-- SUCCESS
-- ============================================================================

SELECT '✅ Rate limiting migration completed!' as status;
