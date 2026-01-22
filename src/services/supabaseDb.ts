import { supabase } from './supabase';
import type { Item } from './types';

// Bookings operations
// NOTE: Legacy bookings fallback to requests removed in consolidation_A
// Use rentalRequestsService for all booking/request operations
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
            // Legacy fallback removed - use rentalRequestsService instead
            return [];
        }
        return data || [];
    }
};

// Items operations
export const itemsService = {
    async getAll(): Promise<Item[]> {
        // Use items_public view to avoid exposing owner_contact (email)
        const { data, error } = await supabase
            .from('items_public')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching items from Supabase:', error);
            // Fallback to items table if view doesn't exist yet
            const { data: fallbackData } = await supabase
                .from('items')
                .select('id, title, description, price_day, city, category, image_url, owner_id, owner_name, created_at, is_available, image_migrated_at')
                .order('created_at', { ascending: false });
            return fallbackData || [];
        }
        
        console.log('🔍 itemsService.getAll() - Items from Supabase:', data?.length);
        return data || [];
    },

    async getById(id: string): Promise<Item | null> {
        // For detail view, still need some info but not owner_contact for non-owners
        const { data, error } = await supabase
            .from('items_public')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching item:', error);
            // Fallback without owner_contact
            const { data: fallbackData } = await supabase
                .from('items')
                .select('id, title, description, price_day, city, category, image_url, owner_id, owner_name, created_at, is_available, image_migrated_at')
                .eq('id', id)
                .single();
            return fallbackData;
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

// ============================================================================
// LEGACY requestsService REMOVED (consolidation_A)
// ============================================================================
// All request operations now use rentalRequestsService with Supabase RPCs:
// - rentalRequestsService.create() → create_rental_request RPC
// - rentalRequestsService.respond() → respond_rental_request RPC
// - rentalRequestsService.cancel() → cancel_rental_request RPC
// - rentalRequestsService.listIncoming/listOutgoing() → rental_requests_with_items view
// ============================================================================
