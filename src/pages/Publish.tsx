import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Loader2 } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { ImageUploader, type ImageFile } from '../components/upload/ImageUploader';
import { itemsService } from '../services/supabaseDb';
import { itemImagesService } from '../services/itemImagesService';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export const Publish: React.FC = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<string>('');

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        price_day: '',
        city: '',
        image_url: '', // Fallback for legacy mode
        category: '',
        owner_name: user?.full_name || '',
        owner_contact: user?.email || '',
    });

    // Images state (new storage-based system)
    const [images, setImages] = useState<ImageFile[]>([]);
    const [useLegacyUrl, setUseLegacyUrl] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Validate required fields
            if (!formData.title || !formData.price_day || !formData.city) {
                toast.error('Por favor rellena los campos requeridos (Título, Precio, Ciudad)');
                setLoading(false);
                return;
            }

            // Validate images (at least 1 image or legacy URL)
            if (images.length === 0 && !formData.image_url && !useLegacyUrl) {
                toast.error('Por favor añade al menos una foto');
                setLoading(false);
                return;
            }

            console.log('📝 Intentando publicar producto:', {
                title: formData.title,
                price_day: formData.price_day,
                city: formData.city,
                images: images.length,
                user_id: user?.id,
            });

            // Determine image_url for item record
            // If using new upload system, leave empty (will be populated from item_images)
            // If using legacy URL, use that
            const imageUrl = useLegacyUrl || images.length === 0
                ? formData.image_url || 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&q=80&w=800'
                : ''; // Will be updated after images are uploaded

            // Create the item first
            const newItem = await itemsService.add({
                title: formData.title,
                description: formData.description,
                price_day: Number(formData.price_day),
                city: formData.city,
                image_url: imageUrl,
                category: formData.category || 'Otros',
                owner_name: isAuthenticated ? user!.full_name || 'Usuario' : formData.owner_name,
                owner_contact: isAuthenticated ? user!.email : formData.owner_contact,
                owner_id: user?.id || '',
            });

            if (!newItem) {
                toast.error('Error al publicar el anuncio. Por favor intenta de nuevo.');
                setLoading(false);
                return;
            }

            console.log('✅ Item creado:', newItem.id);

            // Upload images if using new system
            if (images.length > 0 && !useLegacyUrl) {
                setUploadProgress('Subiendo imágenes...');
                
                // Mark images as uploading
                setImages(prev => prev.map(img => ({ ...img, isUploading: true })));

                // Upload images one by one with progress
                const uploadedImages = [];
                const errors = [];

                for (let i = 0; i < images.length; i++) {
                    const img = images[i];
                    setUploadProgress(`Subiendo imagen ${i + 1} de ${images.length}...`);
                    
                    const result = await itemImagesService.upload(newItem.id, img.file, {
                        isCover: img.isCover,
                        sort: i,
                    });

                    if (result.success && result.image) {
                        uploadedImages.push(result.image);
                        // Update UI to show success
                        setImages(prev => prev.map((prevImg, idx) => 
                            idx === i ? { ...prevImg, isUploading: false } : prevImg
                        ));
                    } else {
                        errors.push(`Imagen ${i + 1}: ${result.error}`);
                        setImages(prev => prev.map((prevImg, idx) => 
                            idx === i ? { ...prevImg, isUploading: false, error: result.error } : prevImg
                        ));
                    }
                }

                if (errors.length > 0) {
                    console.warn('⚠️ Some images failed to upload:', errors);
                    toast.error(`${errors.length} imagen(es) no se pudieron subir`);
                }

                // If we have at least one uploaded image, update item with cover URL
                if (uploadedImages.length > 0) {
                    const cover = uploadedImages.find(img => img.is_cover) || uploadedImages[0];
                    const coverUrl = itemImagesService.getUrl(cover.path, 'full');
                    
                    await itemsService.update(newItem.id, { image_url: coverUrl });
                    console.log('✅ Item cover URL updated');
                }
            }

            console.log('✅ Producto publicado exitosamente');
            toast.success('¡Anuncio publicado correctamente!');

            // Redirect to My Items
            setTimeout(() => {
                navigate('/my-items');
            }, 500);

        } catch (error: any) {
            console.error('❌ Error al publicar:', error);
            toast.error(error.message || 'Error inesperado al publicar el anuncio');
        } finally {
            setLoading(false);
            setUploadProgress('');
        }
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

                {/* Photos Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h2 className="text-lg font-semibold">Fotos</h2>
                        <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={useLegacyUrl}
                                onChange={(e) => setUseLegacyUrl(e.target.checked)}
                                className="rounded border-slate-300"
                            />
                            Usar URL externa
                        </label>
                    </div>

                    {useLegacyUrl ? (
                        // Legacy URL input
                        <div className="space-y-2">
                            <Input
                                label="URL de la imagen"
                                name="image_url"
                                placeholder="https://..."
                                value={formData.image_url}
                                onChange={handleChange}
                            />
                            <p className="text-xs text-slate-500">
                                Pega la URL de una imagen externa (Unsplash, Imgur, etc.)
                            </p>
                        </div>
                    ) : (
                        // New image uploader
                        <ImageUploader
                            images={images}
                            onImagesChange={setImages}
                            maxImages={8}
                            maxFileSize={5}
                            disabled={loading}
                        />
                    )}
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

                {/* Submit */}
                <div className="pt-4">
                    <Button 
                        type="submit" 
                        className="w-full py-3 text-lg"
                        disabled={loading}
                    >
                        {loading ? (
                            <div className="flex items-center justify-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                {uploadProgress || 'Publicando...'}
                            </div>
                        ) : (
                            'Publicar Anuncio'
                        )}
                    </Button>
                </div>

            </form>
        </div>
    );
};
