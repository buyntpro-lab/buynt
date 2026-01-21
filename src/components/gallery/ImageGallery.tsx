/**
 * ImageGallery Component
 * 
 * Displays item images in a gallery format:
 * - Single image: Hero display
 * - Multiple images: Main + thumbnails with navigation
 * - Lightbox for fullscreen view
 */

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface GalleryImage {
    id: string;
    fullUrl: string;
    thumbUrl?: string;
    alt?: string;
}

interface ImageGalleryProps {
    images: GalleryImage[];
    fallbackUrl?: string;
    className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const ImageGallery: React.FC<ImageGalleryProps> = ({
    images,
    fallbackUrl,
    className = '',
}) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [lightboxOpen, setLightboxOpen] = useState(false);

    // If no images, show fallback or placeholder
    if (images.length === 0) {
        return (
            <div className={`relative rounded-3xl overflow-hidden bg-slate-100 ${className}`}>
                <img
                    src={fallbackUrl || '/placeholder-item.svg'}
                    alt="Imagen del producto"
                    className="w-full h-full object-cover"
                />
            </div>
        );
    }

    const activeImage = images[activeIndex];
    const hasMultiple = images.length > 1;

    // Navigation
    const goToPrev = () => {
        setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    };

    const goToNext = () => {
        setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    };

    // Keyboard navigation for lightbox
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowLeft') goToPrev();
        if (e.key === 'ArrowRight') goToNext();
        if (e.key === 'Escape') setLightboxOpen(false);
    };

    return (
        <>
            {/* Main Gallery */}
            <div className={`space-y-3 ${className}`}>
                {/* Main Image */}
                <div className="relative group rounded-3xl overflow-hidden bg-slate-100 aspect-[4/3]">
                    <img
                        src={activeImage.fullUrl}
                        alt={activeImage.alt || `Imagen ${activeIndex + 1}`}
                        className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
                        onClick={() => setLightboxOpen(true)}
                    />

                    {/* Zoom hint */}
                    <button
                        onClick={() => setLightboxOpen(true)}
                        className="absolute top-4 right-4 bg-white/90 backdrop-blur rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Ver en grande"
                    >
                        <ZoomIn className="w-5 h-5 text-slate-700" />
                    </button>

                    {/* Navigation arrows (multiple images) */}
                    {hasMultiple && (
                        <>
                            <button
                                onClick={goToPrev}
                                className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                            >
                                <ChevronLeft className="w-5 h-5 text-slate-700" />
                            </button>
                            <button
                                onClick={goToNext}
                                className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur rounded-full p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                            >
                                <ChevronRight className="w-5 h-5 text-slate-700" />
                            </button>
                        </>
                    )}

                    {/* Image counter */}
                    {hasMultiple && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
                            {activeIndex + 1} / {images.length}
                        </div>
                    )}
                </div>

                {/* Thumbnails */}
                {hasMultiple && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {images.map((image, index) => (
                            <button
                                key={image.id}
                                onClick={() => setActiveIndex(index)}
                                className={`
                                    flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all
                                    ${index === activeIndex
                                        ? 'border-indigo-500 ring-2 ring-indigo-200'
                                        : 'border-transparent opacity-70 hover:opacity-100'
                                    }
                                `}
                            >
                                <img
                                    src={image.thumbUrl || image.fullUrl}
                                    alt={`Miniatura ${index + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {lightboxOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
                    onClick={() => setLightboxOpen(false)}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                >
                    {/* Close button */}
                    <button
                        onClick={() => setLightboxOpen(false)}
                        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-10"
                    >
                        <X className="w-8 h-8" />
                    </button>

                    {/* Navigation */}
                    {hasMultiple && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"
                            >
                                <ChevronLeft className="w-10 h-10" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); goToNext(); }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"
                            >
                                <ChevronRight className="w-10 h-10" />
                            </button>
                        </>
                    )}

                    {/* Main image */}
                    <img
                        src={activeImage.fullUrl}
                        alt={activeImage.alt || `Imagen ${activeIndex + 1}`}
                        className="max-w-[90vw] max-h-[90vh] object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />

                    {/* Counter */}
                    {hasMultiple && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-lg">
                            {activeIndex + 1} / {images.length}
                        </div>
                    )}

                    {/* Thumbnails */}
                    {hasMultiple && (
                        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 max-w-[90vw] overflow-x-auto pb-2">
                            {images.map((image, index) => (
                                <button
                                    key={image.id}
                                    onClick={(e) => { e.stopPropagation(); setActiveIndex(index); }}
                                    className={`
                                        flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-all
                                        ${index === activeIndex
                                            ? 'border-white'
                                            : 'border-transparent opacity-50 hover:opacity-100'
                                        }
                                    `}
                                >
                                    <img
                                        src={image.thumbUrl || image.fullUrl}
                                        alt={`Miniatura ${index + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default ImageGallery;
