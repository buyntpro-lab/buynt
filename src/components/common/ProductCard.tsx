import React, { useState } from 'react';
import { MapPin, Star, Heart, ImageOff } from 'lucide-react';
import { Link } from 'react-router-dom';

// Placeholder image for items without photos
const PLACEHOLDER_IMAGE = '/placeholder-item.svg';

interface ProductCardProps {
    id: string;
    image: string;
    title: string;
    price: number;
    city: string;
    category?: string;
    description?: string;
    rating?: number;
    reviews?: number;
    isFavorite?: boolean;
    onFavoriteClick?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
    id,
    image,
    title,
    price,
    city,
    category,
    description,
    rating = 4.5,
    reviews = 0,
    isFavorite = false,
    onFavoriteClick,
}) => {
    const [imageError, setImageError] = useState(false);
    
    // Use fallback if image is empty or failed to load
    const displayImage = (!image || imageError) ? PLACEHOLDER_IMAGE : image;
    const showPlaceholder = !image || imageError;

    return (
        <Link to={`/item/${id}`} className="block group h-full">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full flex flex-col">
                
                {/* Image Container */}
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                    {showPlaceholder && !image ? (
                        <div className="w-full h-full flex items-center justify-center bg-slate-200">
                            <ImageOff className="w-12 h-12 text-slate-400" />
                        </div>
                    ) : (
                        <img
                            src={displayImage}
                            alt={title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            onError={() => setImageError(true)}
                            loading="lazy"
                        />
                    )}

                    {/* Category Badge */}
                    {category && (
                        <div className="absolute top-3 left-3">
                            <div className="bg-white text-slate-900 shadow-md px-2 py-1 rounded text-sm font-medium">
                                {category}
                            </div>
                        </div>
                    )}

                    {/* Price Badge */}
                    <div className="absolute bottom-3 left-3 bg-gradient-to-r from-indigo-600 to-teal-600 text-white px-3 py-1 rounded-lg text-sm font-bold shadow-lg">
                        ${price} / día
                    </div>

                    {/* Favorite Button */}
                    {onFavoriteClick && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                onFavoriteClick();
                            }}
                            className="absolute top-3 right-3 bg-white rounded-full p-2 shadow-md hover:bg-slate-100 transition-all group/heart"
                        >
                            <Heart
                                className={`w-5 h-5 transition-colors ${
                                    isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-400'
                                }`}
                            />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col gap-3 flex-1">
                    
                    {/* Title */}
                    <h3 className="text-slate-900 font-semibold line-clamp-2 group-hover:text-indigo-600 transition-colors leading-snug">
                        {title}
                    </h3>

                    {/* Description (optional) */}
                    {description && (
                        <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                            {description}
                        </p>
                    )}

                    {/* Rating */}
                    {rating > 0 && (
                        <div className="flex items-center gap-2 text-xs">
                            <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                    <Star
                                        key={i}
                                        className={`w-3 h-3 ${
                                            i < Math.floor(rating)
                                                ? 'fill-yellow-400 text-yellow-400'
                                                : 'text-slate-300'
                                        }`}
                                    />
                                ))}
                            </div>
                            <span className="text-slate-600 font-medium">{rating}</span>
                            {reviews > 0 && (
                                <span className="text-slate-500">({reviews})</span>
                            )}
                        </div>
                    )}

                    {/* Location */}
                    <div className="flex items-center gap-1 text-xs text-slate-600 mt-auto pt-2 border-t border-slate-100">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{city}</span>
                    </div>
                </div>
            </div>
        </Link>
    );
};
