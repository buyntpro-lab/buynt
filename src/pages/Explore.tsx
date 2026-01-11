import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { ProductGrid } from '../components/common/ProductGrid';
import { itemsService } from '../services/supabaseDb';
import type { Item } from '../services/types';

export const Explore: React.FC = () => {
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    
    const searchTerm = searchParams.get('q') || '';
    const categoryFilter = searchParams.get('category') || '';
    const cityFilter = searchParams.get('city') || '';

    useEffect(() => {
        const fetchItems = async () => {
            setLoading(true);
            setError(null);
            try {
                const items = await itemsService.getAll();
                setItems(items || []);
            } catch (err) {
                console.error('Error fetching items:', err);
                setError('No pudimos cargar los productos. Por favor intenta de nuevo.');
                setItems([]);
            }
            setLoading(false);
        };
        fetchItems();
    }, []);

    // Filtrar items
    const filteredItems = items.filter((item) => {
        const matchesSearch =
            item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter ? item.category?.toLowerCase() === categoryFilter.toLowerCase() : true;
        const matchesCity = cityFilter ? item.city?.toLowerCase() === cityFilter.toLowerCase() : true;
        return matchesSearch && matchesCategory && matchesCity;
    });

    const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[];

    return (
        <div className="space-y-8">
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                    <p className="text-red-800 font-medium mb-3">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => setSearchParams({ ...Object.fromEntries(searchParams), q: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setSearchParams({})}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        !categoryFilter && !cityFilter && !searchTerm
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                >
                    Todos
                </button>

                {categories.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setSearchParams({ category: cat })}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                            categoryFilter === cat
                                ? 'bg-primary text-white shadow-md'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Results Header */}
            <div className="pt-4">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
                    {searchTerm
                        ? `Resultados para "${searchTerm}"`
                        : categoryFilter
                            ? `${categoryFilter}`
                            : 'Lo más reciente'}
                </h1>
                <p className="text-slate-600">
                    {filteredItems.length} producto{filteredItems.length !== 1 ? 's' : ''} disponible{filteredItems.length !== 1 ? 's' : ''}
                </p>
            </div>

            {/* Product Grid */}
            <ProductGrid items={filteredItems} loading={loading} onItemClick={() => {}} />
        </div>
    );
};
