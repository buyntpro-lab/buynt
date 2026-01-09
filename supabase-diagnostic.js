// Script para verificar la conexión a Supabase
// Ejecuta esto en la consola del navegador (F12 -> Console)

(async () => {
    console.log('🔍 Iniciando diagnóstico de Supabase...\n');
    
    // Importar Supabase
    const { supabase } = await import('./src/services/supabase.js');
    
    console.log('1️⃣ Verificando conexión básica...');
    try {
        const { data: testData, error: testError } = await supabase
            .from('items')
            .select('count', { count: 'exact', head: true });
        
        if (testError) {
            console.error('❌ Error al conectar:', testError.message);
            console.error('Código de error:', testError.code);
            console.error('Detalles:', testError);
        } else {
            console.log('✅ Conexión OK');
        }
    } catch (e) {
        console.error('❌ Exception:', e);
    }
    
    console.log('\n2️⃣ Intentando traer items...');
    try {
        const { data, error, status } = await supabase
            .from('items')
            .select('*')
            .limit(5);
        
        if (error) {
            console.error('❌ Error:', error.message);
            console.error('Status HTTP:', status);
            console.error('Detalles completos:', error);
        } else {
            console.log('✅ Items traídos:', data?.length || 0, 'items');
            console.log('Datos:', data);
        }
    } catch (e) {
        console.error('❌ Exception:', e);
    }
    
    console.log('\n3️⃣ Verificando autenticación...');
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
            console.error('❌ Error de auth:', error.message);
        } else {
            console.log('✅ Usuario autenticado:', user?.email);
        }
    } catch (e) {
        console.error('❌ Exception:', e);
    }
})();
