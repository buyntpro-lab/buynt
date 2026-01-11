import React from 'react';
import { DollarSign, Upload } from 'lucide-react';
import { Input } from './Input';

export interface ProductFormData {
    title: string;
    description: string;
    price_day: string;
    city: string;
    image_url: string;
    category: string;
    owner_name: string;
    owner_contact: string;
}

interface ProductFormProps {
    initialValues: ProductFormData;
    onSubmit: (data: ProductFormData) => Promise<void>;
    submitLabel: string;
    loading: boolean;
    onCancel?: () => void;
}

const CATEGORIES = [
    'Fotografía',
    'Deportes', 
    'Herramientas',
    'Electrónica',
    'Outdoor',
    'Música',
    'Vehículos',
    'Hogar',
    'Otros'
];

export const ProductForm: React.FC<ProductFormProps> = ({
    initialValues,
    onSubmit,
    submitLabel,
    loading,
    onCancel
}) => {
    const [formData, setFormData] = React.useState<ProductFormData>(initialValues);

    // Update form when initialValues change (for edit mode after load)
    React.useEffect(() => {
        setFormData(initialValues);
    }, [initialValues]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit(formData);
    };

    return (
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
                        className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
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
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-primary"
                                placeholder="0"
                                required
                                min="1"
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
                        value={formData.category}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-primary bg-white"
                    >
                        <option value="">Selecciona una categoría</option>
                        {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Image Section */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold border-b pb-2">Imagen</h2>

                <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">URL de imagen</label>
                    <div className="relative">
                        <Upload className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                        <input
                            type="url"
                            name="image_url"
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-primary"
                            placeholder="https://..."
                            value={formData.image_url}
                            onChange={handleChange}
                        />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Pega la URL de una imagen. Si no proporcionas una, usaremos una imagen por defecto.
                    </p>
                </div>

                {/* Image Preview */}
                {formData.image_url && (
                    <div className="mt-4">
                        <p className="text-sm font-medium text-slate-700 mb-2">Vista previa:</p>
                        <div className="w-full max-w-xs aspect-video rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                            <img 
                                src={formData.image_url} 
                                alt="Vista previa"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&q=80&w=800';
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-4">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-3 px-6 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
                    >
                        Cancelar
                    </button>
                )}
                <button
                    type="submit"
                    disabled={loading}
                    className={`flex-1 py-3 px-6 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${onCancel ? '' : 'w-full'}`}
                >
                    {loading ? 'Guardando...' : submitLabel}
                </button>
            </div>
        </form>
    );
};
