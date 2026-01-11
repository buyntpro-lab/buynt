import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Search, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export const Messages: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { conversations, loading, loadConversations, unreadCount } = useChat();
  const [searchTerm, setSearchTerm] = React.useState('');

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
  }, [isAuthenticated, navigate]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const filtered = conversations.filter(
    (conv) =>
      conv.other_user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.product_title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 md:py-6">
          <div className="flex items-center gap-4 md:gap-0 md:justify-between mb-4">
            <div className="flex items-center gap-2 md:gap-0">
              <button
                onClick={() => navigate(-1)}
                className="md:hidden p-2 hover:bg-slate-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5 text-slate-700" />
              </button>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-indigo-600" />
                <h1 className="text-2xl font-bold text-slate-900">Mensajes</h1>
              </div>
            </div>

            {unreadCount > 0 && (
              <div className="bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {unreadCount}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar persona o producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none"
            />
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 max-w-4xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-slate-600">Cargando conversaciones...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center text-slate-600">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <h2 className="text-lg font-semibold mb-2">
                {conversations.length === 0
                  ? 'No hay conversaciones aún'
                  : 'No se encontraron resultados'}
              </h2>
              <p className="text-sm">
                {conversations.length === 0
                  ? 'Contacta a un propietario desde la ficha de un producto'
                  : 'Intenta con otro término de búsqueda'}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filtered.map((conversation) => (
              <button
                key={conversation.conversation_id}
                onClick={() => navigate(`/messages/${conversation.conversation_id}`)}
                className="w-full text-left p-4 hover:bg-indigo-50 transition-colors active:bg-indigo-100"
              >
                <div className="flex gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                      {(conversation.other_user_name || 'U').charAt(0).toUpperCase()}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <h3 className="font-semibold text-slate-900 truncate">
                          {conversation.other_user_name || 'Usuario'}
                        </h3>
                        <p className="text-xs text-slate-500 truncate">
                          {conversation.product_title}
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-slate-500">
                          {conversation.last_message_at
                            ? formatDistanceToNow(
                                new Date(conversation.last_message_at),
                                { addSuffix: true, locale: es }
                              )
                            : ''}
                        </p>

                        {conversation.unread_count > 0 && (
                          <div className="mt-1 bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                            {conversation.unread_count}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Last message preview */}
                    <p
                      className={`text-sm truncate ${
                        conversation.unread_count > 0
                          ? 'text-slate-900 font-medium'
                          : 'text-slate-600'
                      }`}
                    >
                      {conversation.last_message_body || '(Sin mensajes)'}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
