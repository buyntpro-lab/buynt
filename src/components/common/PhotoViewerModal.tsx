/**
 * PhotoViewerModal Component
 * 
 * Modal carrusel para revisar fotos de evidencia (handoff/return)
 * Muestra metadata: uploader role, fecha, nota
 * Carga URLs firmadas lazy (cuando la foto se visualiza)
 */

import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../common/Button';
import { createSignedUrlSafe } from '../../lib/storage';

// ============================================================================
// TYPES
// ============================================================================

export interface PhotoViewerPhoto {
    id: string;
    signedUrl: string;
    created_at?: string;
    uploaderLabel: string;  // "Arrendador" | "Arrendatario"
    note?: string;
    bucket?: string;  // Para lazy loading de URL firmada
    path?: string;    // Para lazy loading de URL firmada
}

interface PhotoViewerModalProps {
    photos: PhotoViewerPhoto[];
    initialIndex?: number;
    onClose: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const PhotoViewerModal: React.FC<PhotoViewerModalProps> = ({
    photos,
    initialIndex = 0,
    onClose,
}) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [zoom, setZoom] = useState(100);
    const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
    const [loadingUrl, setLoadingUrl] = useState(false);

    const currentPhoto = photos[currentIndex];
    const hasMultiple = photos.length > 1;
    
    // Get current photo URL (from cache or pre-signed)
    const currentUrl = currentPhoto?.signedUrl || signedUrls.get(currentPhoto?.id || '') || '';

    // Load signed URL for current photo (lazy)
    useEffect(() => {
        const loadSignedUrl = async () => {
            if (!currentPhoto) return;
            
            // Skip if already have URL
            if (currentPhoto.signedUrl || signedUrls.has(currentPhoto.id)) {
                return;
            }
            
            // Need bucket and path to sign
            if (!currentPhoto.bucket || !currentPhoto.path) {
                console.warn('[PhotoViewer] Missing bucket/path for photo:', currentPhoto.id);
                return;
            }
            
            setLoadingUrl(true);
            try {
                const result = await createSignedUrlSafe(currentPhoto.bucket, currentPhoto.path);
                if (result.ok && result.url) {
                    setSignedUrls(prev => new Map(prev).set(currentPhoto.id, result.url!));
                }
            } catch (err) {
                console.error('[PhotoViewer] Failed to sign URL:', err);
            } finally {
                setLoadingUrl(false);
            }
        };
        
        loadSignedUrl();
    }, [currentPhoto?.id, currentPhoto?.bucket, currentPhoto?.path]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft' && currentIndex > 0) setCurrentIndex(currentIndex - 1);
            if (e.key === 'ArrowRight' && currentIndex < photos.length - 1) setCurrentIndex(currentIndex + 1);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, photos.length, onClose]);

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
            setZoom(100); // Reset zoom on navigation
        }
    };

    const handleNext = () => {
        if (currentIndex < photos.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setZoom(100);
        }
    };

    const handleZoomIn = () => {
        setZoom(Math.min(zoom + 25, 200));
    };

    const handleZoomOut = () => {
        setZoom(Math.max(zoom - 25, 50));
    };

    const formattedDate = currentPhoto?.created_at 
        ? format(new Date(currentPhoto.created_at), "d MMM yyyy, HH:mm", { locale: es })
        : '';

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={onClose}
        >
            {/* Main container */}
            <div 
                className="relative w-full max-w-6xl max-h-[90vh] bg-slate-900 rounded-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
                    <div className="text-white">
                        <div className="font-semibold">{currentPhoto?.uploaderLabel}</div>
                        <div className="text-sm text-slate-300">{formattedDate}</div>
                    </div>
                    
                    <button
                        onClick={onClose}
                        className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        aria-label="Cerrar"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Image container */}
                <div className="flex items-center justify-center min-h-[500px] max-h-[70vh] overflow-auto bg-slate-950">
                    {loadingUrl || !currentUrl ? (
                        <div className="flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-10 h-10 text-white animate-spin" />
                            <span className="text-sm text-slate-400">Cargando foto...</span>
                        </div>
                    ) : (
                        <img
                            src={currentUrl}
                            alt={`Foto ${currentIndex + 1}`}
                            className="max-w-full max-h-full object-contain transition-transform duration-200"
                            style={{ transform: `scale(${zoom / 100})` }}
                        />
                    )}
                </div>

                {/* Footer with controls */}
                <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-gradient-to-t from-black/70 to-transparent">
                    {/* Note (if exists) */}
                    {currentPhoto?.note && (
                        <div className="mb-3 p-3 bg-slate-800/80 rounded-lg">
                            <div className="text-xs text-slate-400 mb-1">Nota:</div>
                            <div className="text-sm text-white">{currentPhoto.note}</div>
                        </div>
                    )}

                    {/* Controls */}
                    <div className="flex items-center justify-between">
                        {/* Navigation */}
                        <div className="flex items-center gap-2">
                            {hasMultiple && (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handlePrev}
                                        disabled={currentIndex === 0}
                                        className="text-white hover:bg-white/10 disabled:opacity-30"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </Button>
                                    
                                    <span className="text-white text-sm px-3">
                                        {currentIndex + 1} / {photos.length}
                                    </span>
                                    
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleNext}
                                        disabled={currentIndex === photos.length - 1}
                                        className="text-white hover:bg-white/10 disabled:opacity-30"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </Button>
                                </>
                            )}
                        </div>

                        {/* Zoom controls */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleZoomOut}
                                disabled={zoom <= 50}
                                className="text-white hover:bg-white/10 disabled:opacity-30"
                            >
                                <ZoomOut className="w-5 h-5" />
                            </Button>
                            
                            <span className="text-white text-sm px-2 min-w-[4rem] text-center">
                                {zoom}%
                            </span>
                            
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleZoomIn}
                                disabled={zoom >= 200}
                                className="text-white hover:bg-white/10 disabled:opacity-30"
                            >
                                <ZoomIn className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
