/**
 * Storage Utilities
 * 
 * Funciones seguras para trabajar con Supabase Storage.
 * Incluye validación, manejo de errores y concurrencia limitada.
 */

import { supabase } from '../services/supabase';
import {
    getCachedSignedUrl,
    setCachedSignedUrl,
} from './mediaSignedUrlCache';

// Concurrencia limitada: máx 4 signed URL requests simultáneos
let activeRequests = 0;
const MAX_CONCURRENT = 4;
const queue: Array<() => Promise<any>> = [];

/**
 * Ejecuta una función con límite de concurrencia
 */
async function withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
    while (activeRequests >= MAX_CONCURRENT) {
        // Espera a que se libere un slot
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    activeRequests++;
    try {
        return await fn();
    } finally {
        activeRequests--;
    }
}

/**
 * Validar inputs para evitar errores silenciosos
 */
function validateInputs(
    bucket: string,
    path: string
): { valid: boolean; error?: string } {
    if (!bucket || bucket.trim() === '') {
        return { valid: false, error: 'Bucket name is empty' };
    }

    if (!path || path.trim() === '') {
        return { valid: false, error: 'Path is empty' };
    }

    // Detecta paths mal formados
    if (path.startsWith('bucket/') || path.startsWith(`${bucket}/`)) {
        return { valid: false, error: `Path should not include bucket prefix: ${path}` };
    }

    if (path.startsWith('https://')) {
        return { valid: false, error: 'Path should not be a full URL' };
    }

    return { valid: true };
}

/**
 * Obtén signed URL de forma segura con cache
 * 
 * 1. Intenta cache
 * 2. Si no existe, firma desde Supabase (con límite de concurrencia)
 * 3. Cachea el resultado
 * 
 * @returns {ok, url, error}
 */
export async function createSignedUrlSafe(
    bucket: string,
    path: string,
    expiresInSeconds: number = 3600
): Promise<{
    ok: boolean;
    url: string;
    error?: string;
}> {
    // Validación
    const validation = validateInputs(bucket, path);
    if (!validation.valid) {
        console.error('❌ Invalid input:', validation.error);
        return { ok: false, url: '', error: validation.error };
    }

    // Intenta cache primero
    const cached = getCachedSignedUrl(bucket, path);
    if (cached) {
        console.log(`✅ Using cached signed URL for: ${path}`);
        return { ok: true, url: cached };
    }

    // No en cache, necesita firmar
    try {
        const result = await withConcurrencyLimit(async () => {
            const { data, error } = await supabase.storage
                .from(bucket)
                .createSignedUrl(path, expiresInSeconds);

            if (error) {
                throw error;
            }

            return data.signedUrl;
        });

        // Cachea el resultado
        setCachedSignedUrl(bucket, path, result, expiresInSeconds);

        console.log(`✅ Signed URL created and cached: ${path}`);
        return { ok: true, url: result };
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`❌ Failed to create signed URL for ${path}:`, errorMsg);
        return { ok: false, url: '', error: errorMsg };
    }
}

/**
 * Obtén multiple signed URLs de forma paralela con límite de concurrencia
 */
export async function createSignedUrlsSafe(
    urls: Array<{ bucket: string; path: string }>
): Promise<
    Array<{
        bucket: string;
        path: string;
        url: string;
        ok: boolean;
        error?: string;
    }>
> {
    const results = await Promise.all(
        urls.map(async ({ bucket, path }) => {
            const result = await createSignedUrlSafe(bucket, path);
            return { bucket, path, ...result };
        })
    );

    return results;
}

/**
 * Delete object from Storage
 */
export async function deleteFromStorageSafe(
    bucket: string,
    path: string
): Promise<{ ok: boolean; error?: string }> {
    try {
        const { error } = await supabase.storage
            .from(bucket)
            .remove([path]);

        if (error) {
            throw error;
        }

        console.log(`✅ Deleted from storage: ${bucket}/${path}`);
        return { ok: true };
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`❌ Failed to delete from storage:`, errorMsg);
        return { ok: false, error: errorMsg };
    }
}
