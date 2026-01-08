import React, { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { itemsService } from '../services/supabaseDb';
import type { Item } from '../services/types';

export const Home: React.FC = () => {
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchParams] = useSearchParams();
    const searchTerm = searchParams.get('q') || '';
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

    useEffect(() => {
        const fetchItems = async () => {
            setLoading(true);
            const allItems = await itemsService.getAll();
            setItems(allItems);
            setLoading(false);
        };
        fetchItems();
    }, []);

    const filteredItems = items.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter ? item.category === categoryFilter : true;
        return matchesSearch && matchesCategory;
    });

    const categories = Array.from(new Set(items.map(i => i.category).filter(Boolean))) as string[];

    return (
        <div className="flex flex-col gap-6">

            {/* Category Filter / Hero Lite */}
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-800">Categorías</h2>
                    <button
                        onClick={() => setCategoryFilter(null)}
                        className="text-sm text-primary hover:underline"
                    >
                        Ver todas
                    </button>
                </div>

                <div className="flex overflow-x-auto gap-3 pb-4 scrollbar-hide">
                    <button
                        className={`px-6 py-3 rounded-full whitespace-nowrap text-sm font-medium transition-all shadow-sm ${!categoryFilter ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}
                        onClick={() => setCategoryFilter(null)}
                    >
                        Todo
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            className={`px-6 py-3 rounded-full whitespace-nowrap text-sm font-medium transition-all shadow-sm ${categoryFilter === cat ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}
                            onClick={() => setCategoryFilter(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Grid */}
            <div className="mt-4">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">
                    {searchTerm ? `Resultados para "${searchTerm}"` : 'Lo más reciente'}
                </h1>

                {loading ? (
                    <div className="text-center py-20">
                        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                        <p className="text-gray-500 mt-4">Cargando productos...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
                        <div className="max-w-md mx-auto">
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No encontramos nada</h3>
                            <p className="text-gray-500">Intenta buscar con otras palabras o navega por las categorías.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                        {filteredItems.map(item => (
                            <Link key={item.id} to={`/item/${item.id}`} className="block group">
                                <Card className="h-full hover:-translate-y-1 hover:shadow-lg transition-all duration-300 border-gray-100">
                                    <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100 relative">
                                        <img
                                            src={item.image_url}
                                            alt={item.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                        <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-semibold text-gray-900 shadow-sm">
                                            {item.price_day}€ / día
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <h3 className="text-gray-900 font-medium line-clamp-2 leading-relaxed mb-1 group-hover:text-primary transition-colors">
                                            {item.title}
                                        </h3>
                                        <div className="flex items-center text-xs text-gray-500 mt-2">
                                            <MapPin className="w-3 h-3 mr-1" />
                                            {item.city}
                                        </div>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
