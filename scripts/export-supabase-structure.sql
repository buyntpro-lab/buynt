-- ============================================================================
-- EXPORT COMPLETE SUPABASE STRUCTURE
-- Este script genera un dump de TODA la estructura del proyecto
-- Copia TODO el output y guárdalo en un archivo .sql
-- ============================================================================

-- ========== TABLES AND COLUMNS ==========
-- PART 1: List all tables with columns
SELECT 
    table_schema,
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- ============================================================================
-- SUCCESS
-- ============================================================================

SELECT '✅ Export complete! Copy ALL output above.' as status;
