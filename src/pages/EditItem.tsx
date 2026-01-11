import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShieldX } from 'lucide-react';
import { ProductForm } from '../components/common/ProductForm';
import type { ProductFormData } from '../components/common/ProductForm';
import { itemsService } from '../services/supabaseDb';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import type { Item } from '../services/types';
import toast from 'react-hot-toast';

export const EditItem: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    
    const [item, setItem] = useState<Item | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<'not-found' | 'unauthorized' | null>(null);

    // Load item data
    useEffect(() => {
        const loadItem = async () => {
            if (!id) {
                setError('not-found');
                setLoading(false);
                return;
            }

            try {
                const fetchedItem = await itemsService.getById(id);
                
                if (!fetchedItem) {
                    setError('not-found');
                    setLoading(false);
                    return;
                }

                // Check ownership
                if (fetchedItem.owner_id !== user?.id) {
                    console.warn('⛔ Unauthorized: user is not the owner of this item');
                    setError('unauthorized');
                    setLoading(false);
                    return;
                }

                setItem(fetchedItem);
            } catch (err) {
                console.error('Error loading item:', err);
                setError('not-found');
            } finally {
                setLoading(false);
            }
        };

        if (isAuthenticated && user) {
            loadItem();
        } else if (!isAuthenticated) {
            // Redirect to login if not authenticated
            navigate('/login', { state: { from: `/item/${id}/editar` } });
        }
    }, [id, user, isAuthenticated, navigate]);

    const handleSubmit = async (formData: ProductFormData) => {
        if (!id || !item) return;

        setSaving(true);
        try {
            const updates = {
                title: formData.title,
                description: formData.description,
                price_day: Number(formData.price_day),
                city: formData.city,
                image_url: formData.image_url || 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&q=80&w=800',
                category: formData.category || 'Otros',
                owner_name: formData.owner_name,
                owner_contact: formData.owner_contact,
            };

            const updatedItem = await itemsService.update(id, updates);
            
            if (!updatedItem) {
                toast.error('Error al guardar los cambios');
                return;
            }

            toast.success('¡Cambios guardados correctamente!');
            
            // Navigate to item detail
            setTimeout(() => {
                navigate(`/item/${id}`);
            }, 500);
        } catch (err: any) {
            console.error('Error updating item:', err);
            toast.error(err.message || 'Error al guardar los cambios');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        navigate(-1);
    };

    // Loading state
    if (loading) {
        return (
            <div className="max-w-2xl mx-auto py-8">
                <div className="animate-pulse">
                    <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/2 mb-8"></div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="space-y-4">
                            <div className="h-10 bg-slate-200 rounded"></div>
                            <div className="h-24 bg-slate-200 rounded"></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="h-10 bg-slate-200 rounded"></div>
                                <div className="h-10 bg-slate-200 rounded"></div>
                            </div>
                            <div className="h-10 bg-slate-200 rounded"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Not found state
    if (error === 'not-found') {
        return (
            <div className="max-w-2xl mx-auto py-16 text-center">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                    <h1 className="text-2xl font-bold text-slate-800 mb-4">Artículo no encontrado</h1>
                    <p className="text-slate-500 mb-6">
                        El artículo que buscas no existe o ha sido eliminado.
                    </p>
                    <Link to="/my-items">
                        <Button>Volver a Mis Artículos</Button>
                    </Link>
                </div>
            </div>
        );
    }

    // Unauthorized state
    if (error === 'unauthorized') {
        return (
            <div className="max-w-2xl mx-auto py-16 text-center">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldX className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-4">No autorizado</h1>
                    <p className="text-slate-500 mb-6">
                        No tienes permiso para editar este artículo. Solo el propietario puede modificarlo.
                    </p>
                    <div className="flex gap-4 justify-center">
                        <Link to="/explorar">
                            <Button variant="outline">Explorar artículos</Button>
                        </Link>
                        <Link to="/my-items">
                            <Button>Mis Artículos</Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Prepare initial values for form
    const initialValues: ProductFormData = {
        title: item?.title || '',
        description: item?.description || '',
        price_day: item?.price_day?.toString() || '',
        city: item?.city || '',
        image_url: item?.image_url || '',
        category: item?.category || '',
        owner_name: item?.owner_name || user?.full_name || '',
        owner_contact: item?.owner_contact || user?.email || '',
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            {/* Header */}
            <div className="mb-8">
                <button 
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Volver</span>
                </button>
                <h1 className="text-3xl font-bold text-slate-800">Editar artículo</h1>
                <p className="text-slate-500">Modifica los detalles de tu anuncio.</p>
            </div>

            {/* Form */}
            <ProductForm
                initialValues={initialValues}
                onSubmit={handleSubmit}
                submitLabel="Guardar cambios"
                loading={saving}
                onCancel={handleCancel}
            />
        </div>
    );
};
