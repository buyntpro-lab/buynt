/**
 * MediaThumb Component (Optimized)
 * 
 * Tile individual de miniatura con:
 * - Render instantáneo (placeholder)
 * - Lazy load de URL cuando entra en viewport (IntersectionObserver)
 * - Retry automático si falla
 * - Botón eliminar siempre visible
 * - Sin estado global bloqueante
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AlertCircle, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { createSignedUrlSafe } from '../../lib/storage';

export interface MediaThumbProps {
    media: {
        id: string;
        bucket?: string;
        path: string;
        created_at?: string;
        uploaded_by?: string;
    };
    onDelete?: (mediaId: string) => Promise<void>;
    onClick?: () => void;
    isDeletable?: boolean;
    size?: 'grid' | 'viewer';
    className?: string;
}

type LoadState = 'idle' | 'signing' | 'loading' | 'loaded' | 'error' | 'deleting';

const LOAD_TIMEOUT_MS = 6000;

export const MediaThumb: React.FC<MediaThumbProps> = ({
    media,
    onDelete,
    onClick,
    isDeletable = false,
    size = 'grid',
    className = '',
}) => {
    const [state, setState] = useState<LoadState>('idle');
    const [url, setUrl] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const imgRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout>();
    const observerRef = useRef<IntersectionObserver>();
    const retryCountRef = useRef(0);
    const MAX_RETRIES = 2;

    // Limpia timeout
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, []);

    // Firmar URL (lazy triggered)
    const startLoad = useCallback(async () => {
        if (state !== 'idle' && state !== 'error') {
            return; // Ya está cargando o cargado
        }

        setState('signing');
        setError('');

        try {
            const bucket = media.bucket || 'booking-proof-private';

            // Timeout de seguridad
            timeoutRef.current = setTimeout(() => {
                if (state === 'signing' || state === 'loading') {
                    setState('error');
                    setError('Timeout al cargar imagen');
                }
            }, LOAD_TIMEOUT_MS);

            const result = await createSignedUrlSafe(bucket, media.path);

            clearTimeout(timeoutRef.current!);

            if (result.ok && result.url) {
                setUrl(result.url);
                setState('loading');
            } else {
                setState('error');
                setError(result.error || 'No se pudo firmar URL');
            }
        } catch (err) {
            clearTimeout(timeoutRef.current!);
            setState('error');
            setError('Error al firmar URL');
            console.error('Load error:', err);
        }
    }, [media, state]);

    // Retry
    const handleRetry = useCallback(() => {
        if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current++;
            setState('idle');
            setUrl('');
            setError('');
            startLoad();
        } else {
            setError('Máximos intentos alcanzados');
        }
    }, [startLoad]);

    // Eliminar foto - solo llama al callback, el padre se encarga del storage y DB
    const handleDelete = useCallback(async () => {
        if (!onDelete) return;
        
        setState('deleting');
        try {
            await onDelete(media.id);
            setShowDeleteConfirm(false);
        } catch (err) {
            setState('error');
            setError(
                `Error al eliminar: ${err instanceof Error ? err.message : 'Unknown'}`
            );
            console.error('Delete error:', err);
        }
    }, [media.id, onDelete]);

    // Image loaded
    const handleImageLoad = useCallback(() => {
        clearTimeout(timeoutRef.current!);
        setState('loaded');
    }, []);

    // Image error
    const handleImageError = useCallback(() => {
        clearTimeout(timeoutRef.current!);
        setState('error');
        setError('Fallo al cargar imagen');
    }, []);

    // IntersectionObserver para lazy loading
    useEffect(() => {
        if (!containerRef.current) return;

        observerRef.current = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && state === 'idle') {
                    startLoad();
                }
            },
            { threshold: 0.01 }
        );

        observerRef.current.observe(containerRef.current);

        return () => {
            observerRef.current?.disconnect();
        };
    }, [startLoad, state]);

    // Estilos según tamaño
    const sizeClasses =
        size === 'grid' ? 'w-full aspect-square' : 'w-full max-h-96';

    // === RENDER ===

    // Estado: Cargando (skeleton)
    if ((state === 'idle' || state === 'signing') && !url) {
        return (
            <div
                ref={containerRef}
                className={`relative bg-slate-100 rounded-lg flex items-center justify-center ${sizeClasses} ${className}`}
            >
                <div className="animate-pulse flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                    <div className="text-xs text-slate-400">Preparando...</div>
                </div>

                {/* Delete overlay */}
                {isDeletable && (
                    <DeleteOverlay
                        showConfirm={showDeleteConfirm}
                        onConfirm={handleDelete}
                        onCancel={() => setShowDeleteConfirm(false)}
                        onTrigger={() => setShowDeleteConfirm(true)}
                    />
                )}
            </div>
        );
    }

    // Estado: Error
    if (state === 'error') {
        return (
            <div
                ref={containerRef}
                className={`relative bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center ${sizeClasses} ${className}`}
            >
                <div className="flex flex-col items-center gap-2 p-2 text-center">
                    <AlertCircle className="w-6 h-6 text-slate-400" />
                    <div className="text-xs text-slate-500 line-clamp-2">
                        {error || 'No disponible'}
                    </div>
                    {retryCountRef.current < MAX_RETRIES && (
                        <button
                            onClick={handleRetry}
                            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-1"
                        >
                            <RefreshCw className="w-3 h-3" />
                            Reintentar
                        </button>
                    )}
                </div>

                {/* Delete overlay */}
                {isDeletable && (
                    <DeleteOverlay
                        showConfirm={showDeleteConfirm}
                        onConfirm={handleDelete}
                        onCancel={() => setShowDeleteConfirm(false)}
                        onTrigger={() => setShowDeleteConfirm(true)}
                    />
                )}
            </div>
        );
    }

    // Estado: Cargando imagen
    if (state === 'loading' && url) {
        return (
            <div
                ref={containerRef}
                onClick={onClick}
                className={`relative bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden ${sizeClasses} ${className} ${onClick ? 'cursor-pointer' : ''}`}
            >
                <img
                    ref={imgRef}
                    src={url}
                    alt={`Media ${media.id}`}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                />

                {/* Spinner while loading */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>

                {/* Delete overlay */}
                {isDeletable && (
                    <DeleteOverlay
                        showConfirm={showDeleteConfirm}
                        onConfirm={handleDelete}
                        onCancel={() => setShowDeleteConfirm(false)}
                        onTrigger={() => setShowDeleteConfirm(true)}
                    />
                )}
            </div>
        );
    }

    // Estado: Cargado
    if (state === 'loaded' && url) {
        return (
            <div
                ref={containerRef}
                onClick={onClick}
                className={`relative bg-slate-50 rounded-lg overflow-hidden ${sizeClasses} ${className} group ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-indigo-400' : ''}`}
            >
                <img
                    ref={imgRef}
                    src={url}
                    alt={`Media ${media.id}`}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                />

                {/* Delete overlay */}
                {isDeletable && (
                    <DeleteOverlay
                        showConfirm={showDeleteConfirm}
                        onConfirm={handleDelete}
                        onCancel={() => setShowDeleteConfirm(false)}
                        onTrigger={() => setShowDeleteConfirm(true)}
                    />
                )}
            </div>
        );
    }

    // Fallback (shouldn't reach here)
    return (
        <div
            className={`relative bg-slate-200 rounded-lg flex items-center justify-center ${sizeClasses} ${className}`}
        >
            <span className="text-xs text-slate-400">Error</span>
        </div>
    );
};

