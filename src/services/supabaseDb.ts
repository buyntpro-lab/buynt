import { supabase } from './supabase';
import type { Item, Request } from './types';

// Bookings operations
export const bookingsService = {
    async getByUserId(userId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('bookings')
            .select(`
                *,
                items (*)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching bookings:', error);
            // Fallback to requests if bookings table doesn't exist
            const { data: reqData } = await supabase
                .from('requests')
                .select(`
                    *,
                    items (*)
                `)
                .eq('requester_contact', userId)
                .order('created_at', { ascending: false });

            return reqData || [];
        }
        return data || [];
    }
};

// Items operations
export const itemsService = {
    async getAll(): Promise<Item[]> {
        const { data, error } = await supabase
            .from('items')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching items from Supabase:', error);
            return [];
        }
        
        console.log('🔍 itemsService.getAll() - Items from Supabase:', data?.length);
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

    async getByUserId(userId: string): Promise<Item[]> {
        const { data, error } = await supabase
            .from('items')
            .select('*')
            .eq('owner_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching user items:', error);
            return [];
        }
        return data || [];
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
        try {
            console.log('📤 Enviando item a Supabase:', item);
            
            const { data, error } = await supabase
                .from('items')
                .insert([item])
                .select()
                .single();

            if (error) {
                console.error('❌ Error adding item:', error.message);
                console.error('Error code:', error.code);
                console.error('Error details:', error);
                throw new Error(error.message || 'Error al insertar el producto');
            }
            
            console.log('✅ Item agregado exitosamente:', data);
            return data;
        } catch (error: any) {
            console.error('❌ Exception in add():', error);
            throw error;
        }
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
    },

    async update(id: string, updates: Partial<Omit<Item, 'id' | 'created_at' | 'owner_id'>>): Promise<Item | null> {
        try {
            console.log('📤 Actualizando item en Supabase:', { id, updates });
            
            const { data, error } = await supabase
                .from('items')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('❌ Error updating item:', error.message);
                throw new Error(error.message || 'Error al actualizar el producto');
            }
            
            console.log('✅ Item actualizado exitosamente:', data);
            return data;
        } catch (error: any) {
            console.error('❌ Exception in update():', error);
            throw error;
        }
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
