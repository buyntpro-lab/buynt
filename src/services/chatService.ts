import { supabase } from './supabase';
import type { ChatMessage, Conversation, ConversationListItem, Notification } from './types';

/**
 * Chat Service
 * Maneja todas las operaciones de chat: conversaciones, mensajes, attachments, etc.
 */

export const chatService = {
  // ============================================================================
  // CONVERSATIONS
  // ============================================================================

  /**
   * Obtiene o crea una conversación para un producto
   * Usa queries directas en lugar de RPC para mayor control
   */
  async getOrCreateConversation(productId: string): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error('User not authenticated');
      }

      const userEmail = user.email;

      // 1. Get item owner
      const { data: item, error: itemError } = await supabase
        .from('items')
        .select('owner_contact')
        .eq('id', productId)
        .single();

      if (itemError || !item) {
        throw new Error('Product not found');
      }

      const ownerEmail = item.owner_contact;

      // Can't contact yourself
      if (ownerEmail === userEmail) {
        throw new Error('Owner cannot contact themselves');
      }

      // 2. Check if conversation already exists
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('product_id', productId)
        .eq('owner_id', ownerEmail)
        .eq('renter_id', userEmail)
        .maybeSingle();

      if (existing?.id) {
        return existing.id;
      }

      // 3. Create new conversation
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({
          product_id: productId,
          owner_id: ownerEmail,
          renter_id: userEmail,
          owner_last_read_at: new Date().toISOString(),
          renter_last_read_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (createError || !newConv) {
        throw new Error(createError?.message || 'Could not create conversation');
      }

      return newConv.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error in getOrCreateConversation:', message);
      throw new Error(message);
    }
  },

  /**
   * Obtiene los detalles de una conversación
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error) {
      console.error('Error fetching conversation:', error);
      return null;
    }

    return data;
  },

  /**
   * Lista todas mis conversaciones (queries directas)
   */
  async listMyConversations(): Promise<ConversationListItem[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        console.log('[listMyConversations] No user email found');
        return [];
      }

      const userEmail = user.email;
      console.log('[listMyConversations] Fetching for:', userEmail);

      // Use filter with proper escaping for email addresses
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          product_id,
          owner_id,
          renter_id,
          updated_at,
          owner_last_read_at,
          renter_last_read_at,
          items (
            title,
            image_url,
            owner_name
          )
        `)
        .or(`owner_id.eq."${userEmail}",renter_id.eq."${userEmail}"`)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[listMyConversations] Error:', error);
        return [];
      }

      console.log('[listMyConversations] Found conversations:', data?.length || 0);

      // Get last message for each conversation
      const conversationsWithMessages = await Promise.all(
        (data || []).map(async (conv: any) => {
          const isOwner = conv.owner_id === userEmail;
          const otherUserEmail = isOwner ? conv.renter_id : conv.owner_id;
          
          // Get last message
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('body, created_at, sender_id')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Calculate unread count
          const myLastRead = isOwner ? conv.owner_last_read_at : conv.renter_last_read_at;
          let unreadCount = 0;
          
          if (myLastRead) {
            const { count } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conv.id)
              .neq('sender_id', userEmail)
              .gt('created_at', myLastRead);
            unreadCount = count || 0;
          }

          return {
            conversation_id: conv.id,
            product_id: conv.product_id,
            product_title: conv.items?.title || 'Producto',
            product_image_url: conv.items?.image_url || '',
            product_owner_name: conv.items?.owner_name || 'Usuario',
            other_user_id: otherUserEmail,
            other_user_email: otherUserEmail,
            other_user_name: otherUserEmail,
            last_message_body: lastMsg?.body || '',
            last_message_at: lastMsg?.created_at || conv.updated_at,
            last_message_sender_id: lastMsg?.sender_id || '',
            unread_count: unreadCount,
            is_read: unreadCount === 0
          };
        })
      );

      return conversationsWithMessages;
    } catch (err) {
      console.error('[listMyConversations] Exception:', err);
      return [];
    }
  },

  // ============================================================================
  // MESSAGES
  // ============================================================================

  /**
   * Envía un mensaje (queries directas en lugar de RPC)
   */
  async sendMessage(conversationId: string, body: string): Promise<string> {
    if (!body || !body.trim()) {
      throw new Error('El mensaje no puede estar vacío');
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.email,
          body: body.trim()
        })
        .select('id')
        .single();

      if (error || !data) {
        throw new Error(error?.message || 'Could not send message');
      }

      // Update conversation updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return data.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error sending message:', message);
      throw new Error(message);
    }
  },

  /**
   * Obtiene los mensajes de una conversación (con paginación)
   */
  async getMessages(
    conversationId: string,
    limit: number = 50,
    cursor?: string
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
    let query = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // +1 para saber si hay más

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching messages:', error);
      return { messages: [], hasMore: false };
    }

    const hasMore = (data?.length || 0) > limit;
    const messages = (data || []).slice(0, limit).reverse();

    return { messages: messages as ChatMessage[], hasMore };
  },

  /**
   * Marca una conversación como leída (direct query, no RPC)
   */
  async markConversationAsRead(conversationId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Get conversation to determine if user is owner or renter
      const { data: conv } = await supabase
        .from('conversations')
        .select('owner_id, renter_id')
        .eq('id', conversationId)
        .single();

      if (!conv) return;

      const isOwner = conv.owner_id === user.email;
      const updateField = isOwner ? 'owner_last_read_at' : 'renter_last_read_at';

      await supabase
        .from('conversations')
        .update({ [updateField]: new Date().toISOString() })
        .eq('id', conversationId);

    } catch (err) {
      console.error('[markConversationAsRead] Error:', err);
      // Non-critical, don't throw
    }
  },

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  /**
   * Sube un archivo a Storage
   */
  async uploadAttachment(
    conversationId: string,
    messageId: string,
    file: File
  ): Promise<string> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Validar tamaño (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('El archivo es demasiado grande (máx 10MB)');
    }

    // Generar nombre único
    const ext = file.name.split('.').pop();
    const filename = `${conversationId}/${messageId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const { error } = await supabase.storage
      .from('chat-attachments')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading attachment:', error);
      throw new Error('No se pudo subir el archivo');
    }

    // Crear registro en BD
    const { error: dbError } = await supabase
      .from('message_attachments')
      .insert({
        message_id: messageId,
        conversation_id: conversationId,
        storage_path: filename,
        mime_type: file.type,
        file_name: file.name,
        file_size: file.size,
      });

    if (dbError) {
      console.error('Error creating attachment record:', dbError);
      throw new Error('No se pudo registrar el archivo');
    }

    return filename;
  },

  /**
   * Obtiene URL pública de un archivo (con expiración)
   */
  async getAttachmentUrl(storagePath: string, expiresIn: number = 3600): Promise<string> {
    const { data } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(storagePath);

    // Para archivos privados, mejor usar signed URL
    const { data: signedData, error } = await supabase.storage
      .from('chat-attachments')
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.error('Error getting signed URL:', error);
      return data.publicUrl; // Fallback
    }

    return signedData.signedUrl;
  },

  /**
   * Obtiene adjuntos de un mensaje
   */
  async getMessageAttachments(messageId: string) {
    const { data, error } = await supabase
      .from('message_attachments')
      .select('*')
      .eq('message_id', messageId);

    if (error) {
      console.error('Error fetching attachments:', error);
      return [];
    }

    return data || [];
  },

  // ============================================================================
  // REALTIME SUBSCRIPTIONS
  // ============================================================================

  /**
   * Suscribirse a nuevos mensajes en una conversación
   */
  subscribeToMessages(
    conversationId: string,
    callback: (message: ChatMessage) => void
  ) {
    return supabase
      .channel(`conv_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          callback(payload.new as ChatMessage);
        }
      )
      .subscribe();
  },

  /**
   * Suscribirse a cambios en conversaciones (para actualizar lista)
   */
  subscribeToConversations(
    callback: (event: string, conversation: Conversation) => void
  ) {
    return supabase
      .channel('conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          callback(payload.eventType, payload.new as Conversation);
        }
      )
      .subscribe();
  },

  /**
   * Suscribirse a notificaciones
   */
  subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
    if (!userId) return null;

    return supabase
      .channel(`notifications_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback(payload.new as Notification);
        }
      )
      .subscribe();
  },

  /**
   * Track typing status via Presence
   */
  trackTyping(conversationId: string, isTyping: boolean) {
    const channel = supabase.channel(`presence_${conversationId}`);

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          typing: isTyping,
          timestamp: new Date().toISOString(),
        });
      }
    });

    return channel;
  },

  /**
   * Listen to typing indicators
   */
  onPresenceChange(
    conversationId: string,
    callback: (presences: any[]) => void
  ) {
    const channel = supabase.channel(`presence_${conversationId}`);

    channel.on('presence', { event: 'sync' }, () => {
      const presences = channel.presenceState();
      const presenceArray = Object.values(presences).flat();
      callback(presenceArray);
    });

    channel.subscribe();

    return channel;
  },

  // ============================================================================
  // BLOCKS
  // ============================================================================

  /**
   * Bloquea a un usuario
   */
  async blockUser(userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('user_blocks')
      .insert({
        blocked_id: userId,
      });

    if (error) {
      console.error('Error blocking user:', error);
      return false;
    }

    return true;
  },

  /**
   * Desbloquea a un usuario
   */
  async unblockUser(userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocked_id', userId);

    if (error) {
      console.error('Error unblocking user:', error);
      return false;
    }

    return true;
  },

  /**
   * Obtiene usuarios que he bloqueado
   */
  async getBlockedUsers(): Promise<string[]> {
    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', (await supabase.auth.getUser()).data.user?.id);

    if (error) {
      console.error('Error fetching blocked users:', error);
      return [];
    }

    return (data || []).map((item) => item.blocked_id);
  },

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================

  /**
   * Obtiene el contador de mensajes no leídos
   */
  async getUnreadCount(): Promise<number> {
    const { data, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('type', 'message')
      .is('read_at', null);

    if (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }

    return data?.length || 0;
  },
};