// ============================================================================
// DeleteOverlay Subcomponent
// ============================================================================

interface DeleteOverlayProps {
    showConfirm: boolean;
    onTrigger: () => void;
    onConfirm: () => void;
    onCancel: () => void;
}

const DeleteOverlay: React.FC<DeleteOverlayProps> = ({
    showConfirm,
    onTrigger,
    onConfirm,
    onCancel,
}) => {
    // Stop propagation to prevent opening the viewer when clicking delete
    const handleTrigger = (e: React.MouseEvent) => {
        e.stopPropagation();
        onTrigger();
    };

    const handleConfirm = (e: React.MouseEvent) => {
        e.stopPropagation();
        onConfirm();
    };

    const handleCancel = (e: React.MouseEvent) => {
        e.stopPropagation();
        onCancel();
    };

    if (showConfirm) {
        return (
            <div 
                className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg z-50"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-white rounded p-3 flex flex-col gap-2 text-center text-sm">
                    <div className="font-medium text-slate-900">¿Eliminar foto?</div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleCancel}
                            className="flex-1 px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs hover:bg-slate-300"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="flex-1 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                        >
                            Eliminar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <button
            onClick={handleTrigger}
            className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-40 hover:bg-red-700"
            title="Eliminar foto"
        >
            <Trash2 className="w-4 h-4" />
        </button>
    );
};
