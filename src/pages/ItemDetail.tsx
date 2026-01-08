import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, MapPin, Calendar, MessageSquare, Check, User } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { itemsService, requestsService } from '../services/supabaseDb';
import { useAuth } from '../context/AuthContext';
import type { Item } from '../services/types';

export const ItemDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const [item, setItem] = useState<Item | undefined>(undefined);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

    // Form State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [message, setMessage] = useState('');
    const [requesterName, setRequesterName] = useState('');
    const [requesterContact, setRequesterContact] = useState('');

    useEffect(() => {
        const fetchItem = async () => {
            if (id) {
                const foundItem = await itemsService.getById(id);
                setItem(foundItem || undefined);
            }
        };
        fetchItem();
    }, [id]);

    useEffect(() => {
        if (user) {
            setRequesterName(user.name);
            setRequesterContact(user.email);
        }
    }, [user]);

    if (!item) {
        return <div className="p-8 text-center">Loading or Item not found...</div>;
    }

    const handleRequestSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const finalName = isAuthenticated ? user!.name : requesterName;
        const finalContact = isAuthenticated ? user!.email : requesterContact;

        if (!startDate || !endDate || !finalName || !finalContact) {
            alert('Por favor rellena los campos requeridos');
            return;
        }

        await requestsService.add({
            item_id: item.id,
            requester_name: finalName,
            requester_contact: finalContact,
            start_date: startDate,
            end_date: endDate,
            message: message
        });

        setIsRequestModalOpen(false);
        navigate(isAuthenticated ? '/my-requests' : '/');
        if (!isAuthenticated) alert('Solicitud enviada! Contactaremos contigo pronto.');
    };

    return (
        <div className="max-w-5xl mx-auto md:py-8 animate-in fade-in duration-300">

            {/* Back Button (Mobile) */}
            <div className="md:hidden sticky top-16 z-10 bg-white/80 backdrop-blur-md p-4 border-b">
                <button onClick={() => navigate(-1)} className="flex items-center text-slate-600 font-medium">
                    <ArrowLeft className="w-5 h-5 mr-1" /> Volver
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                {/* Gallery / Image */}
                <div className="h-[300px] md:h-[500px] bg-slate-100 rounded-none md:rounded-3xl overflow-hidden shadow-sm border border-slate-100 relative group">
                    <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur rounded-full p-2 shadow-sm cursor-pointer hover:bg-white transition-colors">
                        <Share2 className="w-5 h-5 text-slate-700" />
                    </div>
                </div>

                {/* Info */}
                <div className="p-4 md:p-0 flex flex-col gap-6">
                    <div>
                        <div className="flex justify-between items-start">
                            <h1 className="text-3xl font-bold text-slate-900 mb-2">{item.title}</h1>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-indigo-600">{item.price_day}€</div>
                                <div className="text-xs text-slate-500">por día</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-slate-500 text-sm mb-6">
                            <span className="flex items-center"><MapPin className="w-4 h-4 mr-1" /> {item.city}</span>
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 border border-slate-200">{item.category}</span>
                        </div>
                    </div>

                    <div className="prose prose-slate text-slate-600 leading-relaxed">
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">Descripción</h3>
                        <p>{item.description}</p>
                    </div>

                    <div className="border-t border-b border-gray-100 py-6 flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl">
                            {item.owner_name.charAt(0)}
                        </div>
                        <div>
                            <div className="text-sm text-slate-500">Propietario</div>
                            <div className="font-semibold text-slate-900">{item.owner_name}</div>
                        </div>
                        <div className="ml-auto">
                            <Button variant="outline" size="sm" onClick={() => window.open(`https://wa.me/${item.owner_contact.replace(/[^0-9]/g, '')}`, '_blank')} className="gap-2">
                                <MessageSquare className="w-4 h-4" /> Contactar
                            </Button>
                        </div>
                    </div>

                    <div className="mt-auto sticky bottom-0 md:relative bg-white p-4 md:p-0 border-t md:border-t-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:shadow-none">
                        <Button className="w-full py-4 text-lg font-semibold shadow-xl shadow-indigo-200" onClick={() => setIsRequestModalOpen(true)}>
                            Solicitar Alquiler
                        </Button>
                    </div>
                </div>
            </div>

            <Modal
                isOpen={isRequestModalOpen}
                onClose={() => setIsRequestModalOpen(false)}
                title="Solicitar Alquiler"
            >
                <form onSubmit={handleRequestSubmit} className="flex flex-col gap-4">
                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Fecha inicio"
                            type="date"
                            required
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                        <Input
                            label="Fecha fin"
                            type="date"
                            required
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>

                    {/* Guest Info */}
                    {!isAuthenticated && (
                        <>
                            <Input
                                label="Tu Nombre"
                                placeholder="Ej. Juan Pérez"
                                required
                                value={requesterName}
                                onChange={e => setRequesterName(e.target.value)}
                            />
                            <Input
                                label="WhatsApp / Email"
                                placeholder="Para que te contacten"
                                required
                                value={requesterContact}
                                onChange={e => setRequesterContact(e.target.value)}
                            />
                        </>
                    )}

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700">Mensaje (Opcional)</label>
                        <textarea
                            className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
                            placeholder="Hola, me interesa alquilar esto para..."
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                        />
                    </div>

                    <div className="mt-4 flex gap-3">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setIsRequestModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" className="flex-1">Enviar Solicitud</Button>
                    </div>
                </form>
            </Modal>

        </div>
    );
};
