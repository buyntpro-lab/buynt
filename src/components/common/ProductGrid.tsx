import React, { useState } from 'react';
import { List, Grid3X3 } from 'lucide-react';
import { ProductCard } from './ProductCard';
import type { Item } from '../../services/types';

interface ProductGridProps {
    items: Item[];
    loading?: boolean;
    onItemClick?: (id: string) => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
    items,
    loading = false,
    onItemClick,
}) => {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    if (loading) {
        return (
            <div className="text-center py-20">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="text-slate-500 mt-4">Cargando productos...</p>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-100">
                <div className="max-w-md mx-auto">
                    <svg
                        className="mx-auto mb-4 w-16 h-16 text-slate-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                        />
                    </svg>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        Sin resultados
                    </h3>
                    <p className="text-slate-500">
                        No encontramos productos que coincidan con tu búsqueda. Intenta con otros términos.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* View Mode Toggle */}
            <div className="flex items-center justify-end gap-2">
                <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-all ${
                        viewMode === 'grid'
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title="Vista en cuadrícula"
                >
                    <Grid3X3 className="w-5 h-5" />
                </button>
                <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-all ${
                        viewMode === 'list'
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title="Vista en lista"
                >
                    <List className="w-5 h-5" />
                </button>
            </div>

            {/* Grid View */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                    {items.map((item) => (
                        <ProductCard
                            key={item.id}
                            id={item.id}
                            image={item.image_url}
                            title={item.title}
                            price={item.price_day}
                            city={item.city}
                            category={item.category}
                            description={item.description}
                            rating={4.5}
                            reviews={0}
                            onFavoriteClick={() => onItemClick?.(item.id)}
                        />
                    ))}
                </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
                <div className="space-y-4">
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className="bg-white rounded-2xl border border-slate-200 p-4 flex gap-4 hover:shadow-lg transition-all cursor-pointer group"
                            onClick={() => onItemClick?.(item.id)}
                        >
                            {/* Image */}
                            <div className="w-32 h-32 flex-shrink-0 bg-slate-100 rounded-xl overflow-hidden">
                                <img
                                    src={item.image_url}
                                    alt={item.title}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                />
                            </div>

                            {/* Content */}
                            <div className="flex-1 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors mb-1">
                                                {item.title}
                                            </h3>
                                            <p className="text-sm text-slate-600 line-clamp-2">
                                                {item.description}
                                            </p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-2xl font-bold text-indigo-600">
                                                ${item.price_day}
                                            </div>
                                            <p className="text-xs text-slate-500">por día</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4">
                                    <div className="flex items-center gap-4 text-sm text-slate-600">
                                        <span className="inline-block">📍 {item.city}</span>
                                        {item.category && (
                                            <span className="inline-block px-2 py-1 bg-slate-100 rounded text-xs font-medium">
                                                {item.category}
                                            </span>
                                        )}
                                    </div>
                                    <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                                        Ver detalles
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
