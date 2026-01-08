import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, DollarSign, MapPin } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { itemsService } from '../services/supabaseDb';
import { useAuth } from '../context/AuthContext';

export const Publish: React.FC = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        price_day: '',
        city: '',
        image_url: '',
        category: '',
        owner_name: user?.name || '',
        owner_contact: user?.email || '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title || !formData.price_day || !formData.city) {
            alert('Por favor rellena los campos requeridos');
            return;
        }

        await itemsService.add({
            title: formData.title,
            description: formData.description,
            price_day: Number(formData.price_day),
            city: formData.city,
            image_url: formData.image_url || 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&q=80&w=800',
            category: formData.category || 'Otros',
            owner_name: isAuthenticated ? user!.name : formData.owner_name,
            owner_contact: isAuthenticated ? user!.email : formData.owner_contact,
            owner_id: user?.id,
        });

        navigate('/my-items');
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800">Publicar anuncio</h1>
                <p className="text-slate-500">Alquila lo que ya no usas y gana dinero.</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">

                {/* Basic Info */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold border-b pb-2">Información del producto</h2>

                    <Input
                        label="Título *"
                        name="title"
                        placeholder="Ej. Bicicleta de montaña"
                        required
                        value={formData.title}
                        onChange={handleChange}
                    />

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700">Descripción</label>
                        <textarea
                            name="description"
                            className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px]"
                            placeholder="Describe los detalles, estado, talla..."
                            value={formData.description}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-2">Precio / día *</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                                <input
                                    type="number"
                                    name="price_day"
                                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="0"
                                    required
                                    min="0"
                                    value={formData.price_day}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                        <Input
                            label="Ciudad *"
                            name="city"
                            placeholder="Madrid"
                            required
                            value={formData.city}
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-2">Categoría</label>
                        <select
                            name="category"
                            className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            value={formData.category}
                            onChange={handleChange}
                        >
                            <option value="">Seleccionar categoría</option>
                            <option value="Bike">Bicicletas</option>
                            <option value="Ski">Esquí / Snow</option>
                            <option value="Surf">Surf / Playa</option>
                            <option value="Paddel">Pádel / Tenis</option>
                            <option value="Audio">Audio / Foto</option>
                            <option value="Otros">Otros</option>
                        </select>
                    </div>
                </div>

                {/* Image */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold border-b pb-2">Fotos</h2>
                    <Input
                        label="URL de la imagen (MVP)"
                        name="image_url"
                        placeholder="https://..."
                        value={formData.image_url}
                        onChange={handleChange}
                    />
                    <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg p-8 text-center text-slate-500">
                        <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                        <p className="text-sm">Subida de archivos no disponible en MVP</p>
                        <p className="text-xs text-slate-400">Usa una URL externa por ahora.</p>
                    </div>
                </div>

                {/* Owner Info (if guest) */}
                {!isAuthenticated && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold border-b pb-2">Tus datos</h2>
                        <Input
                            label="Nombre"
                            name="owner_name"
                            required
                            value={formData.owner_name}
                            onChange={handleChange}
                        />
                        <Input
                            label="Contacto (WhatsApp / Email)"
                            name="owner_contact"
                            required
                            value={formData.owner_contact}
                            onChange={handleChange}
                        />
                    </div>
                )}

                <div className="pt-4">
                    <Button type="submit" className="w-full py-3 text-lg">Publicar Anuncio</Button>
                </div>

            </form>
        </div>
    );
};
