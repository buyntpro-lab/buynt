import { useEffect, useState, useCallback } from 'react';
import { chatService } from '../services/chatService';
import { useAuth } from '../context/AuthContext';
import type { ChatMessage, ConversationListItem } from '../services/types';

/**
 * Hook para manejar chat
 * Incluye: cargar mensajes, suscripciones realtime, enviar mensajes, etc.
 */

export const useChat = (conversationId?: string) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // ============================================================================
  // LOAD CONVERSATIONS (Bandeja)
  // ============================================================================

  const loadConversations = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await chatService.listMyConversations();
      setConversations(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ============================================================================
  // LOAD MESSAGES (Chat detail)
  // ============================================================================

  const loadMessages = useCallback(
    async (cursor?: string) => {
      if (!conversationId) return;

      setLoading(true);
      try {
        const { messages: newMessages, hasMore } = await chatService.getMessages(
          conversationId,
          50,
          cursor
        );

        if (cursor) {
          // Append older messages
          setMessages((prev) => [...newMessages, ...prev]);
        } else {
          // Initial load
          setMessages(newMessages);
        }

        setHasMoreMessages(hasMore);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [conversationId]
  );

  // ============================================================================
  // SEND MESSAGE
  // ============================================================================

  const sendMessage = useCallback(
    async (body: string) => {
      if (!conversationId || !body.trim() || !user?.email || sending) return;

      setSending(true);
      const trimmedBody = body.trim();
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        // Optimistic UI - add temp message
        const tempMessage: ChatMessage = {
          id: tempId,
          conversation_id: conversationId,
          sender_id: user.email,
          body: trimmedBody,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, tempMessage]);

        // Send to server
        const messageId = await chatService.sendMessage(conversationId, trimmedBody);

        // Replace temp with real ID (realtime might have already done this, so dedupe)
        setMessages((prev) => {
          // Check if realtime already replaced it
          const realtimeExists = prev.some(msg => msg.id === messageId);
          if (realtimeExists) {
            // Remove temp, keep realtime version
            return prev.filter(msg => msg.id !== tempId);
          }
          // Replace temp ID with real ID
          return prev.map((msg) =>
            msg.id === tempId ? { ...msg, id: messageId } : msg
          );
        });
      } catch (err) {
        setError((err as Error).message);
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      } finally {
        setSending(false);
      }
    },
    [conversationId, user, sending]
  );

  // ============================================================================
  // MARK AS READ
  // ============================================================================

  const markAsRead = useCallback(async () => {
    if (!conversationId) return;

    try {
      await chatService.markConversationAsRead(conversationId);
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  }, [conversationId]);

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================

  // Subscribe to new messages
  useEffect(() => {
    if (!conversationId) return;

    const subscription = chatService.subscribeToMessages(
      conversationId,
      (newMessage) => {
        // DEDUPE: Only add if message doesn't already exist (prevents optimistic + realtime duplicate)
        setMessages((prev) => {
          const exists = prev.some(msg => msg.id === newMessage.id);
          if (exists) {
            return prev; // Already have this message, ignore
          }
          // Also check if we have a temp version of this message (by matching body + sender + close timestamp)
          const tempIndex = prev.findIndex(
            msg => msg.id.startsWith('temp_') && 
                   msg.body === newMessage.body && 
                   msg.sender_id === newMessage.sender_id
          );
          if (tempIndex !== -1) {
            // Replace temp message with real one
            const updated = [...prev];
            updated[tempIndex] = newMessage;
            return updated;
          }
          return [...prev, newMessage];
        });
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [conversationId]);

  // Subscribe to typing indicators
  useEffect(() => {
    if (!conversationId) return;

    const channel = chatService.onPresenceChange(conversationId, (presences) => {
      const typing = presences
        .filter((p: any) => p.typing)
        .map((p: any) => p.user_id)
        .filter((id) => id !== user?.id);

      setTypingUsers(typing);
    });

    return () => {
      channel.unsubscribe();
    };
  }, [conversationId, user?.id]);

  // Subscribe to conversations changes (para update list)
  useEffect(() => {
    if (!conversations.length) return;

    const subscription = chatService.subscribeToConversations(
      (event, conversation) => {
        if (event === 'UPDATE') {
          setConversations((prev) =>
            prev.map((c) =>
              c.conversation_id === conversation.id ? { ...c } : c
            )
          );
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [conversations.length]);

  // Load unread count
  useEffect(() => {
    (async () => {
      const count = await chatService.getUnreadCount();
      setUnreadCount(count);
    })();
  }, []);

  // ============================================================================
  // LOAD MORE (PAGINATION)
  // ============================================================================

  const loadMoreMessages = useCallback(() => {
    if (messages.length === 0 || !hasMoreMessages) return;

    const cursor = messages[0]?.created_at;
    loadMessages(cursor);
  }, [messages, hasMoreMessages, loadMessages]);

  // ============================================================================
  // GET OR CREATE CONVERSATION
  // ============================================================================

  const getOrCreateConversation = useCallback(
    async (productId: string): Promise<string> => {
      try {
        const id = await chatService.getOrCreateConversation(productId);
        return id;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      }
    },
    []
  );

  return {
    // Data
    messages,
    conversations,
    typingUsers,
    unreadCount,

    // States
    loading,
    sending,
    error,
    hasMoreMessages,

    // Actions
    loadConversations,
    loadMessages,
    sendMessage,
    markAsRead,
    loadMoreMessages,
    getOrCreateConversation,
  };
};
