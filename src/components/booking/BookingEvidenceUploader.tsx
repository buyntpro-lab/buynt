/**
 * BookingEvidenceUploader Component
 * 
 * Refactored uploader with staging model:
 * 1. Select multiple files
 * 2. Show previews
 * 3. Add/remove files from staging
 * 4. Click "Upload X photos" button to actually upload
 * 5. Only mark step as complete when min photos confirmed in DB
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
    Camera, 
    Upload, 
    Loader2, 
    X, 
    ChevronLeft, 
    ChevronRight, 
    AlertCircle, 
    CheckCircle,
    Plus,
    Trash2
} from 'lucide-react';
import { bookingMediaService } from '../../services/itemImagesService';
import { rentalEventsService } from '../../services/rentalEventsService';
import { getSignedUrl } from '../../services/storageService';
import type { BookingMedia } from '../../services/types';
import { Button } from '../common/Button';
import toast from 'react-hot-toast';

// ============================================================================
// TYPES
// ============================================================================

interface BookingEvidenceUploaderProps {
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

interface StagedFile {
    id: string;  // temp id for staging
    file: File;
    preview: string;
}

interface UploadResult {
    file: File;
    success: boolean;
    media?: MediaWithUrl;
    error?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const BookingEvidenceUploader: React.FC<BookingEvidenceUploaderProps> = ({
    rentalId,
    type,
    canUpload,
    title,
    description,
    minPhotos = 3,
    maxPhotos = 8,
    onUploadComplete,
}) => {
    const [existingMedia, setExistingMedia] = useState<MediaWithUrl[]>([]);
    const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [lightboxMode, setLightboxMode] = useState<'existing' | 'staged'>('existing');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Default titles
    const sectionTitle = title || (type === 'handoff' ? 'Fotos de Entrega' : 'Fotos de Devolución');
    const sectionDescription = description || (
        type === 'handoff'
            ? 'Documenta el estado del artículo al momento de la entrega'
            : 'Documenta el estado del artículo al momento de la devolución'
    );

    // Load existing media on mount
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
                
                setExistingMedia(mediaWithUrls);
            } catch (error) {
                console.error('Error loading booking media:', error);
                toast.error('Error cargando fotos existentes');
            } finally {
                setLoading(false);
            }
        };

        loadMedia();
    }, [rentalId, type]);

    // Handle file selection (staging only)
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Calculate available slots
        const totalExisting = existingMedia.length;
        const totalStaged = stagedFiles.length;
        const totalCurrent = totalExisting + totalStaged;
        const remainingSlots = maxPhotos - totalCurrent;

        if (remainingSlots <= 0) {
            toast.error(`Máximo ${maxPhotos} fotos permitidas`);
            return;
        }

        // Stage files (don't upload yet)
        const newFiles: StagedFile[] = [];
        const filesToAdd = Array.from(files).slice(0, remainingSlots);

        filesToAdd.forEach((file, idx) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = e.target?.result as string;
                newFiles.push({
                    id: `staged-${Date.now()}-${idx}`,
                    file,
                    preview,
                });

                // Add to state when all files are read
                if (newFiles.length === filesToAdd.length) {
                    setStagedFiles(prev => [...prev, ...newFiles]);
                    toast.success(`${filesToAdd.length} foto(s) agregada(s) al staging`);
                }
            };
            reader.readAsDataURL(file);
        });

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Remove staged file
    const handleRemoveStaged = (id: string) => {
        setStagedFiles(prev => prev.filter(f => f.id !== id));
        toast.success('Foto removida del staging');
    };

    // Delete existing media
    const handleDeleteExisting = async (mediaId: string) => {
        if (!confirm('¿Eliminar esta foto?')) return;

        const result = await bookingMediaService.delete(mediaId);
        if (result.success) {
            setExistingMedia(prev => prev.filter(m => m.id !== mediaId));
            toast.success('Foto eliminada');
        } else {
            toast.error('Error al eliminar');
        }
    };

    // Upload all staged files
    const handleUploadStaged = async () => {
        if (stagedFiles.length === 0) {
            toast.error('Selecciona al menos una foto');
            return;
        }

        setUploading(true);
        const results: UploadResult[] = [];

        try {
            // Upload all files in parallel, but track progress individually
            const uploadPromises = stagedFiles.map(async (staged) => {
                try {
                    const result = await bookingMediaService.upload(
                        rentalId,
                        type,
                        staged.file
                    );

                    if (result.success && result.media) {
                        // Get signed URL
                        const urlResult = await getSignedUrl('booking-proof-private', result.media.path, 3600);
                        return {
                            file: staged.file,
                            success: true,
                            media: { ...result.media, signedUrl: urlResult.url || '' },
                        };
                    } else {
                        return {
                            file: staged.file,
                            success: false,
                            error: result.error || 'Error desconocido',
                        };
                    }
                } catch (err) {
                    return {
                        file: staged.file,
                        success: false,
                        error: String(err),
                    };
                }
            });

            const uploadResults = await Promise.all(uploadPromises);
            results.push(...uploadResults);

            // Update UI with results
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);

            if (successful.length > 0) {
                const newMedia = successful
                    .map(r => r.media)
                    .filter((m): m is MediaWithUrl => m !== undefined);
                
                setExistingMedia(prev => [...prev, ...newMedia]);
                setStagedFiles([]); // Clear staging

                // Try to mark photos as uploaded
                const totalPhotos = existingMedia.length + newMedia.length;
                if (totalPhotos >= minPhotos) {
                    // Mark as uploaded in events
                    const eventResult = type === 'handoff'
                        ? await rentalEventsService.markHandoffUploaded(rentalId)
                        : await rentalEventsService.markReturnUploaded(rentalId);

                    if (eventResult.ok) {
                        toast.success(`✅ ${successful.length} foto(s) subida(s) y paso marcado como completado`);
                    } else {
                        toast.success(`${successful.length} foto(s) subida(s)`);
                        console.warn('Warning marking photos as uploaded:', eventResult.message);
                    }
                } else {
                    toast.success(`${successful.length} foto(s) subida(s). Faltan ${minPhotos - totalPhotos} para completar el paso.`);
                }

                onUploadComplete?.();
            }

            if (failed.length > 0) {
                const errorList = failed
                    .map(f => `${f.file.name}: ${f.error}`)
                    .join('\n');
                toast.error(`${failed.length} foto(s) fallaron:\n${errorList}`);
            }

        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Error al subir las fotos');
        } finally {
            setUploading(false);
        }
    };

    // Lightbox navigation
    const openLightbox = (index: number, mode: 'existing' | 'staged') => {
        setLightboxIndex(index);
        setLightboxMode(mode);
    };
    const closeLightbox = () => setLightboxIndex(null);
    
    const prevImage = () => {
        if (lightboxIndex === null) return;
        const length = lightboxMode === 'existing' ? existingMedia.length : stagedFiles.length;
        setLightboxIndex(lightboxIndex === 0 ? length - 1 : lightboxIndex - 1);
    };
    
    const nextImage = () => {
        if (lightboxIndex === null) return;
        const length = lightboxMode === 'existing' ? existingMedia.length : stagedFiles.length;
        setLightboxIndex(lightboxIndex === length - 1 ? 0 : lightboxIndex + 1);
    };

    // Status indicators
    const totalPhotos = existingMedia.length;
    const hasMinPhotos = totalPhotos >= minPhotos;
    const currentLightboxArray = lightboxMode === 'existing' ? existingMedia : stagedFiles;
    const currentLightbox = lightboxIndex !== null ? currentLightboxArray[lightboxIndex] : null;

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                            <Camera className="w-5 h-5 text-slate-600" />
                            {sectionTitle}
                        </h3>
                        <p className="text-sm text-slate-500 mt-0.5">{sectionDescription}</p>
                    </div>
                    {/* Status badge */}
                    <div className={`flex items-center gap-1 text-sm px-2 py-1 rounded-full whitespace-nowrap ${
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
                                {totalPhotos}/{minPhotos} mín.
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
                    <div className="space-y-6">
                        {/* Existing photos section */}
                        {existingMedia.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-slate-700 mb-3">
                                    Fotos subidas ({existingMedia.length})
                                </h4>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {existingMedia.map((m, index) => (
                                        <div
                                            key={m.id}
                                            className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 group cursor-pointer"
                                            onClick={() => openLightbox(index, 'existing')}
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
                                                        handleDeleteExisting(m.id);
                                                    }}
                                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Staged files section */}
                        {stagedFiles.length > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h4 className="text-sm font-medium text-blue-900 mb-3">
                                    Fotos para subir ({stagedFiles.length}) {uploading && <Loader2 className="w-4 h-4 inline animate-spin ml-2" />}
                                </h4>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
                                    {stagedFiles.map((staged, index) => (
                                        <div
                                            key={staged.id}
                                            className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 group cursor-pointer"
                                            onClick={() => openLightbox(index, 'staged')}
                                        >
                                            <img
                                                src={staged.preview}
                                                alt={`Preview ${index + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                            
                                            {/* Remove button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveStaged(staged.id);
                                                }}
                                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Upload button */}
                                <Button
                                    onClick={handleUploadStaged}
                                    disabled={uploading || stagedFiles.length === 0}
                                    className="w-full"
                                    variant="primary"
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Subiendo {stagedFiles.length} foto(s)...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4" />
                                            Subir {stagedFiles.length} foto(s)
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}

                        {/* Add photos area */}
                        {canUpload && (existingMedia.length + stagedFiles.length) < maxPhotos && (
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
                                <Plus className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                                <p className="text-sm font-medium text-slate-700">
                                    Seleccionar fotos
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {(existingMedia.length + stagedFiles.length)}/{maxPhotos} fotos · Mínimo {minPhotos}
                                </p>
                            </div>
                        )}

                        {/* Empty state */}
                        {!canUpload && existingMedia.length === 0 && stagedFiles.length === 0 && (
                            <div className="text-center py-6 text-slate-500">
                                <Camera className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                <p className="text-sm">No hay fotos registradas</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {lightboxIndex !== null && currentLightbox && (
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

                    {currentLightboxArray.length > 1 && (
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
                        src={lightboxMode === 'existing' ? (currentLightbox as MediaWithUrl).signedUrl : (currentLightbox as StagedFile).preview}
                        alt={`Foto ${lightboxIndex + 1}`}
                        className="max-w-[90vw] max-h-[90vh] object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />

                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80">
                        {lightboxIndex + 1} / {currentLightboxArray.length}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookingEvidenceUploader;
