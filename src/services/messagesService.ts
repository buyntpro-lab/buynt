import { supabase } from './supabase';
import type { ChatMessage } from './types';

export const messagesService = {
    // Create or get existing conversation (direct query, no RPC)
    async getOrCreateConversation(productId: string, userEmail: string): Promise<string | null> {
        try {
            // 1. Get item owner
            const { data: item, error: itemError } = await supabase
                .from('items')
                .select('owner_contact')
                .eq('id', productId)
                .single();

            if (itemError || !item) {
                console.error('Error getting item:', itemError);
                return null;
            }

            const ownerEmail = item.owner_contact;
            
            // Can't contact yourself
            if (ownerEmail === userEmail) {
                console.error('Cannot contact yourself');
                return null;
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

            if (createError) {
                console.error('Error creating conversation:', createError);
                return null;
            }

            return newConv?.id || null;
        } catch (err) {
            console.error('Exception in getOrCreateConversation:', err);
            return null;
        }
    },

    // Send a message (direct insert, no RPC)
    async sendMessage(conversationId: string, body: string, senderEmail: string): Promise<string | null> {
        try {
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    conversation_id: conversationId,
                    sender_id: senderEmail,
                    body: body
                })
                .select('id')
                .single();

            if (error) {
                console.error('Error sending message:', error);
                return null;
            }

            // Update conversation updated_at
            await supabase
                .from('conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', conversationId);

            return data?.id || null;
        } catch (err) {
            console.error('Exception in sendMessage:', err);
            return null;
        }
    },

    // Get messages in a conversation
    async getConversation(conversationId: string): Promise<ChatMessage[]> {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error fetching messages:', error);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error('Exception in getConversation:', err);
            return [];
        }
    },

    // Mark conversation as read (direct update)
    async markConversationRead(conversationId: string, _userEmail: string, isOwner: boolean): Promise<void> {
        try {
            const updateField = isOwner ? 'owner_last_read_at' : 'renter_last_read_at';
            await supabase
                .from('conversations')
                .update({ [updateField]: new Date().toISOString() })
                .eq('id', conversationId);
        } catch (err) {
            console.error('Exception in markConversationRead:', err);
        }
    },

    // Get conversation details
    async getConversationDetails(conversationId: string) {
        try {
            const { data, error } = await supabase
                .from('conversations')
                .select('*, items(*)')
                .eq('id', conversationId)
                .single();

            if (error) {
                console.error('Error getting conversation details:', error);
                return null;
            }

            return data;
        } catch (err) {
            console.error('Exception in getConversationDetails:', err);
            return null;
        }
    },

    // Get all conversations for a user
    async listMyConversations(userEmail: string) {
        try {
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
                        image_url
                    )
                `)
                .or(`owner_id.eq.${userEmail},renter_id.eq.${userEmail}`)
                .order('updated_at', { ascending: false });

            if (error) {
                console.error('Error listing conversations:', error);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error('Exception in listMyConversations:', err);
            return [];
        }
    },

    // Subscribe to messages in a conversation
    subscribeToConversation(conversationId: string, callback: (payload: any) => void) {
        return supabase
            .channel(`conversation:${conversationId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
                callback
            )
            .subscribe();
    },

    // Get unread count for a user
    async getUnreadCount(userEmail: string): Promise<number> {
        try {
            // Get all conversations where user is owner or renter
            // Note: emails need to be quoted properly in PostgREST .or() syntax
            const { data: conversations, error } = await supabase
                .from('conversations')
                .select('id, owner_id, renter_id, owner_last_read_at, renter_last_read_at')
                .or(`owner_id.eq."${userEmail}",renter_id.eq."${userEmail}"`);

            if (error || !conversations) {
                console.error('Error getting conversations for unread count:', error);
                return 0;
            }

            let totalUnread = 0;

            // For each conversation, count messages newer than last read
            for (const conv of conversations) {
                const isOwner = conv.owner_id === userEmail;
                const lastReadAt = isOwner ? conv.owner_last_read_at : conv.renter_last_read_at;

                const { count, error: countError } = await supabase
                    .from('messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('conversation_id', conv.id)
                    .neq('sender_id', userEmail)
                    .gt('created_at', lastReadAt || '1970-01-01');

                if (!countError && count) {
                    totalUnread += count;
                }
            }

            return totalUnread;
        } catch (err) {
            console.error('Exception in getUnreadCount:', err);
            return 0;
        }
    }
};
