/**
 * Supabase Client Configuration
 * 
 * Este archivo configura el cliente de Supabase usando variables de entorno.
 * Las credenciales deben estar en .env.local
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validar que las variables de entorno estén configuradas
if (!supabaseUrl) {
    throw new Error(
        '❌ VITE_SUPABASE_URL no está configurada. ' +
        'Por favor, agrégala a tu archivo .env.local'
    );
}

if (!supabaseAnonKey) {
    throw new Error(
        '❌ VITE_SUPABASE_ANON_KEY no está configurada. ' +
        'Por favor, agrégala a tu archivo .env.local'
    );
}

// Crear instancia del cliente
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Log en desarrollo
if (import.meta.env.DEV) {
    console.log('✅ Supabase Cliente configurado correctamente');
    console.log('🌐 URL:', supabaseUrl);
}

// Log de conexión en desarrollo
if (import.meta.env.DEV) {
    console.log('✅ Supabase conectado en:', supabaseUrl);
}
