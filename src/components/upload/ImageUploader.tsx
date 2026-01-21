/**
 * ImageUploader Component
 * 
 * Multi-file image upload component with:
 * - Drag & drop support
 * - Preview with reorder (drag)
 * - Cover image selection
 * - Delete functionality
 * - Support for existing images (already uploaded)
 * - Client-side compression
 */

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Star, GripVertical, Loader2, AlertCircle } from 'lucide-react';
import { createPreviewUrl, revokePreviewUrl, isValidImageType } from '../../utils/imageCompression';

// ============================================================================
// TYPES
// ============================================================================

export interface ImageFile {
    id: string;
    file: File;
    previewUrl: string;
    isCover: boolean;
    isUploading?: boolean;
    error?: string;
}

/** Existing image that's already uploaded to storage */
export interface ExistingImage {
    id: string;
    url: string;
    isCover: boolean;
}

interface ImageUploaderProps {
    /** New images to upload (controlled externally) */
    images?: ImageFile[];
    /** Callback when new images change */
    onImagesChange?: (images: ImageFile[]) => void;
    /** Existing images from server */
    existingImages?: ExistingImage[];
    /** Callback when an existing image is removed */
    onExistingImageRemove?: (imageId: string) => void;
    /** Callback when cover changes (for existing images) */
    onCoverChange?: (imageId: string) => void;
    maxImages?: number;
    maxFileSize?: number; // MB
    disabled?: boolean;
    className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const ImageUploader: React.FC<ImageUploaderProps> = ({
    images = [],
    onImagesChange,
    existingImages = [],
    onExistingImageRemove,
    onCoverChange,
    maxImages = 8,
    maxFileSize = 5,
    disabled = false,
    className = '',
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [draggedType, setDraggedType] = useState<'existing' | 'new' | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Total count of all images (existing + new)
    const totalImages = existingImages.length + images.length;

    // Handle file selection
    const handleFiles = useCallback((files: FileList | File[]) => {
        if (!onImagesChange) return;
        
        const newImages: ImageFile[] = [];
        const fileArray = Array.from(files);

        for (const file of fileArray) {
            // Check max images limit
            if (totalImages + newImages.length >= maxImages) {
                break;
            }

            // Validate type
            if (!isValidImageType(file)) {
                console.warn(`Invalid file type: ${file.type}`);
                continue;
            }

            // Validate size
            if (file.size > maxFileSize * 1024 * 1024) {
                console.warn(`File too large: ${file.name}`);
                continue;
            }

            const previewUrl = createPreviewUrl(file);
            newImages.push({
                id: crypto.randomUUID(),
                file,
                previewUrl,
                // First image is cover only if no existing images and no new images yet
                isCover: existingImages.length === 0 && images.length === 0 && newImages.length === 0,
            });
        }

        if (newImages.length > 0) {
            onImagesChange([...images, ...newImages]);
        }
    }, [images, existingImages.length, maxImages, maxFileSize, onImagesChange, totalImages]);

    // Click to select files
    const handleClick = () => {
        if (!disabled) {
            fileInputRef.current?.click();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            handleFiles(e.target.files);
            e.target.value = ''; // Reset input
        }
    };

    // Drag & Drop handlers
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (!disabled && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    };

    // Delete new image
    const handleDeleteNew = (index: number) => {
        if (!onImagesChange) return;
        
        const image = images[index];
        revokePreviewUrl(image.previewUrl);

        const newImages = images.filter((_, i) => i !== index);
        
        // If deleted was cover and we have other new images, set first as cover
        if (image.isCover && newImages.length > 0 && existingImages.length === 0) {
            newImages[0].isCover = true;
        }

        onImagesChange(newImages);
    };

    // Delete existing image
    const handleDeleteExisting = (imageId: string) => {
        if (onExistingImageRemove) {
            onExistingImageRemove(imageId);
        }
    };

    // Set cover for new images
    const handleSetCoverNew = (index: number) => {
        if (!onImagesChange) return;
        
        // Clear cover from existing images first (via callback)
        if (onCoverChange && existingImages.some(img => img.isCover)) {
            // Will be handled by parent
        }
        
        const newImages = images.map((img, i) => ({
            ...img,
            isCover: i === index,
        }));
        onImagesChange(newImages);
    };

    // Set cover for existing images
    const handleSetCoverExisting = (imageId: string) => {
        if (onCoverChange) {
            onCoverChange(imageId);
        }
        // Clear cover from new images
        if (onImagesChange && images.some(img => img.isCover)) {
            const newImages = images.map(img => ({ ...img, isCover: false }));
            onImagesChange(newImages);
        }
    };

    // Drag reorder handlers (for new images only)
    const handleDragStart = (index: number, type: 'existing' | 'new') => (e: React.DragEvent) => {
        setDraggedIndex(index);
        setDraggedType(type);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDraggedType(null);
    };

    const handleReorderDrop = (targetIndex: number) => (e: React.DragEvent) => {
        e.preventDefault();
        if (draggedIndex === null || draggedType !== 'new' || !onImagesChange) return;
        if (draggedIndex === targetIndex) return;

        const newImages = [...images];
        const [dragged] = newImages.splice(draggedIndex, 1);
        newImages.splice(targetIndex, 0, dragged);

        onImagesChange(newImages);
        setDraggedIndex(null);
        setDraggedType(null);
    };

    const canAddMore = totalImages < maxImages;

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Upload Zone */}
            {canAddMore && (
                <div
                    onClick={handleClick}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className={`
                        relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                        transition-all duration-200
                        ${isDragging
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-slate-100'
                        }
                        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={handleInputChange}
                        disabled={disabled}
                        className="hidden"
                    />
                    <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-indigo-500' : 'text-slate-400'}`} />
                    <p className="text-sm font-medium text-slate-700">
                        {isDragging ? 'Suelta las imágenes aquí' : 'Arrastra imágenes o haz clic para seleccionar'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        JPG, PNG o WebP · Máx {maxFileSize}MB por imagen · {totalImages}/{maxImages} imágenes
                    </p>
                </div>
            )}

            {/* Existing Images (from server) */}
            {existingImages.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">Imágenes actuales</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {existingImages.map((image, index) => (
                            <div
                                key={image.id}
                                className={`
                                    relative aspect-square rounded-xl overflow-hidden border-2 group
                                    ${image.isCover ? 'border-indigo-500' : 'border-slate-200'}
                                `}
                            >
                                {/* Image */}
                                <img
                                    src={image.url}
                                    alt={`Imagen ${index + 1}`}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&q=80&w=400';
                                    }}
                                />

                                {/* Cover badge */}
                                {image.isCover && (
                                    <div className="absolute top-2 left-2 bg-indigo-500 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                                        <Star className="w-3 h-3 fill-current" />
                                        Portada
                                    </div>
                                )}

                                {/* Actions (visible on hover) */}
                                {!disabled && (
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        {/* Set as cover */}
                                        {!image.isCover && (
                                            <button
                                                onClick={() => handleSetCoverExisting(image.id)}
                                                className="bg-white text-slate-700 rounded-full p-2 hover:bg-indigo-500 hover:text-white transition-colors"
                                                title="Establecer como portada"
                                            >
                                                <Star className="w-4 h-4" />
                                            </button>
                                        )}

                                        {/* Delete */}
                                        <button
                                            onClick={() => handleDeleteExisting(image.id)}
                                            className="bg-white text-slate-700 rounded-full p-2 hover:bg-red-500 hover:text-white transition-colors"
                                            title="Eliminar"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* New Image Previews (pending upload) */}
            {images.length > 0 && (
                <div className="space-y-2">
                    {existingImages.length > 0 && (
                        <p className="text-sm font-medium text-slate-700">Nuevas imágenes</p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {images.map((image, index) => (
                        <div
                            key={image.id}
                            draggable={!disabled && !image.isUploading}
                            onDragStart={handleDragStart(index, 'new')}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleReorderDrop(index)}
                            className={`
                                relative aspect-square rounded-xl overflow-hidden border-2 group
                                ${image.isCover ? 'border-indigo-500' : 'border-slate-200'}
                                ${draggedIndex === index && draggedType === 'new' ? 'opacity-50' : ''}
                                ${image.error ? 'border-red-400' : ''}
                            `}
                        >
                            {/* Image */}
                            <img
                                src={image.previewUrl}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-full object-cover"
                            />

                            {/* Uploading overlay */}
                            {image.isUploading && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                                </div>
                            )}

                            {/* Error overlay */}
                            {image.error && (
                                <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center p-2">
                                    <div className="text-white text-center">
                                        <AlertCircle className="w-6 h-6 mx-auto mb-1" />
                                        <p className="text-xs">{image.error}</p>
                                    </div>
                                </div>
                            )}

                            {/* Cover badge */}
                            {image.isCover && !image.isUploading && (
                                <div className="absolute top-2 left-2 bg-indigo-500 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                                    <Star className="w-3 h-3 fill-current" />
                                    Portada
                                </div>
                            )}

                            {/* Actions (visible on hover) */}
                            {!image.isUploading && !disabled && (
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    {/* Drag handle */}
                                    <div className="absolute top-2 left-2 bg-white/90 rounded p-1 cursor-grab">
                                        <GripVertical className="w-4 h-4 text-slate-600" />
                                    </div>

                                    {/* Set as cover */}
                                    {!image.isCover && (
                                        <button
                                            onClick={() => handleSetCoverNew(index)}
                                            className="bg-white text-slate-700 rounded-full p-2 hover:bg-indigo-500 hover:text-white transition-colors"
                                            title="Establecer como portada"
                                        >
                                            <Star className="w-4 h-4" />
                                        </button>
                                    )}

                                    {/* Delete */}
                                    <button
                                        onClick={() => handleDeleteNew(index)}
                                        className="bg-white text-slate-700 rounded-full p-2 hover:bg-red-500 hover:text-white transition-colors"
                                        title="Eliminar"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            )}

            {/* Help text */}
            {totalImages > 0 && (
                <p className="text-xs text-slate-500">
                    💡 {images.length > 0 ? 'Arrastra para reordenar · ' : ''}Haz clic en ⭐ para cambiar la portada
                </p>
            )}
        </div>
    );
};

export default ImageUploader;
