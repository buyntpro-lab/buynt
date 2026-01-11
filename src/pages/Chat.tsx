import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { messagesService } from '../services/messagesService';
import { itemsService } from '../services/supabaseDb';
import { ChatBubble } from '../components/chat/ChatBubble';
import type { ChatMessage, Item } from '../services/types';
import { Button } from '../components/common/Button';
import toast from 'react-hot-toast';

export const Chat: React.FC = () => {
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const conversationId = searchParams.get('conversationId');
    const productId = searchParams.get('productId');

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [product, setProduct] = useState<Item | null>(null);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Redirect if not auth
    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, navigate]);

    // Fetch initial data
    useEffect(() => {
        const initChat = async () => {
            if (!conversationId || !productId || !user?.email) {
                toast.error('Parámetros inválidos');
                navigate('/messages');
                return;
            }

            setIsLoading(true);

            try {
                // Fetch item details
                const itemData = await itemsService.getById(productId);
                setProduct(itemData);

                // Fetch messages
                const msgs = await messagesService.getConversation(conversationId);
                setMessages(msgs);

                // Get conversation details to know if user is owner
                const convDetails = await messagesService.getConversationDetails(conversationId);
                const isOwner = convDetails?.owner_id === user.email;

                // Mark as read
                await messagesService.markConversationRead(conversationId, user.email, isOwner);
            } catch (err) {
                console.error('Error initializing chat:', err);
                toast.error('Error al cargar la conversación');
            } finally {
                setIsLoading(false);
            }
        };

        if (isAuthenticated && conversationId && productId && user?.email) {
            initChat();
        }
    }, [conversationId, productId, isAuthenticated, navigate, user?.email]);

    // Realtime subscription
    useEffect(() => {
        if (!conversationId) return;

        const channel = messagesService.subscribeToConversation(conversationId, (payload) => {
            const newMsg = payload.new as ChatMessage;
            setMessages(prev => [...prev, newMsg]);
        });

        return () => {
            channel.unsubscribe();
        };
    }, [conversationId]);

    // Scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !conversationId || !user?.email) return;

        const content = inputText.trim();
        setInputText('');
        setIsSending(true);

        try {
            await messagesService.sendMessage(conversationId, content, user.email);
        } catch (err) {
            console.error('Error sending message:', err);
            toast.error('Error al enviar el mensaje');
            setInputText(content);
        } finally {
            setIsSending(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-lg text-slate-500">Cargando conversación...</div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <p className="text-lg text-slate-500 mb-4">Producto no encontrado</p>
                    <Button onClick={() => navigate('/messages')} variant="primary">
                        Volver a mensajes
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
                <button
                    onClick={() => navigate('/messages')}
                    className="p-2 hover:bg-slate-100 rounded-lg"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h2 className="font-semibold text-slate-900">{product.title}</h2>
                    <p className="text-sm text-slate-500">€{product.price_day}/día</p>
                </div>
            </div>

            {/* Messages */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
            >
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-slate-500">Inicia la conversación</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <ChatBubble
                            key={msg.id}
                            message={msg}
                            isOwn={msg.sender_id === user?.email}
                        />
                    ))
                )}
            </div>

            {/* Input */}
            <div className="border-t border-slate-200 bg-white px-4 py-3">
                <form onSubmit={handleSend} className="flex gap-2">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Escribe un mensaje..."
                        disabled={isSending}
                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                    />
                    <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={!inputText.trim() || isSending}
                        className="px-4"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
};
