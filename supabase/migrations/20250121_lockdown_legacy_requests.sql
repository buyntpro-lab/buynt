-- ============================================================================
-- CONSOLIDATION A: Lock Down Legacy requests Table
-- ============================================================================
-- Date: 2025-01-21
-- Purpose: Deny all access to legacy `requests` table after consolidation
-- 
-- BACKGROUND:
-- The old `requests` table was used before the rental_requests/rentals system.
-- All request flow now uses:
--   - rental_requests table (via create_rental_request, respond_rental_request RPCs)
--   - rentals table (created when request is accepted)
--   - rental_requests_with_items view (for reading with joined data)
--
-- This migration locks down the legacy table to prevent accidental use.
-- ============================================================================

-- Enable RLS on requests table if not already enabled
ALTER TABLE IF EXISTS requests ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies on requests table
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'requests' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON requests', pol.policyname);
    END LOOP;
END $$;

-- Create deny-all policy
-- This prevents any SELECT, INSERT, UPDATE, DELETE operations
CREATE POLICY "LEGACY_LOCKED_deny_all_access" ON requests
    FOR ALL 
    USING (false)
    WITH CHECK (false);

-- Add comment explaining the lockdown
COMMENT ON TABLE requests IS 
    'DEPRECATED: Legacy requests table locked down on 2025-01-21. '
    'Use rental_requests table and rentalRequestsService instead. '
    'See docs/consolidation_A.md for migration details.';

-- ============================================================================
-- VERIFICATION QUERY (run manually to confirm)
-- ============================================================================
-- SELECT 
--     schemaname, 
--     tablename, 
--     policyname, 
--     permissive, 
--     roles, 
--     cmd, 
--     qual 
-- FROM pg_policies 
-- WHERE tablename = 'requests';
--
-- Expected result: One policy named "LEGACY_LOCKED_deny_all_access" 
-- with cmd = 'ALL' and qual = 'false'
-- ============================================================================
