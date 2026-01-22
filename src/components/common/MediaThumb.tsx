/**
 * MediaThumb Component
 * 
 * Robust thumbnail component for media with loading/error states.
 * Never renders broken image icons.
 */

import React, { useState } from 'react';
import { Image as ImageIcon, AlertCircle, RefreshCw } from 'lucide-react';

interface MediaThumbProps {
    url?: string;
    alt?: string;
    isLoading?: boolean;
    error?: string;
    onClick?: () => void;
    onRetry?: () => void;
    className?: string;
}

export const MediaThumb: React.FC<MediaThumbProps> = ({
    url,
    alt = 'Media',
    isLoading = false,
    error,
    onClick,
    onRetry,
    className = '',
}) => {
    const [imgError, setImgError] = useState(false);
    const [imgLoading, setImgLoading] = useState(true);

    // Reset error state when URL changes
    React.useEffect(() => {
        setImgError(false);
        setImgLoading(true);
    }, [url]);

    const handleImageError = () => {
        console.error('❌ Image failed to load:', url);
        setImgError(true);
        setImgLoading(false);
    };

    const handleImageLoad = () => {
        setImgLoading(false);
    };

    const handleRetry = (e: React.MouseEvent) => {
        e.stopPropagation();
        setImgError(false);
        setImgLoading(true);
        onRetry?.();
    };

    // Loading skeleton
    if (isLoading || (imgLoading && url && !imgError)) {
        return (
            <div 
                className={`relative bg-slate-100 rounded-lg flex items-center justify-center ${className}`}
                style={{ aspectRatio: '1/1' }}
            >
                <div className="animate-pulse flex flex-col items-center gap-2">
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                    <div className="text-xs text-slate-400">Cargando...</div>
                </div>
            </div>
        );
    }

    // Error or no URL
    if (!url || imgError || error) {
        return (
            <div 
                className={`relative bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center ${className}`}
                style={{ aspectRatio: '1/1' }}
            >
                <div className="flex flex-col items-center gap-2 p-2">
                    <AlertCircle className="w-6 h-6 text-slate-400" />
                    <div className="text-xs text-slate-500 text-center">
                        {error || 'No disponible'}
                    </div>
                    {onRetry && (
                        <button
                            onClick={handleRetry}
                            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-1"
                        >
                            <RefreshCw className="w-3 h-3" />
                            Reintentar
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Valid image
    return (
        <div 
            className={`relative rounded-lg overflow-hidden ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-indigo-400' : ''} ${className}`}
            onClick={onClick}
            style={{ aspectRatio: '1/1' }}
        >
            <img
                src={url}
                alt={alt}
                onError={handleImageError}
                onLoad={handleImageLoad}
                className="w-full h-full object-cover"
            />
        </div>
    );
};
