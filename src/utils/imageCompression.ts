/**
 * Image Compression Utilities
 * 
 * Client-side image compression using Canvas API.
 * Converts images to WebP format and generates multiple variants (full, thumb).
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ImageVariants {
    full: Blob;
    thumb: Blob;
    metadata: {
        originalWidth: number;
        originalHeight: number;
        fullWidth: number;
        fullHeight: number;
        thumbWidth: number;
        thumbHeight: number;
        fullBytes: number;
        thumbBytes: number;
        mime: string;
    };
}

export interface CompressionOptions {
    maxFullSize: number;      // Max dimension for full image (default 1600px)
    maxThumbSize: number;     // Max dimension for thumbnail (default 400px)
    quality: number;          // WebP quality 0-1 (default 0.85)
    thumbQuality: number;     // Thumbnail quality (default 0.75)
}

export interface CompressionResult {
    success: boolean;
    variants?: ImageVariants;
    error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_OPTIONS: CompressionOptions = {
    maxFullSize: 1600,
    maxThumbSize: 400,
    quality: 0.85,
    thumbQuality: 0.75,
};

const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
];

const MAX_INPUT_SIZE = 10 * 1024 * 1024; // 10MB max input

// ============================================================================
// MAIN COMPRESSION FUNCTION
// ============================================================================

/**
 * Compress an image file to WebP format and generate full + thumbnail variants
 * @param file - Input image file
 * @param options - Optional compression settings
 * @returns Promise with full and thumb blobs plus metadata
 */
export async function compressImageToWebpVariants(
    file: File | Blob,
    options: Partial<CompressionOptions> = {}
): Promise<CompressionResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    try {
        // Validate input
        const validation = validateInput(file);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        // Load image
        const img = await loadImage(file);
        const { width: originalWidth, height: originalHeight } = img;

        // Generate full size variant
        const fullDimensions = calculateDimensions(
            originalWidth,
            originalHeight,
            opts.maxFullSize
        );
        const fullBlob = await resizeAndCompress(
            img,
            fullDimensions.width,
            fullDimensions.height,
            opts.quality
        );

        // Generate thumbnail variant
        const thumbDimensions = calculateDimensions(
            originalWidth,
            originalHeight,
            opts.maxThumbSize
        );
        const thumbBlob = await resizeAndCompress(
            img,
            thumbDimensions.width,
            thumbDimensions.height,
            opts.thumbQuality
        );

        return {
            success: true,
            variants: {
                full: fullBlob,
                thumb: thumbBlob,
                metadata: {
                    originalWidth,
                    originalHeight,
                    fullWidth: fullDimensions.width,
                    fullHeight: fullDimensions.height,
                    thumbWidth: thumbDimensions.width,
                    thumbHeight: thumbDimensions.height,
                    fullBytes: fullBlob.size,
                    thumbBytes: thumbBlob.size,
                    mime: 'image/webp',
                },
            },
        };
    } catch (err) {
        console.error('❌ Image compression error:', err);
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Error al comprimir imagen',
        };
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate input file
 */
function validateInput(file: File | Blob): { valid: boolean; error?: string } {
    // Check size
    if (file.size > MAX_INPUT_SIZE) {
        return {
            valid: false,
            error: `El archivo es demasiado grande. Máximo ${MAX_INPUT_SIZE / (1024 * 1024)}MB`,
        };
    }

    // Check type
    const type = file.type || (file instanceof File ? file.type : 'unknown');
    if (!ALLOWED_TYPES.includes(type)) {
        return {
            valid: false,
            error: `Tipo de archivo no soportado: ${type}. Usa JPG, PNG o WebP.`,
        };
    }

    return { valid: true };
}

/**
 * Load an image from a Blob/File
 */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('No se pudo cargar la imagen'));
        };

        img.src = url;
    });
}

/**
 * Calculate new dimensions maintaining aspect ratio
 */
function calculateDimensions(
    width: number,
    height: number,
    maxSize: number
): { width: number; height: number } {
    // If image is already smaller than max, keep original dimensions
    if (width <= maxSize && height <= maxSize) {
        return { width, height };
    }

    // Scale down maintaining aspect ratio
    const ratio = Math.min(maxSize / width, maxSize / height);
    return {
        width: Math.round(width * ratio),
        height: Math.round(height * ratio),
    };
}

/**
 * Resize image and compress to WebP
 */
function resizeAndCompress(
    img: HTMLImageElement,
    width: number,
    height: number,
    quality: number
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error('No se pudo crear el contexto del canvas'));
            return;
        }

        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('No se pudo generar el blob de imagen'));
                }
            },
            'image/webp',
            quality
        );
    });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if browser supports WebP encoding
 */
export function supportsWebP(): Promise<boolean> {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        
        canvas.toBlob(
            (blob) => {
                resolve(blob !== null && blob.type === 'image/webp');
            },
            'image/webp',
            0.5
        );
    });
}

/**
 * Get image dimensions from a File/Blob
 */
export async function getImageDimensions(
    file: File | Blob
): Promise<{ width: number; height: number }> {
    const img = await loadImage(file);
    return { width: img.width, height: img.height };
}

/**
 * Check if a file is a valid image type
 */
export function isValidImageType(file: File): boolean {
    return ALLOWED_TYPES.includes(file.type);
}

/**
 * Create an object URL for preview (remember to revoke it later)
 */
export function createPreviewUrl(file: File | Blob): string {
    return URL.createObjectURL(file);
}

/**
 * Revoke a preview URL to free memory
 */
export function revokePreviewUrl(url: string): void {
    URL.revokeObjectURL(url);
}

/**
 * Compress a single image to WebP (just full size, no thumbnail)
 */
export async function compressToWebp(
    file: File | Blob,
    maxSize: number = 1600,
    quality: number = 0.85
): Promise<{ blob: Blob; width: number; height: number } | null> {
    try {
        const validation = validateInput(file);
        if (!validation.valid) {
            console.error(validation.error);
            return null;
        }

        const img = await loadImage(file);
        const dimensions = calculateDimensions(img.width, img.height, maxSize);
        const blob = await resizeAndCompress(
            img,
            dimensions.width,
            dimensions.height,
            quality
        );

        return {
            blob,
            width: dimensions.width,
            height: dimensions.height,
        };
    } catch (err) {
        console.error('Compression error:', err);
        return null;
    }
}

/**
 * Generate a thumbnail from an existing image blob
 */
export async function generateThumbnail(
    file: File | Blob,
    maxSize: number = 400,
    quality: number = 0.75
): Promise<Blob | null> {
    const result = await compressToWebp(file, maxSize, quality);
    return result?.blob || null;
}
