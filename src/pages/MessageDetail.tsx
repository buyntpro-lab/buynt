import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import { ChatBubble } from '../components/chat/ChatBubble';
import { Button } from '../components/common/Button';
import toast from 'react-hot-toast';

export const MessageDetail: React.FC = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user, isAuthenticated } = useAuth();
  const { messages, loading, sendMessage, loadMessages, markAsRead } = useChat(conversationId);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Load messages and mark as read when conversationId changes
  useEffect(() => {
    if (conversationId) {
      loadMessages();
      markAsRead(); // Mark conversation as read when opened
    }
  }, [conversationId, loadMessages, markAsRead]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !conversationId) return;

    const body = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      await sendMessage(body);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Error al enviar el mensaje');
      setInputText(body); // Restore on error
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-full h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="flex flex-col h-[80vh] w-[80%] bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-4 p-4">
            <button
              onClick={() => navigate('/messages')}
              className="p-2 hover:bg-slate-100 rounded-lg flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-slate-900 text-base md:text-lg">Conversación</h1>
              <p className="text-xs text-slate-500 truncate">{conversationId}</p>
            </div>
          </div>
        </div>

        {/* Messages Container */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500">Cargando mensajes...</p>
            </div>
          ) : messages.length === 0 ? (
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
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-slate-200 p-4 flex-shrink-0">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escribe un mensaje..."
              disabled={sending || loading}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!inputText.trim() || sending}
            >
              {sending ? '...' : 'Enviar'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
