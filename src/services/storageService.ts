/**
 * Storage Service
 * 
 * Helpers for interacting with Supabase Storage buckets.
 * Handles uploads, deletions, and URL generation for both
 * public (items) and private (booking evidence) buckets.
 */

import { supabase } from './supabase';

// ============================================================================
// TYPES
// ============================================================================

export type StorageBucket = 'items-public' | 'booking-proof-private';

export interface UploadResult {
    success: boolean;
    path?: string;
    error?: string;
}

export interface SignedUrlResult {
    url: string;
    error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// No additional configuration needed - Supabase client handles URLs

// ============================================================================
// UPLOAD FUNCTIONS
// ============================================================================

/**
 * Upload a file to a Supabase Storage bucket
 * @param bucket - Target bucket name
 * @param path - Full path including filename (e.g., 'items/123/abc-full.webp')
 * @param file - Blob or File to upload
 * @param contentType - MIME type (e.g., 'image/webp')
 */
export async function uploadToBucket(
    bucket: StorageBucket,
    path: string,
    file: Blob | File,
    contentType: string = 'image/webp'
): Promise<UploadResult> {
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(path, file, {
                contentType,
                cacheControl: '3600',
                upsert: false // Don't overwrite existing files
            });

        if (error) {
            console.error('❌ Storage upload error:', error);
            return { success: false, error: error.message };
        }

        return { success: true, path: data.path };
    } catch (err) {
        console.error('❌ Storage upload exception:', err);
        return { success: false, error: 'Error inesperado al subir archivo' };
    }
}

/**
 * Upload multiple files to a bucket
 * @returns Array of results in same order as input
 */
export async function uploadMultipleToBucket(
    bucket: StorageBucket,
    uploads: Array<{ path: string; file: Blob; contentType?: string }>
): Promise<UploadResult[]> {
    const results = await Promise.all(
        uploads.map(({ path, file, contentType }) => 
            uploadToBucket(bucket, path, file, contentType || 'image/webp')
        )
    );
    return results;
}

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================

/**
 * Delete a file from a Supabase Storage bucket
 */
export async function deleteFromBucket(
    bucket: StorageBucket,
    path: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.storage
            .from(bucket)
            .remove([path]);

        if (error) {
            console.error('❌ Storage delete error:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err) {
        console.error('❌ Storage delete exception:', err);
        return { success: false, error: 'Error inesperado al eliminar archivo' };
    }
}

/**
 * Delete multiple files from a bucket
 */
export async function deleteMultipleFromBucket(
    bucket: StorageBucket,
    paths: string[]
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.storage
            .from(bucket)
            .remove(paths);

        if (error) {
            console.error('❌ Storage batch delete error:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err) {
        console.error('❌ Storage batch delete exception:', err);
        return { success: false, error: 'Error inesperado al eliminar archivos' };
    }
}

// ============================================================================
// URL GENERATION
// ============================================================================

/**
 * Get public URL for a file in a public bucket
 * Only works for items-public bucket
 */
export function getPublicUrl(bucket: 'items-public', path: string): string {
    const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);
    
    return data.publicUrl;
}

/**
 * Get a signed URL for a file in a private bucket
 * URL expires after specified seconds (default 1 hour)
 */
export async function getSignedUrl(
    bucket: StorageBucket,
    path: string,
    expiresInSeconds: number = 3600
): Promise<SignedUrlResult> {
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, expiresInSeconds);

        if (error) {
            console.error('❌ Signed URL error:', error);
            return { url: '', error: error.message };
        }

        return { url: data.signedUrl };
    } catch (err) {
        console.error('❌ Signed URL exception:', err);
        return { url: '', error: 'Error al generar URL firmada' };
    }
}

/**
 * Get multiple signed URLs at once (for galleries)
 */
export async function getSignedUrls(
    bucket: StorageBucket,
    paths: string[],
    expiresInSeconds: number = 3600
): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    // Process in parallel
    const promises = paths.map(async (path) => {
        const result = await getSignedUrl(bucket, path, expiresInSeconds);
        if (result.url) {
            results.set(path, result.url);
        }
    });
    
    await Promise.all(promises);
    return results;
}

// ============================================================================
// PATH GENERATION HELPERS
// ============================================================================

/**
 * Generate storage path for item images
 * @param itemId - UUID of the item
 * @param imageId - UUID for this specific image
 * @param variant - 'full' or 'thumb'
 */
export function generateItemImagePath(
    itemId: string,
    imageId: string,
    variant: 'full' | 'thumb'
): string {
    return `items/${itemId}/${imageId}-${variant}.webp`;
}

/**
 * Generate storage path for booking evidence
 * @param rentalId - UUID of the rental
 * @param type - 'handoff' or 'return'
 * @param imageId - UUID for this specific image
 * @param variant - 'full' or 'thumb'
 */
export function generateBookingMediaPath(
    rentalId: string,
    type: 'handoff' | 'return',
    imageId: string,
    variant: 'full' | 'thumb' = 'full'
): string {
    return `bookings/${rentalId}/${type}/${imageId}-${variant}.webp`;
}

// ============================================================================
// URL HELPERS
// ============================================================================

/**
 * Get the display URL for an item image
 * Handles both storage paths and legacy URLs
 */
export function getItemImageDisplayUrl(
    path: string | null | undefined,
    legacyUrl: string | null | undefined,
    variant: 'full' | 'thumb' = 'thumb'
): string {
    // If we have a storage path, use it
    if (path) {
        // Convert full path to thumb if needed
        const displayPath = variant === 'thumb' 
            ? path.replace('-full.webp', '-thumb.webp')
            : path.replace('-thumb.webp', '-full.webp');
        
        return getPublicUrl('items-public', displayPath);
    }
    
    // Fallback to legacy URL
    if (legacyUrl) {
        return legacyUrl;
    }
    
    // Default placeholder
    return '/placeholder-item.svg';
}

/**
 * Check if a URL is a storage path or external URL
 */
export function isStoragePath(urlOrPath: string): boolean {
    return urlOrPath.startsWith('items/') || urlOrPath.startsWith('bookings/');
}

// ============================================================================
// FILE SIZE HELPERS
// ============================================================================

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB original
export const MAX_COMPRESSED_SIZE = 1024 * 1024; // 1MB target after compression

/**
 * Validate file size before upload
 */
export function validateFileSize(file: File | Blob): { valid: boolean; error?: string } {
    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `El archivo es demasiado grande. Máximo ${MAX_FILE_SIZE / (1024 * 1024)}MB`
        };
    }
    return { valid: true };
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
