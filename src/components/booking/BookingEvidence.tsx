/**
 * BookingEvidence Component
 * 
 * Handles upload and display of handoff/return evidence photos
 * for rental bookings. Only visible to booking participants.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, Loader2, X, ChevronLeft, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';
import { bookingMediaService } from '../../services/itemImagesService';
import { getSignedUrl } from '../../services/storageService';
import type { BookingMedia } from '../../services/types';
import toast from 'react-hot-toast';

// ============================================================================
// TYPES
// ============================================================================

interface BookingEvidenceProps {
    rentalId: string;
    type: 'handoff' | 'return';
    canUpload: boolean;
    title?: string;
    description?: string;
    minPhotos?: number;
    maxPhotos?: number;
    onUploadComplete?: () => void;
}

interface MediaWithUrl extends BookingMedia {
    signedUrl?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const BookingEvidence: React.FC<BookingEvidenceProps> = ({
    rentalId,
    type,
    canUpload,
    title,
    description,
    minPhotos = 2,
    maxPhotos = 6,
    onUploadComplete,
}) => {
    const [media, setMedia] = useState<MediaWithUrl[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Default titles
    const sectionTitle = title || (type === 'handoff' ? 'Fotos de Entrega' : 'Fotos de Devolución');
    const sectionDescription = description || (
        type === 'handoff'
            ? 'Documenta el estado del artículo al momento de la entrega'
            : 'Documenta el estado del artículo al momento de la devolución'
    );

    // Load existing media
    useEffect(() => {
        const loadMedia = async () => {
            setLoading(true);
            try {
                const mediaList = await bookingMediaService.getByType(rentalId, type);
                
                // Get signed URLs for all media
                const mediaWithUrls = await Promise.all(
                    mediaList.map(async (m) => {
                        const result = await getSignedUrl('booking-proof-private', m.path, 3600);
                        return { ...m, signedUrl: result.url || '' };
                    })
                );
                
                setMedia(mediaWithUrls);
            } catch (error) {
                console.error('Error loading booking media:', error);
            } finally {
                setLoading(false);
            }
        };

        loadMedia();
    }, [rentalId, type]);

    // Handle file selection
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Check max photos limit
        const remainingSlots = maxPhotos - media.length;
        if (remainingSlots <= 0) {
            toast.error(`Máximo ${maxPhotos} fotos permitidas`);
            return;
        }

        const filesToUpload = Array.from(files).slice(0, remainingSlots);
        
        setUploading(true);
        setUploadProgress('Preparando...');

        try {
            const uploadedMedia: MediaWithUrl[] = [];
            const errors: string[] = [];

            for (let i = 0; i < filesToUpload.length; i++) {
                setUploadProgress(`Subiendo ${i + 1} de ${filesToUpload.length}...`);
                
                const result = await bookingMediaService.upload(
                    rentalId,
                    type,
                    filesToUpload[i]
                );

                if (result.success && result.media) {
                    // Get signed URL for the new media
                    const urlResult = await getSignedUrl('booking-proof-private', result.media.path, 3600);
                    uploadedMedia.push({ ...result.media, signedUrl: urlResult.url || '' });
                } else {
                    errors.push(result.error || 'Error desconocido');
                }
            }

            // Add to existing media
            setMedia(prev => [...prev, ...uploadedMedia]);

            if (uploadedMedia.length > 0) {
                toast.success(`${uploadedMedia.length} foto(s) subida(s) correctamente`);
                // Notify parent that upload completed (for timeline refresh)
                onUploadComplete?.();
            }

            if (errors.length > 0) {
                toast.error(`${errors.length} foto(s) no se pudieron subir`);
            }
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Error al subir las fotos');
        } finally {
            setUploading(false);
            setUploadProgress('');
            // Reset input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Delete media
    const handleDelete = async (mediaId: string) => {
        if (!confirm('¿Eliminar esta foto?')) return;

        const result = await bookingMediaService.delete(mediaId);
        if (result.success) {
            setMedia(prev => prev.filter(m => m.id !== mediaId));
            toast.success('Foto eliminada');
        } else {
            toast.error('Error al eliminar');
        }
    };

    // Lightbox navigation
    const openLightbox = (index: number) => setLightboxIndex(index);
    const closeLightbox = () => setLightboxIndex(null);
    const prevImage = () => setLightboxIndex(prev => prev !== null ? (prev === 0 ? media.length - 1 : prev - 1) : null);
    const nextImage = () => setLightboxIndex(prev => prev !== null ? (prev === media.length - 1 ? 0 : prev + 1) : null);

    // Status indicator
    const hasMinPhotos = media.length >= minPhotos;

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                            <Camera className="w-5 h-5 text-slate-600" />
                            {sectionTitle}
                        </h3>
                        <p className="text-sm text-slate-500 mt-0.5">{sectionDescription}</p>
                    </div>
                    {/* Status badge */}
                    <div className={`flex items-center gap-1 text-sm px-2 py-1 rounded-full ${
                        hasMinPhotos 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-amber-100 text-amber-700'
                    }`}>
                        {hasMinPhotos ? (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                Completado
                            </>
                        ) : (
                            <>
                                <AlertCircle className="w-4 h-4" />
                                {media.length}/{minPhotos} mín.
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Photos grid */}
                        {media.length > 0 && (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {media.map((m, index) => (
                                    <div
                                        key={m.id}
                                        className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 group cursor-pointer"
                                        onClick={() => openLightbox(index)}
                                    >
                                        {m.signedUrl ? (
                                            <img
                                                src={m.signedUrl}
                                                alt={`Evidencia ${index + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                            </div>
                                        )}
                                        
                                        {/* Delete button */}
                                        {canUpload && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(m.id);
                                                }}
                                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Upload area */}
                        {canUpload && media.length < maxPhotos && (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`
                                    border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                                    ${uploading 
                                        ? 'border-slate-300 bg-slate-50' 
                                        : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                                    }
                                `}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    multiple
                                    onChange={handleFileSelect}
                                    disabled={uploading}
                                    className="hidden"
                                />
                                {uploading ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                                        <span className="text-sm text-slate-600">{uploadProgress}</span>
                                    </div>
                                ) : (
                                    <>
                                        <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                                        <p className="text-sm font-medium text-slate-700">
                                            Añadir fotos
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {media.length}/{maxPhotos} fotos · Mínimo {minPhotos}
                                        </p>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Empty state */}
                        {!canUpload && media.length === 0 && (
                            <div className="text-center py-6 text-slate-500">
                                <Camera className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                <p className="text-sm">No hay fotos registradas</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {lightboxIndex !== null && media[lightboxIndex] && (
                <div
                    className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
                    onClick={closeLightbox}
                >
                    <button
                        onClick={closeLightbox}
                        className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
                    >
                        <X className="w-8 h-8" />
                    </button>

                    {media.length > 1 && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"
                            >
                                <ChevronLeft className="w-10 h-10" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2"
                            >
                                <ChevronRight className="w-10 h-10" />
                            </button>
                        </>
                    )}

                    <img
                        src={media[lightboxIndex].signedUrl}
                        alt={`Evidencia ${lightboxIndex + 1}`}
                        className="max-w-[90vw] max-h-[90vh] object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />

                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80">
                        {lightboxIndex + 1} / {media.length}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookingEvidence;
