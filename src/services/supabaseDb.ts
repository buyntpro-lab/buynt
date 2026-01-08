import { supabase } from './supabase';
import type { Item, Request } from './types';

// Items operations
export const itemsService = {
    async getAll(): Promise<Item[]> {
        const { data, error } = await supabase
            .from('items')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching items:', error);
            return [];
        }
        return data || [];
    },

    async getById(id: string): Promise<Item | null> {
        const { data, error } = await supabase
            .from('items')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching item:', error);
            return null;
        }
        return data;
    },

    async getByOwner(ownerContact: string): Promise<Item[]> {
        const { data, error } = await supabase
            .from('items')
            .select('*')
            .eq('owner_contact', ownerContact)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching owner items:', error);
            return [];
        }
        return data || [];
    },

    async add(item: Omit<Item, 'id' | 'created_at'>): Promise<Item | null> {
        const { data, error } = await supabase
            .from('items')
            .insert([item])
            .select()
            .single();

        if (error) {
            console.error('Error adding item:', error);
            return null;
        }
        return data;
    },

    async delete(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('items')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting item:', error);
            return false;
        }
        return true;
    }
};

// Requests operations
export const requestsService = {
    async getAll(): Promise<Request[]> {
        const { data, error } = await supabase
            .from('requests')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching requests:', error);
            return [];
        }
        return data || [];
    },

    async getByItemId(itemId: string): Promise<Request[]> {
        const { data, error } = await supabase
            .from('requests')
            .select('*')
            .eq('item_id', itemId);

        if (error) {
            console.error('Error fetching item requests:', error);
            return [];
        }
        return data || [];
    },

    async add(request: Omit<Request, 'id' | 'created_at' | 'status'>): Promise<Request | null> {
        const { data, error } = await supabase
            .from('requests')
            .insert([{ ...request, status: 'pending' }])
            .select()
            .single();

        if (error) {
            console.error('Error adding request:', error);
            return null;
        }
        return data;
    },

    async updateStatus(id: string, status: 'accepted' | 'rejected'): Promise<boolean> {
        const { error } = await supabase
            .from('requests')
            .update({ status })
            .eq('id', id);

        if (error) {
            console.error('Error updating request status:', error);
            return false;
        }
        return true;
    }
};
