/**
 * DisputePanel Component
 * 
 * Displays active dispute information with messages and resolution options.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../common/Button';
import { disputesService } from '../../services/disputesService';
import type { Dispute, DisputeMessage } from '../../services/types';
import {
    AlertTriangle,
    MessageSquare,
    CheckCircle,
    Send,
    RefreshCw,
    Clock,
} from 'lucide-react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface DisputePanelProps {
    rentalId: string;
    currentUserId: string;
    onDisputeUpdate: () => void;
}

export const DisputePanel: React.FC<DisputePanelProps> = ({
    rentalId,
    currentUserId,
    onDisputeUpdate,
}) => {
    const [dispute, setDispute] = useState<Dispute | null>(null);
    const [messages, setMessages] = useState<DisputeMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [resolutionNote, setResolutionNote] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const [showResolveForm, setShowResolveForm] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch dispute data
    const fetchDispute = async () => {
        setIsLoading(true);
        try {
            const data = await disputesService.getByRentalId(rentalId);
            setDispute(data);
            
            if (data) {
                const msgs = await disputesService.getMessages(data.id);
                setMessages(msgs);
            }
        } catch (err) {
            console.error('Error fetching dispute:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDispute();
    }, [rentalId]);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Send message
    const handleSendMessage = async () => {
        if (!dispute || !newMessage.trim()) return;

        setIsSending(true);
        try {
            const messageId = await disputesService.addMessage(dispute.id, newMessage.trim());
            if (messageId) {
                setNewMessage('');
                await fetchDispute(); // Refresh messages
            } else {
                toast.error('No se pudo enviar el mensaje');
            }
        } catch (err) {
            console.error('Send message error:', err);
            toast.error('Error al enviar mensaje');
        } finally {
            setIsSending(false);
        }
    };

    // Resolve dispute
    const handleResolve = async () => {
        if (!dispute || !resolutionNote.trim()) {
            toast.error('Escribe una nota de resolución');
            return;
        }

        setIsResolving(true);
        try {
            const success = await disputesService.resolve(dispute.id, resolutionNote.trim());
            if (success) {
                toast.success('Disputa resuelta');
                setShowResolveForm(false);
                setResolutionNote('');
                await fetchDispute();
                onDisputeUpdate();
            } else {
                toast.error('No se pudo resolver la disputa');
            }
        } catch (err) {
            console.error('Resolve error:', err);
            toast.error('Error al resolver disputa');
        } finally {
            setIsResolving(false);
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 md:p-6">
                <div className="flex items-center gap-2 text-amber-600">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Cargando disputa...</span>
                </div>
            </div>
        );
    }

    // No dispute
    if (!dispute) {
        return null;
    }

    const isOpen = dispute.status === 'open';
    const isOpener = dispute.opened_by === currentUserId;
    const canResolve = isOpen && !isOpener; // Only the other party can resolve

    return (
        <div className={`rounded-2xl border p-4 md:p-6 ${
            isOpen 
                ? 'bg-amber-50 border-amber-200' 
                : 'bg-green-50 border-green-200'
        }`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                    {isOpen ? (
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                    ) : (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                    <h3 className={`font-semibold ${isOpen ? 'text-amber-800' : 'text-green-800'}`}>
                        {isOpen ? 'Disputa abierta' : 'Disputa resuelta'}
                    </h3>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                    isOpen 
                        ? 'bg-amber-200 text-amber-700' 
                        : 'bg-green-200 text-green-700'
                }`}>
                    {isOpen ? 'Pendiente' : 'Cerrada'}
                </span>
            </div>

            {/* Reason */}
            <div className="mb-4">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Motivo</p>
                <p className={`text-sm ${isOpen ? 'text-amber-700' : 'text-green-700'} bg-white p-3 rounded-lg`}>
                    "{dispute.reason}"
                </p>
                <p className="text-xs text-slate-500 mt-1">
                    Abierta {formatDistanceToNow(parseISO(dispute.created_at), { addSuffix: true, locale: es })}
                    {dispute.opener_email && ` por ${dispute.opener_email.split('@')[0]}`}
                </p>
            </div>

            {/* Resolution Note (if resolved) */}
            {!isOpen && dispute.resolution_note && (
                <div className="mb-4 p-3 bg-green-100 rounded-lg">
                    <p className="text-xs uppercase tracking-wide text-green-600 mb-1">Resolución</p>
                    <p className="text-sm text-green-800">"{dispute.resolution_note}"</p>
                    {dispute.resolved_at && (
                        <p className="text-xs text-green-600 mt-1">
                            Resuelta el {format(parseISO(dispute.resolved_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                        </p>
                    )}
                </div>
            )}

            {/* Messages */}
            {messages.length > 0 && (
                <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-slate-500" />
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                            Mensajes ({messages.length})
                        </p>
                    </div>
                    <div className="bg-white rounded-lg border border-slate-200 max-h-60 overflow-y-auto">
                        <div className="p-3 space-y-3">
                            {messages.map((msg) => {
                                const isOwn = msg.sender_id === currentUserId;
                                return (
                                    <div 
                                        key={msg.id} 
                                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
                                            isOwn 
                                                ? 'bg-teal-500 text-white' 
                                                : 'bg-slate-100 text-slate-800'
                                        }`}>
                                            <p className="text-sm">{msg.body}</p>
                                            <p className={`text-xs mt-1 ${
                                                isOwn ? 'text-teal-200' : 'text-slate-400'
                                            }`}>
                                                {format(parseISO(msg.created_at), 'HH:mm', { locale: es })}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                </div>
            )}

            {/* Message Input (only if open) */}
            {isOpen && (
                <div className="mb-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Escribe un mensaje..."
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            disabled={isSending}
                        />
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleSendMessage}
                            disabled={isSending || !newMessage.trim()}
                        >
                            {isSending ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </Button>
                    </div>
                </div>
            )}

            {/* Resolve Form */}
            {canResolve && !showResolveForm && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowResolveForm(true)}
                    className="w-full border-green-300 text-green-700 hover:bg-green-100"
                >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Marcar como resuelta
                </Button>
            )}

            {showResolveForm && (
                <div className="bg-green-100 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-800 mb-2">
                        Describe cómo se resolvió el problema:
                    </p>
                    <textarea
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        placeholder="Ej: Se acordó un reembolso parcial..."
                        className="w-full p-2 border border-green-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
                        rows={2}
                    />
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowResolveForm(false)}
                            disabled={isResolving}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleResolve}
                            disabled={isResolving || !resolutionNote.trim()}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {isResolving ? (
                                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <CheckCircle className="w-4 h-4 mr-2" />
                            )}
                            Resolver disputa
                        </Button>
                    </div>
                </div>
            )}

            {/* Info if user opened and can't resolve */}
            {isOpen && isOpener && (
                <p className="text-xs text-amber-600 text-center mt-2">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Esperando que la otra parte responda o resuelva
                </p>
            )}
        </div>
    );
};

export default DisputePanel;
