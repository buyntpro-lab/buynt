-- ============================================================================
-- EXPORT COMPLETE SUPABASE SCHEMA
-- Execute in Supabase SQL Editor and copy ALL results
-- ============================================================================

-- PART 1: TABLES AND COLUMNS
SELECT 
    '=== TABLES AND COLUMNS ===' as info,
    table_schema,
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- PART 2: RLS POLICIES
SELECT 
    '=== RLS POLICIES ===' as info,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles::text,
    cmd,
    qual::text,
    with_check::text
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- PART 3: TRIGGERS
SELECT 
    '=== TRIGGERS ===' as info,
    trigger_schema,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_orientation,
    action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- PART 4: INDEXES
SELECT
    '=== INDEXES ===' as info,
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- PART 5: ENUMS
SELECT 
    '=== ENUMS ===' as info,
    t.typname,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
GROUP BY t.typname
ORDER BY t.typname;

-- PART 6: FOREIGN KEYS
SELECT
    '=== FOREIGN KEYS ===' as info,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- PART 7: FUNCTIONS
SELECT 
    '=== FUNCTIONS ===' as info,
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
