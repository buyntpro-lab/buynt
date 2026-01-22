/**
 * DualEvidenceUploader Component
 * 
 * Dual evidence uploader with separated sections:
 * - "Your photos" (editable): your party's photos + staging uploader
 * - "Other party photos" (readonly): other party's photos + "Review" button
 * 
 * Shows progress for both parties and only marks step complete when BOTH meet minimum.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
    Camera, 
    Upload, 
    Loader2, 
    X, 
    Plus,
    Trash2,
    CheckCircle,
    AlertCircle,
    Eye
} from 'lucide-react';
import { bookingMediaService } from '../../services/itemImagesService';
import { markHandoffUploaded, markReturnUploaded } from '../../services/rentalEventsService';
import { getSignedUrl } from '../../services/storageService';
import type { BookingMedia, ViewerRole } from '../../services/types';
import { Button } from '../common/Button';
import { MediaThumb as MediaThumbOptimized } from '../common/MediaThumbOptimized';
import { PhotoViewerModal, type PhotoViewerPhoto } from '../common/PhotoViewerModal';
import toast from 'react-hot-toast';
import { createSignedUrlSafe, deleteFromStorageSafe } from '../../lib/storage';
import { MIN_PHOTOS_PER_PARTY } from '../../lib/rentalProgress';
import { supabase } from '../../lib/supabaseClient';

// ============================================================================
// TYPES
// ============================================================================

interface DualEvidenceUploaderProps {
    rentalId: string;
    type: 'handoff' | 'return';
    viewerRole: ViewerRole;  // 'owner' | 'renter' | 'none'
    yourPhotos: BookingMedia[];
    otherPartyPhotos: BookingMedia[];
    yourLabel: string;  // "Arrendador" | "Arrendatario"
    otherLabel: string; // "Arrendatario" | "Arrendador"
    canUpload: boolean;
    onUploadComplete?: () => void;
}

interface MediaWithUrl extends BookingMedia {
    signedUrl?: string;
}

interface StagedFile {
    id: string;
    file: File;
    preview: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const DualEvidenceUploader: React.FC<DualEvidenceUploaderProps> = ({
    rentalId,
    type,
    viewerRole,
    yourPhotos,
    otherPartyPhotos,
    yourLabel,
    otherLabel,
    canUpload,
    onUploadComplete,
}) => {
    const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const sectionTitle = type === 'handoff' ? 'Fotos de Entrega' : 'Fotos de Devolución';
    const minPhotos = MIN_PHOTOS_PER_PARTY;
    const maxPhotos = 8;

    // ✅ INSTANT: Usamos las props directamente (sin estado interno bloqueante)
    // El componente MediaThumbOptimized hace lazy-load de URLs firmadas
    const yourMedia: MediaWithUrl[] = yourPhotos.map(p => ({
        ...p,
        signedUrl: '' // Se carga lazy en MediaThumbOptimized
    }));
    const otherMedia: MediaWithUrl[] = otherPartyPhotos.map(p => ({
        ...p,
        signedUrl: '' // Se carga lazy en MediaThumbOptimized
    }));

    // Log for debugging
    useEffect(() => {
        console.log('🔍 [DualEvidence] Grid ready:', {
            rental: rentalId,
            type,
            yourCount: yourPhotos.length,
            otherCount: otherPartyPhotos.length,
        });
    }, [yourPhotos.length, otherPartyPhotos.length]);

    // Handle file selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Check total limit
        const totalAfter = yourMedia.length + stagedFiles.length + files.length;
        if (totalAfter > maxPhotos) {
            toast.error(`Máximo ${maxPhotos} fotos por tipo`);
            return;
        }

        // Create staged files with preview
        const newStaged: StagedFile[] = files.map(file => ({
            id: crypto.randomUUID(),
            file,
            preview: URL.createObjectURL(file)
        }));

        setStagedFiles(prev => [...prev, ...newStaged]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Remove staged file
    const handleRemoveStaged = (id: string) => {
        setStagedFiles(prev => {
            const file = prev.find(f => f.id === id);
            if (file) URL.revokeObjectURL(file.preview);
            return prev.filter(f => f.id !== id);
        });
    };

    // Upload all staged files
    const handleUploadAll = async () => {
        if (stagedFiles.length === 0) return;

        setUploading(true);
        try {
            const results = await Promise.all(
                stagedFiles.map(staged =>
                    bookingMediaService.upload(rentalId, type, staged.file)
                )
            );

            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;

            if (successCount > 0) {
                toast.success(`${successCount} foto(s) subida(s) correctamente`);
                // Clear staged
                stagedFiles.forEach(f => URL.revokeObjectURL(f.preview));
                setStagedFiles([]);
                
                // Mark event if needed
                const totalAfter = yourMedia.length + successCount;
                if (totalAfter >= minPhotos) {
                    const eventFn = type === 'handoff' ? markHandoffUploaded : markReturnUploaded;
                    await eventFn(rentalId);
                }
                
                // Callback to refresh parent
                onUploadComplete?.();
            }

            if (failCount > 0) {
                toast.error(`${failCount} foto(s) fallaron`);
            }
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Error al subir fotos');
        } finally {
            setUploading(false);
        }
    };

    // Delete existing photo
    const handleDeleteExisting = async (mediaId: string) => {
        try {
            const mediaToDelete = [...yourPhotos, ...otherPartyPhotos].find(
                m => m.id === mediaId
            );
            if (!mediaToDelete) return;

            // Borrar de Storage
            const bucket = mediaToDelete.bucket || 'booking-proof-private';
            const storageResult = await deleteFromStorageSafe(bucket, mediaToDelete.path);
            if (!storageResult.ok) {
                toast.error(storageResult.error || 'Error al borrar de storage');
                return;
            }

            // Borrar de DB
            const { error } = await supabase
                .from('booking_media')
                .delete()
                .eq('id', mediaId);

            if (error) {
                toast.error('Error al borrar de DB');
                return;
            }

            toast.success('Foto eliminada');
            onUploadComplete?.();
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('Error al eliminar foto');
        }
    };

    const handleCloseViewer = () => {
        setViewerOpen(false);
    };

    // Prepare ALL photos for viewer (your photos + other photos)
    const allViewerPhotos: PhotoViewerPhoto[] = [
        ...yourMedia.map(media => ({
            id: media.id,
            signedUrl: '', // Se cargará cuando se abra el viewer
            created_at: media.created_at,
            uploaderLabel: yourLabel,
            note: media.note,
            bucket: media.bucket,
            path: media.path,
        })),
        ...otherMedia.map(media => ({
            id: media.id,
            signedUrl: '', // Se cargará cuando se abra el viewer
            created_at: media.created_at,
            uploaderLabel: otherLabel,
            note: media.note,
            bucket: media.bucket,
            path: media.path,
        })),
    ];

    // Compute status
    const yourCount = yourMedia.length;
    const otherCount = otherMedia.length;
    const yourComplete = yourCount >= minPhotos;
    const otherComplete = otherCount >= minPhotos;
    const bothComplete = yourComplete && otherComplete;

    // Handler para abrir el visor en una foto específica
    const handleOpenViewer = (index: number = 0) => {
        setViewerIndex(index);
        setViewerOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-semibold text-slate-900">{sectionTitle}</h3>
                <p className="text-sm text-slate-600 mt-1">
                    Ambas partes deben documentar el estado del artículo con mínimo {minPhotos} fotos cada uno
                </p>
            </div>

            {/* Progress summary */}
            <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg border-2 ${yourComplete ? 'border-green-500 bg-green-50' : 'border-slate-300 bg-slate-50'}`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium text-slate-700">{yourLabel} (Tú)</div>
                            <div className="text-2xl font-bold text-slate-900 mt-1">
                                {yourCount}/{maxPhotos}
                            </div>
                        </div>
                        {yourComplete ? (
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        ) : (
                            <AlertCircle className="w-8 h-8 text-amber-500" />
                        )}
                    </div>
                </div>

                <div className={`p-4 rounded-lg border-2 ${otherComplete ? 'border-green-500 bg-green-50' : 'border-slate-300 bg-slate-50'}`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium text-slate-700">{otherLabel}</div>
                            <div className="text-2xl font-bold text-slate-900 mt-1">
                                {otherCount}/{maxPhotos}
                            </div>
                        </div>
                        {otherComplete ? (
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        ) : (
                            <AlertCircle className="w-8 h-8 text-slate-400" />
                        )}
                    </div>
                </div>
            </div>

            {/* Overall status */}
            {bothComplete ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <div className="text-sm text-green-800">
                        <strong>Evidencias completas:</strong> Ambas partes han cumplido el mínimo requerido
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div className="text-sm text-amber-800">
                        <strong>Pendiente:</strong> El paso se completará cuando ambas partes lleguen a {minPhotos}/{minPhotos}
                    </div>
                </div>
            )}

            {/* YOUR PHOTOS SECTION */}
            <div className="border-2 border-indigo-200 rounded-xl p-6 bg-indigo-50/30">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-slate-900">
                        Tus fotos ({yourCount})
                    </h4>
                    {canUpload && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading || yourCount >= maxPhotos}
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Seleccionar fotos
                        </Button>
                    )}
                </div>

                {/* Photos Grid - LAZY LOAD (fast render, progressive image loading) */}
                {yourMedia.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
                        {yourMedia.map((media, index) => (
                            <MediaThumbOptimized
                                key={media.id}
                                media={media}
                                onDelete={handleDeleteExisting}
                                onClick={() => handleOpenViewer(index)}
                                isDeletable={canUpload}
                                size="grid"
                            />
                        ))}
                    </div>
                )}

                {/* Staged photos grid */}
                {stagedFiles.length > 0 && (
                    <div className="mb-4">
                        <div className="text-sm font-medium text-slate-700 mb-2">
                            Por subir ({stagedFiles.length}):
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {stagedFiles.map(staged => (
                                <div key={staged.id} className="relative group">
                                    <img
                                        src={staged.preview}
                                        alt="Vista previa"
                                        className="w-full aspect-square object-cover rounded-lg border-2 border-dashed border-indigo-400 opacity-75"
                                    />
                                    <button
                                        onClick={() => handleRemoveStaged(staged.id)}
                                        className="absolute top-2 right-2 p-1.5 bg-slate-800 text-white rounded-full"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Upload button */}
                {stagedFiles.length > 0 && (
                    <Button
                        onClick={handleUploadAll}
                        disabled={uploading}
                        className="w-full"
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Subiendo...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4 mr-2" />
                                Subir {stagedFiles.length} foto{stagedFiles.length > 1 ? 's' : ''}
                            </>
                        )}
                    </Button>
                )}

                {/* Empty state */}
                {yourMedia.length === 0 && stagedFiles.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                        <Camera className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                        <p className="text-sm">Aún no has subido fotos</p>
                    </div>
                )}

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                />
            </div>

            {/* OTHER PARTY PHOTOS SECTION */}
            <div className="border-2 border-slate-200 rounded-xl p-6 bg-slate-50/50">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-slate-900">
                        Fotos de {otherLabel} ({otherCount})
                    </h4>
                    {otherMedia.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleOpenViewer}
                        >
                            <Eye className="w-4 h-4 mr-1" />
                            Revisar fotos
                        </Button>
                    )}
                </div>

                {/* Other party photos grid (lazy load, readonly) */}
                {otherMedia.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {otherMedia.map((media, index) => (
                            <MediaThumbOptimized
                                key={media.id}
                                media={media}
                                onClick={() => handleOpenViewer(yourMedia.length + index)}
                                isDeletable={false}
                                size="grid"
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-500">
                        <Camera className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                        <p className="text-sm">{otherLabel} aún no ha subido fotos</p>
                    </div>
                )}
            </div>

            {/* Photo viewer modal */}
            {viewerOpen && allViewerPhotos.length > 0 && (
                <PhotoViewerModal
                    photos={allViewerPhotos}
                    initialIndex={viewerIndex}
                    onClose={handleCloseViewer}
                />
            )}
        </div>
    );
};
