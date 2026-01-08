import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { messagesService } from '../services/messagesService';
import { itemsService } from '../services/supabaseDb';
import { ChatBubble } from '../components/chat/ChatBubble';
import type { Message, Item } from '../services/types';
import { Button } from '../components/common/Button';

export const Chat: React.FC = () => {
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const productId = searchParams.get('productId');
    const withUser = searchParams.get('with'); // contact/email of the other person

    const [messages, setMessages] = useState<Message[]>([]);
    const [newItem, setNewItem] = useState<Item | null>(null);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
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
            if (!productId || !user || !withUser) return;

            setIsLoading(true);

            // Fetch item details
            const itemData = await itemsService.getById(productId);
            setNewItem(itemData);

            // Fetch conversation
            const msgs = await messagesService.getConversation(productId, user.email, withUser);
            setMessages(msgs);

            setIsLoading(false);
        };

        if (isAuthenticated) {
            initChat();
        }
    }, [productId, user, withUser, isAuthenticated]);

    // Realtime subscription
    useEffect(() => {
        if (!user) return;

        const channel = messagesService.subscribeToMessages(user.email, (payload) => {
            const newMsg = payload.new as Message;
            // Only add if it belongs to this conversation
            if (newMsg.product_id === productId &&
                (newMsg.sender_id === withUser || newMsg.sender_id === user.email)) {
                setMessages(prev => [...prev, newMsg]);
            }
        });

        return () => {
            channel.unsubscribe();
        };
    }, [user, productId, withUser]);

    // Scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !user || !productId || !withUser) return;

        const content = inputText.trim();
        setInputText(''); // Optimistic clear

        // Optimistic update (optional, but good for UX)
        // For simplicity we wait for DB, or just push. Let's push to list immediately.

        await messagesService.sendMessage({
            product_id: productId,
            sender_id: user.email,
            receiver_id: withUser,
            content: content
        });

        // Current user sent message, show it locally (if subscription doesn't catch own inserts, which it usually doesn't if filtering by receiver=me)
        // Actually our subscription filters receiver=me, so we won't get our own messages via realtime.
        // We must add it manually.
        const mockMsg: Message = {
            id: 'temp-' + Date.now(),
            product_id: productId,
            sender_id: user.email,
            receiver_id: withUser,
            content: content,
            is_read: false,
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, mockMsg]);
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Cargando chat...</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-white max-w-2xl mx-auto shadow-xl border-x border-gray-100">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-white sticky top-0 z-10">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div>
                    <h2 className="font-bold text-gray-900">{newItem?.title || 'Chat'}</h2>
                    <p className="text-xs text-gray-500">{withUser}</p>
                </div>
            </div>

            {/* Messages Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4"
            >
                {messages.length === 0 ? (
                    <div className="text-center text-gray-400 py-10">
                        <p>No hay mensajes aún.</p>
                        <p className="text-sm">¡Empieza la conversación!</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <ChatBubble
                            key={msg.id}
                            message={msg.content}
                            isOwn={msg.sender_id === user?.email}
                            timestamp={msg.created_at}
                        />
                    ))
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100">
                <form onSubmit={handleSend} className="flex gap-2">
                    <input
                        type="text"
                        className="flex-1 bg-gray-100 border-0 rounded-full px-6 py-3 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                        placeholder="Escribe un mensaje..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                    />
                    <Button
                        type="submit"
                        size="md"
                        className="rounded-full w-12 h-12 p-0 flex items-center justify-center bg-teal-500 hover:bg-teal-600 text-white shadow-lg shadow-teal-100"
                        disabled={!inputText.trim()}
                    >
                        <Send className="w-5 h-5 ml-1" />
                    </Button>
                </form>
            </div>
        </div>
    );
};
