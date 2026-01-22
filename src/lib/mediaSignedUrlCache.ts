/**
 * Media Signed URL Cache
 * 
 * Central cache para URLs firmadas (signed URLs) de Storage.
 * Evita re-firmar la misma imagen múltiples veces.
 * 
 * La expiración típica es 3600s (1 hora), pero lo cierto es que
 * una signed URL de Supabase expira en la fecha que especificaste.
 * Se regenera si:
 * - No existe en cache
 * - Ha expirado (según expiresAt)
 */

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Clave del cache: "bucket:path"
 */
function getCacheKey(bucket: string, path: string): string {
    return `${bucket}:${path}`;
}

/**
 * Obtén URL del cache si existe y no ha expirado
 */
export function getCachedSignedUrl(bucket: string, path: string): string | null {
    const key = getCacheKey(bucket, path);
    const entry = signedUrlCache.get(key);

    if (!entry) {
        return null;
    }

    // Aún válida (con 60s de buffer para seguridad)
    if (Date.now() < entry.expiresAt - 60000) {
        return entry.url;
    }

    // Expirada, elimina del cache
    signedUrlCache.delete(key);
    return null;
}

/**
 * Guarda URL en cache con fecha de expiración
 */
export function setCachedSignedUrl(
    bucket: string,
    path: string,
    url: string,
    expiresInSeconds: number = 3600
): void {
    const key = getCacheKey(bucket, path);
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    signedUrlCache.set(key, { url, expiresAt });
    
    console.log(`💾 Cached signed URL: ${key} (expires in ${expiresInSeconds}s)`);
}

/**
 * Limpia cache completo (para logout, etc.)
 */
export function clearSignedUrlCache(): void {
    signedUrlCache.clear();
    console.log('🧹 Cleared signed URL cache');
}

/**
 * Get stats for debugging
 */
export function getSignedUrlCacheStats(): { size: number; entries: string[] } {
    return {
        size: signedUrlCache.size,
        entries: Array.from(signedUrlCache.keys()),
    };
}
