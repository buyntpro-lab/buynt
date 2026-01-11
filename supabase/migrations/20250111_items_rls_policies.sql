-- ============================================================================
-- RLS POLICIES FOR ITEMS TABLE - Secure editing
-- FIXED: Comparison adjusted for TEXT owner_id with UUID values
-- Run in Supabase SQL Editor
-- ============================================================================

-- DIAGNOSTIC STEP 1: Check owner_id column type
-- SELECT column_name, data_type, udt_name
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='items' AND column_name='owner_id';

-- DIAGNOSTIC STEP 2: List existing policies (before dropping)
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname='public' AND tablename='items'
-- ORDER BY policyname;

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

-- Enable RLS on items table (if not already enabled)
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DROP EXISTING POLICIES (if any)
-- ============================================================================

DROP POLICY IF EXISTS items_select ON public.items;
DROP POLICY IF EXISTS items_insert ON public.items;
DROP POLICY IF EXISTS items_update ON public.items;
DROP POLICY IF EXISTS items_delete ON public.items;

-- ============================================================================
-- CREATE NEW POLICIES
-- ============================================================================

-- SELECT: Public marketplace - anyone can view items
CREATE POLICY items_select ON public.items
  FOR SELECT USING (true);

-- INSERT: Only authenticated users can create items
-- owner_id must be the current user's UUID
CREATE POLICY items_insert ON public.items
  FOR INSERT WITH CHECK (
    owner_id = auth.uid()
  );

-- UPDATE: Only the owner can edit their items
-- Compares UUID owner_id with auth.uid() (both UUID type)
CREATE POLICY items_update ON public.items
  FOR UPDATE USING (
    owner_id = auth.uid()
  ) WITH CHECK (
    owner_id = auth.uid()
  );

-- DELETE: Only the owner can delete their items
CREATE POLICY items_delete ON public.items
  FOR DELETE USING (
    owner_id = auth.uid()
  );

-- ============================================================================
-- VERIFICATION STEP 3: Verify policies are in place
-- ============================================================================

-- Run after applying to verify:
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname='public' AND tablename='items'
-- ORDER BY policyname;
