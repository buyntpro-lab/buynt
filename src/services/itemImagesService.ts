/**
 * Item Images Service
 * 
 * Handles CRUD operations for item images stored in Supabase Storage.
 * Works with the item_images table and items-public bucket.
 */

import { supabase } from './supabase';
import type { ItemImage, ItemImageInsert, BookingMedia, BookingMediaInsert } from './types';
import {
    uploadToBucket,
    deleteFromBucket,
    deleteMultipleFromBucket,
    generateItemImagePath,
    generateBookingMediaPath,
    getPublicUrl,
    getSignedUrls,
} from './storageService';
import { compressImageToWebpVariants } from '../utils/imageCompression';

// ============================================================================
// ITEM IMAGES SERVICE
// ============================================================================

export const itemImagesService = {
    /**
     * Get all images for an item
     */
    async getByItemId(itemId: string): Promise<ItemImage[]> {
        const { data, error } = await supabase
            .from('item_images')
            .select('*')
            .eq('item_id', itemId)
            .order('sort', { ascending: true });

        if (error) {
            console.error('Error fetching item images:', error);
            return [];
        }
        return data || [];
    },

    /**
     * Get cover image for an item
     */
    async getCover(itemId: string): Promise<ItemImage | null> {
        const { data, error } = await supabase
            .from('item_images')
            .select('*')
            .eq('item_id', itemId)
            .eq('is_cover', true)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
            console.error('Error fetching cover image:', error);
        }
        return data || null;
    },

    /**
     * Upload a new image for an item
     * Handles compression, storage upload, and DB insert
     */
    async upload(
        itemId: string,
        file: File,
        options: { isCover?: boolean; sort?: number } = {}
    ): Promise<{ success: boolean; image?: ItemImage; error?: string }> {
        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return { success: false, error: 'No autenticado' };
            }

            // Compress image to WebP variants
            const compression = await compressImageToWebpVariants(file);
            if (!compression.success || !compression.variants) {
                return { success: false, error: compression.error || 'Error al comprimir imagen' };
            }

            // Generate unique ID and paths
            const imageId = crypto.randomUUID();
            const fullPath = generateItemImagePath(itemId, imageId, 'full');
            const thumbPath = generateItemImagePath(itemId, imageId, 'thumb');

            // Upload both variants to storage
            const [fullUpload, thumbUpload] = await Promise.all([
                uploadToBucket('items-public', fullPath, compression.variants.full, 'image/webp'),
                uploadToBucket('items-public', thumbPath, compression.variants.thumb, 'image/webp'),
            ]);

            if (!fullUpload.success || !thumbUpload.success) {
                // Clean up any successful uploads
                if (fullUpload.success) await deleteFromBucket('items-public', fullPath);
                if (thumbUpload.success) await deleteFromBucket('items-public', thumbPath);
                return { success: false, error: fullUpload.error || thumbUpload.error };
            }

            // If this will be cover, unset current cover first
            if (options.isCover) {
                await supabase
                    .from('item_images')
                    .update({ is_cover: false })
                    .eq('item_id', itemId)
                    .eq('is_cover', true);
            }

            // Insert DB record (store full path, thumb is derived)
            const imageRecord: ItemImageInsert = {
                item_id: itemId,
                path: fullPath,
                bucket: 'items-public',
                is_cover: options.isCover ?? false,
                sort: options.sort ?? 999,
                width: compression.variants.metadata.fullWidth,
                height: compression.variants.metadata.fullHeight,
                mime: 'image/webp',
                bytes: compression.variants.metadata.fullBytes,
                created_by: user.id,
            };

            const { data, error } = await supabase
                .from('item_images')
                .insert(imageRecord)
                .select()
                .single();

            if (error) {
                console.error('Error inserting image record:', error);
                // Clean up storage
                await deleteMultipleFromBucket('items-public', [fullPath, thumbPath]);
                return { success: false, error: error.message };
            }

            return { success: true, image: data };
        } catch (err) {
            console.error('Upload exception:', err);
            return { success: false, error: 'Error inesperado al subir imagen' };
        }
    },

    /**
     * Upload multiple images at once
     */
    async uploadMultiple(
        itemId: string,
        files: File[],
        startSort: number = 0
    ): Promise<{ success: boolean; images: ItemImage[]; errors: string[] }> {
        const images: ItemImage[] = [];
        const errors: string[] = [];

        for (let i = 0; i < files.length; i++) {
            const result = await this.upload(itemId, files[i], {
                isCover: i === 0 && startSort === 0, // First image is cover if starting from 0
                sort: startSort + i,
            });

            if (result.success && result.image) {
                images.push(result.image);
            } else {
                errors.push(`Imagen ${i + 1}: ${result.error}`);
            }
        }

        return {
            success: errors.length === 0,
            images,
            errors,
        };
    },

    /**
     * Delete an image
     */
    async delete(imageId: string): Promise<{ success: boolean; error?: string }> {
        try {
            // Get image record first
            const { data: image, error: fetchError } = await supabase
                .from('item_images')
                .select('path')
                .eq('id', imageId)
                .single();

            if (fetchError || !image) {
                return { success: false, error: 'Imagen no encontrada' };
            }

            // Delete from storage (both variants)
            const thumbPath = image.path.replace('-full.webp', '-thumb.webp');
            await deleteMultipleFromBucket('items-public', [image.path, thumbPath]);

            // Delete DB record
            const { error } = await supabase
                .from('item_images')
                .delete()
                .eq('id', imageId);

            if (error) {
                console.error('Error deleting image record:', error);
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (err) {
            console.error('Delete exception:', err);
            return { success: false, error: 'Error al eliminar imagen' };
        }
    },

    /**
     * Set an image as cover
     */
    async setCover(imageId: string): Promise<{ success: boolean; error?: string }> {
        const { error } = await supabase.rpc('set_item_cover', { p_image_id: imageId });
        
        if (error) {
            console.error('Error setting cover:', error);
            return { success: false, error: error.message };
        }
        return { success: true };
    },

    /**
     * Reorder images
     */
    async reorder(imageIds: string[]): Promise<{ success: boolean; error?: string }> {
        const { error } = await supabase.rpc('reorder_item_images', { p_image_ids: imageIds });
        
        if (error) {
            console.error('Error reordering images:', error);
            return { success: false, error: error.message };
        }
        return { success: true };
    },

    /**
     * Get public URL for an image (full or thumb variant)
     */
    getUrl(path: string, variant: 'full' | 'thumb' = 'thumb'): string {
        const actualPath = variant === 'thumb'
            ? path.replace('-full.webp', '-thumb.webp')
            : path;
        return getPublicUrl('items-public', actualPath);
    },
};

// ============================================================================
// BOOKING MEDIA SERVICE
// ============================================================================

export const bookingMediaService = {
    /**
     * Get all media for a rental
     */
    async getByRentalId(rentalId: string): Promise<BookingMedia[]> {
        const { data, error } = await supabase
            .from('booking_media')
            .select('*')
            .eq('rental_id', rentalId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching booking media:', error);
            return [];
        }
        return data || [];
    },

    /**
     * Get media by type (handoff or return)
     */
    async getByType(
        rentalId: string,
        type: 'handoff' | 'return'
    ): Promise<BookingMedia[]> {
        const { data, error } = await supabase
            .from('booking_media')
            .select('*')
            .eq('rental_id', rentalId)
            .eq('type', type)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching booking media by type:', error);
            return [];
        }
        return data || [];
    },

    /**
     * Upload evidence photo for a rental
     */
    async upload(
        rentalId: string,
        type: 'handoff' | 'return',
        file: File,
        note?: string
    ): Promise<{ success: boolean; media?: BookingMedia; error?: string }> {
        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return { success: false, error: 'No autenticado' };
            }

            // Compress image
            const compression = await compressImageToWebpVariants(file);
            if (!compression.success || !compression.variants) {
                return { success: false, error: compression.error || 'Error al comprimir imagen' };
            }

            // Generate path and upload
            const mediaId = crypto.randomUUID();
            const path = generateBookingMediaPath(rentalId, type, mediaId, 'full');

            const upload = await uploadToBucket(
                'booking-proof-private',
                path,
                compression.variants.full,
                'image/webp'
            );

            if (!upload.success) {
                return { success: false, error: upload.error };
            }

            // Insert DB record
            const mediaRecord: BookingMediaInsert = {
                rental_id: rentalId,
                type,
                path,
                bucket: 'booking-proof-private',
                bytes: compression.variants.metadata.fullBytes,
                note,
                uploaded_by: user.id,
            };

            const { data, error } = await supabase
                .from('booking_media')
                .insert(mediaRecord)
                .select()
                .single();

            if (error) {
                console.error('Error inserting media record:', error);
                await deleteFromBucket('booking-proof-private', path);
                return { success: false, error: error.message };
            }

            // Trigger timeline event RPC for this upload type
            // This marks handoff/return as uploaded in the rental_events system
            const rpcName = type === 'handoff' ? 'mark_handoff_uploaded' : 'mark_return_uploaded';
            const { error: rpcError } = await supabase.rpc(rpcName, { p_rental_id: rentalId });
            if (rpcError) {
                // Log but don't fail - the media was uploaded successfully
                console.warn(`Timeline event not created (${rpcName}):`, rpcError.message);
            }

            return { success: true, media: data };
        } catch (err) {
            console.error('Upload booking media exception:', err);
            return { success: false, error: 'Error inesperado al subir evidencia' };
        }
    },

    /**
     * Upload multiple evidence photos
     */
    async uploadMultiple(
        rentalId: string,
        type: 'handoff' | 'return',
        files: File[],
        note?: string
    ): Promise<{ success: boolean; media: BookingMedia[]; errors: string[] }> {
        const media: BookingMedia[] = [];
        const errors: string[] = [];

        for (let i = 0; i < files.length; i++) {
            const result = await this.upload(rentalId, type, files[i], i === 0 ? note : undefined);

            if (result.success && result.media) {
                media.push(result.media);
            } else {
                errors.push(`Imagen ${i + 1}: ${result.error}`);
            }
        }

        return {
            success: errors.length === 0,
            media,
            errors,
        };
    },

    /**
     * Delete a media file
     */
    async delete(mediaId: string): Promise<{ success: boolean; error?: string }> {
        try {
            // Get record first
            const { data: media, error: fetchError } = await supabase
                .from('booking_media')
                .select('path')
                .eq('id', mediaId)
                .single();

            if (fetchError || !media) {
                return { success: false, error: 'Evidencia no encontrada' };
            }

            // Delete from storage
            await deleteFromBucket('booking-proof-private', media.path);

            // Delete DB record
            const { error } = await supabase
                .from('booking_media')
                .delete()
                .eq('id', mediaId);

            if (error) {
                console.error('Error deleting media record:', error);
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (err) {
            console.error('Delete media exception:', err);
            return { success: false, error: 'Error al eliminar evidencia' };
        }
    },

    /**
     * Get signed URLs for viewing private media
     */
    async getSignedUrls(
        mediaList: BookingMedia[],
        expiresIn: number = 3600
    ): Promise<Map<string, string>> {
        const paths = mediaList.map((m) => m.path);
        return getSignedUrls('booking-proof-private', paths, expiresIn);
    },
};
