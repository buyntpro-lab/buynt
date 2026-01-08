import { supabase } from './supabase';
import type { Message } from './types';

export const messagesService = {
    // Get conversation between two users for a specific product
    async getConversation(productId: string, userId1: string, userId2: string): Promise<Message[]> {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('product_id', productId)
            .or(`sender_id.eq.${userId1},receiver_id.eq.${userId1}`)
            .or(`sender_id.eq.${userId2},receiver_id.eq.${userId2}`)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching messages:', error);
            return [];
        }

        // Filter locally to ensure we only get messages between these two users
        // (Supabase OR logic can be tricky with multiple ORs)
        return (data || []).filter(m =>
            (m.sender_id === userId1 && m.receiver_id === userId2) ||
            (m.sender_id === userId2 && m.receiver_id === userId1)
        );
    },

    async getUnreadCount(userId: string): Promise<number> {
        const { count, error } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', userId)
            .eq('is_read', false);

        return count || 0;
    },

    async sendMessage(message: Omit<Message, 'id' | 'created_at' | 'is_read'>): Promise<Message | null> {
        const { data, error } = await supabase
            .from('messages')
            .insert([message])
            .select()
            .single();

        if (error) {
            console.error('Error sending message:', error);
            return null;
        }
        return data;
    },

    async markAsRead(messageIds: string[]) {
        if (messageIds.length === 0) return;

        await supabase
            .from('messages')
            .update({ is_read: true })
            .in('id', messageIds);
    },

    // Subscribe to new messages for a user
    subscribeToMessages(userId: string, callback: (payload: any) => void) {
        return supabase
            .channel('public:messages')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
                callback
            )
            .subscribe();
    }
};
