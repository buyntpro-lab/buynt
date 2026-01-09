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
    async getAll(): Promise<Item[] | null> {
        const { data, error } = await supabase
            .from('items')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching items (Supabase):', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            
            // FALLBACK DE PRUEBA: Retornar items de prueba si Supabase falla
            // Esto es TEMPORAL para diagnosticar el problema
            console.warn('⚠️ Usando datos de prueba porque Supabase no responde');
            const mockItems: Item[] = [
                {
                    id: '1',
                    title: 'PlayStation 5',
                    description: 'Consola de gaming última generación en excelente estado',
                    price_day: 15,
                    city: 'Madrid',
                    image_url: 'https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=500&h=400&fit=crop',
                    category: 'Electrónica',
                    owner_id: 'user1',
                    owner_name: 'Juan',
                    owner_contact: 'juan@example.com',
                    created_at: new Date().toISOString()
                },
                {
                    id: '2',
                    title: 'Bicicleta de montaña',
                    description: 'Trek X-Caliber, 29", perfecta para off-road',
                    price_day: 8,
                    city: 'Barcelona',
                    image_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=400&fit=crop',
                    category: 'Deportes',
                    owner_id: 'user2',
                    owner_name: 'Maria',
                    owner_contact: 'maria@example.com',
                    created_at: new Date().toISOString()
                },
                {
                    id: '3',
                    title: 'Cámara Canon 5D',
                    description: 'Cámara profesional DSLR con 2 lentes incluidos',
                    price_day: 25,
                    city: 'Valencia',
                    image_url: 'https://images.unsplash.com/photo-1606986628025-35d57e735ae0?w=500&h=400&fit=crop',
                    category: 'Fotografía',
                    owner_id: 'user3',
                    owner_name: 'Carlos',
                    owner_contact: 'carlos@example.com',
                    created_at: new Date().toISOString()
                }
            ];
            return mockItems;
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
