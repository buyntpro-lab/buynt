import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, PlusCircle, Pencil } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { itemsService } from '../services/supabaseDb';
import { useAuth } from '../context/AuthContext';
import type { Item } from '../services/types';

export const MyItems: React.FC = () => {
    const { user, isAuthenticated } = useAuth();
    const [items, setItems] = useState<Item[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        loadItems();
    }, [user]);

    const loadItems = async () => {
        if (isAuthenticated && user) {
            const myItems = await itemsService.getByUserId(user.id);
            setItems(myItems);
        } else {
            setItems([]);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('¿Estás seguro de borrar este anuncio?')) {
            await itemsService.delete(id);
            loadItems();
        }
    };

    const handleEdit = (id: string) => {
        navigate(`/item/${id}/editar`);
    };

    return (
        <div className="max-w-4xl mx-auto md:py-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-slate-800">Mis Anuncios</h1>
                <Link to="/publish">
                    <Button>Publicar Nuevo</Button>
                </Link>
            </div>

            {!isAuthenticated && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6 text-yellow-800">
                    Debes iniciar sesión para ver tus anuncios permanentemente.
                </div>
            )}

            {items.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
                    <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <PlusCircle className="w-8 h-8 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No has publicado nada aún</h3>
                    <p className="text-gray-500 mb-6">Empieza a ganar dinero alquilando tus cosas.</p>
                    <Link to="/publish">
                        <Button className="bg-primary hover:bg-primary-dark text-white rounded-full px-8">Empezar a publicar</Button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map(item => (
                        <div key={item.id} className="relative group">
                            <div 
                                onClick={() => navigate(`/item/${item.id}`)}
                                className="block cursor-pointer"
                            >
                                <Card className="h-full hover:shadow-md transition-shadow">
                                    <div className="aspect-video w-full overflow-hidden bg-slate-100 border-b border-gray-100">
                                        <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-bold text-slate-800 mb-1">{item.title}</h3>
                                        <p className="text-indigo-600 font-semibold">{item.price_day}€ <span className="text-slate-400 font-normal">/día</span></p>
                                    </div>
                                </Card>
                            </div>
                            <div className="absolute top-2 right-2 flex gap-2">
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleEdit(item.id);
                                    }}
                                    className="p-2 bg-white/90 backdrop-blur rounded-full shadow-sm text-primary hover:bg-primary hover:text-white transition-colors"
                                    title="Editar artículo"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDelete(item.id);
                                    }}
                                    className="p-2 bg-white/90 backdrop-blur rounded-full shadow-sm text-red-500 hover:bg-red-50 transition-colors"
                                    title="Eliminar artículo"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
