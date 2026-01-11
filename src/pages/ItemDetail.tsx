import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, MapPin, MessageSquare } from 'lucide-react';
import { Button } from '../components/common/Button';
import { itemsService } from '../services/supabaseDb';
import { chatService } from '../services/chatService';
import { BookingWidget } from '../components/booking/BookingWidget';
import { useAuth } from '../context/AuthContext';
import { mockItems } from '../data/mockData';
import type { Item } from '../services/types';
import toast from 'react-hot-toast';

export const ItemDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const [item, setItem] = useState<Item | undefined>(undefined);
    const [isContacting, setIsContacting] = useState(false);

    useEffect(() => {
        const fetchItem = async () => {
            if (id) {
                // First try to find in Supabase
                const foundItem = await itemsService.getById(id);
                if (foundItem) {
                    setItem(foundItem);
                } else {
                    // Fallback to mock data
                    const mockItem = mockItems.find(item => item.id === id);
                    setItem(mockItem || undefined);
                }
            }
        };
        fetchItem();
    }, [id]);

    if (!item) {
        return <div className="p-8 text-center">Loading or Item not found...</div>;
    }

    const handleContact = async () => {
        if (!isAuthenticated || !user?.email) {
            navigate('/login');
            return;
        }

        // Can't contact yourself
        if (item.owner_contact === user.email) {
            toast.error('No puedes contactarte a ti mismo');
            return;
        }

        setIsContacting(true);
        try {
            const conversationId = await chatService.getOrCreateConversation(item.id);
            if (!conversationId) {
                toast.error('No se pudo abrir el chat. Intenta de nuevo.');
                return;
            }
            navigate(`/messages/${conversationId}`);
        } catch (error) {
            console.error('Error creating conversation:', error);
            toast.error('No se pudo abrir el chat. Intenta de nuevo.');
        } finally {
            setIsContacting(false);
        }
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

                {/* Info & Booking Widget */}
                <div className="p-4 md:p-0 flex flex-col gap-6">
                    <div>
                        <div className="flex justify-between items-start">
                            <h1 className="text-3xl font-bold text-slate-900 mb-2">{item.title}</h1>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-primary">{item.price_day}€</div>
                                <div className="text-xs text-slate-500">por día</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-slate-500 text-sm mb-6">
                            <span className="flex items-center"><MapPin className="w-4 h-4 mr-1" /> {item.city}</span>
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 border border-slate-200">{item.category}</span>
                        </div>
                    </div>

                    {/* Owner Section */}
                    <div className="border-t border-b border-gray-100 py-6 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center text-primary font-bold text-xl">
                                {item.owner_name.charAt(0)}
                            </div>
                            <div>
                                <div className="text-sm text-slate-500">Propietario</div>
                                <div className="font-semibold text-slate-900">{item.owner_name}</div>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleContact}
                            disabled={isContacting}
                            className="gap-2 rounded-full border-gray-300 hover:border-primary hover:text-primary"
                        >
                            <MessageSquare className="w-4 h-4" /> 
                            {isContacting ? 'Abriendo...' : 'Contactar'}
                        </Button>
                    </div>

                    <div className="prose prose-slate text-slate-600 leading-relaxed mb-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">Descripción</h3>
                        <p>{item.description}</p>
                    </div>

                    {/* Booking Widget (Desktop Sticky / Mobile Bottom) */}
                    <BookingWidget item={item} />
                </div>
            </div>
        </div>
    );
};
