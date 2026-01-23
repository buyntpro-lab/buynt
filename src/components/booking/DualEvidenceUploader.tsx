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
    CheckCircle,
    AlertCircle,
} from 'lucide-react';
import { bookingMediaService } from '../../services/itemImagesService';
import { markHandoffUploaded, markReturnUploaded } from '../../services/rentalEventsService';
import type { BookingMedia, ViewerRole } from '../../services/types';
import { Button } from '../common/Button';
import { MediaThumb as MediaThumbOptimized } from '../common/MediaThumbOptimized';
import { PhotoViewerModal, type PhotoViewerPhoto } from '../common/PhotoViewerModal';
import toast from 'react-hot-toast';
import { deleteFromStorageSafe } from '../../lib/storage';
import { MIN_PHOTOS_PER_PARTY, MAX_PHOTOS_PER_PARTY } from '../../lib/rentalProgress';
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
    const maxPhotos = MAX_PHOTOS_PER_PARTY;

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

    // Límite bloqueante: cuántos espacios quedan
    const remainingSlots = Math.max(0, maxPhotos - yourMedia.length - stagedFiles.length);
    const isAtMaxLimit = yourMedia.length >= maxPhotos;

    // Log for debugging
    useEffect(() => {
        console.log('🔍 [DualEvidence] Grid ready:', {
            rental: rentalId,
            type,
            yourCount: yourPhotos.length,
            otherCount: otherPartyPhotos.length,
        });
    }, [yourPhotos.length, otherPartyPhotos.length]);

    // Handle file selection - with clamp to remaining slots
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Check if already at max
        if (isAtMaxLimit) {
            toast.error(`Has alcanzado el máximo de ${maxPhotos} fotos permitidas.`);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // Clamp selection to remaining slots
        const filesToAdd = files.slice(0, remainingSlots);
        const rejected = files.length - filesToAdd.length;

        if (rejected > 0) {
            toast(`Solo puedes añadir ${remainingSlots} foto(s) más. Se descartaron ${rejected}.`, {
                icon: '⚠️',
                duration: 4000,
            });
        }

        if (filesToAdd.length === 0) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // Create staged files with preview
        const newStaged: StagedFile[] = filesToAdd.map(file => ({
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

    // Compute status - SOLO fotos propias visibles
    const yourCount = yourMedia.length;
    const otherCount = otherMedia.length; // Solo para verificar si la otra parte cumplió
    const yourComplete = yourCount >= minPhotos;
    const otherComplete = otherCount >= minPhotos;

    // Handler para abrir el visor en una foto específica (SOLO fotos propias)
    const handleOpenViewer = (index: number = 0) => {
        setViewerIndex(index);
        setViewerOpen(true);
    };

    // Fotos para el visor - SOLO las propias
    const viewerPhotos: PhotoViewerPhoto[] = yourMedia.map(media => ({
        id: media.id,
        signedUrl: '',
        created_at: media.created_at,
        uploaderLabel: yourLabel,
        note: media.note,
        bucket: media.bucket,
        path: media.path,
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-semibold text-slate-900">{sectionTitle}</h3>
                <p className="text-sm text-slate-600 mt-1">
                    Sube mínimo {minPhotos} fotos del estado del artículo (máximo {maxPhotos})
                </p>
            </div>

            {/* Tu progreso personal */}
            <div className={`p-4 rounded-lg border-2 ${yourComplete ? 'border-green-500 bg-green-50' : 'border-indigo-300 bg-indigo-50'}`}>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium text-slate-700">Tu progreso</div>
                        <div className="text-2xl font-bold text-slate-900 mt-1">
                            {yourCount}/{minPhotos} mínimo
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                            {yourCount}/{maxPhotos} máximo permitido
                        </div>
                    </div>
                    {yourComplete ? (
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    ) : (
                        <AlertCircle className="w-8 h-8 text-amber-500" />
                    )}
                </div>
            </div>

            {/* Status banner */}
            {yourComplete ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <div className="text-sm text-green-800">
                        <strong>¡Listo!</strong> Has subido el mínimo requerido de fotos.
                        {otherComplete ? (
                            <span className="ml-1">La otra parte también ha completado.</span>
                        ) : (
                            <span className="ml-1 text-amber-700">Esperando a que la otra parte suba las suyas.</span>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div className="text-sm text-amber-800">
                        <strong>Pendiente:</strong> Sube al menos {minPhotos - yourCount} foto{minPhotos - yourCount !== 1 ? 's' : ''} más para completar tu parte.
                    </div>
                </div>
            )}

            {/* YOUR PHOTOS SECTION */}
            <div className="border-2 border-indigo-200 rounded-xl p-6 bg-indigo-50/30">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-slate-900">
                        Tus fotos ({yourCount}/{maxPhotos})
                    </h4>
                    {canUpload && !isAtMaxLimit && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Seleccionar fotos
                        </Button>
                    )}
                </div>

                {/* Mensaje permanente de límite máximo */}
                {isAtMaxLimit && canUpload && (
                    <div className="flex items-center gap-2 p-3 mb-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div className="text-sm text-blue-800">
                            Has alcanzado el máximo de {maxPhotos} fotos permitidas para este paso.
                        </div>
                    </div>
                )}

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

            {/* Photo viewer modal - SOLO tus fotos */}
            {viewerOpen && viewerPhotos.length > 0 && (
                <PhotoViewerModal
                    photos={viewerPhotos}
                    initialIndex={viewerIndex}
                    onClose={handleCloseViewer}
                />
            )}
        </div>
    );
};
