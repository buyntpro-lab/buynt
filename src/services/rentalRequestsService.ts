/**
 * Rental Requests Service
 * 
 * Handles all rental request operations using Supabase RPC functions
 * for secure, atomic transactions with proper validation.
 */

import { supabase } from './supabase';
import type { 
    RentalRequest, 
    RentalRequestWithDetails, 
    Rental,
    BlockedDateRange 
} from './types';

// ============================================================================
// ERROR TYPES
// ============================================================================

export type RentalErrorCode = 
    | 'not_authenticated'
    | 'invalid_date_range'
    | 'item_not_found'
    | 'cannot_rent_own_item'
    | 'dates_not_available'
    | 'dates_no_longer_available'
    | 'request_not_found'
    | 'not_authorized'
    | 'request_not_pending'
    | 'invalid_action'
    | 'unknown_error';

export interface RentalError {
    code: RentalErrorCode;
    message: string;
}

// Map Postgres exception messages to user-friendly errors
function parseRentalError(error: any): RentalError {
    const errorMessage = error?.message?.toLowerCase() || '';
    
    if (errorMessage.includes('not_authenticated')) {
        return { code: 'not_authenticated', message: 'Debes iniciar sesión para realizar esta acción' };
    }
    if (errorMessage.includes('invalid_date_range')) {
        return { code: 'invalid_date_range', message: 'El rango de fechas no es válido' };
    }
    if (errorMessage.includes('item_not_found')) {
        return { code: 'item_not_found', message: 'El artículo no existe' };
    }
    if (errorMessage.includes('cannot_rent_own_item')) {
        return { code: 'cannot_rent_own_item', message: 'No puedes alquilar tu propio artículo' };
    }
    if (errorMessage.includes('dates_not_available') || errorMessage.includes('dates_no_longer_available')) {
        return { code: 'dates_not_available', message: 'Las fechas seleccionadas ya están reservadas' };
    }
    if (errorMessage.includes('request_not_found')) {
        return { code: 'request_not_found', message: 'La solicitud no existe' };
    }
    if (errorMessage.includes('not_authorized')) {
        return { code: 'not_authorized', message: 'No tienes permiso para realizar esta acción' };
    }
    if (errorMessage.includes('request_not_pending')) {
        return { code: 'request_not_pending', message: 'Esta solicitud ya ha sido procesada' };
    }
    if (errorMessage.includes('invalid_action')) {
        return { code: 'invalid_action', message: 'Acción no válida' };
    }
    
    console.error('Unknown rental error:', error);
    return { code: 'unknown_error', message: error?.message || 'Ha ocurrido un error inesperado' };
}

// ============================================================================
// RENTAL REQUESTS SERVICE
// ============================================================================

export const rentalRequestsService = {
    /**
     * Create a new rental request
     */
    async create(
        itemId: string,
        startDate: Date,
        endDate: Date,
        note?: string
    ): Promise<{ requestId: string } | { error: RentalError }> {
        try {
            const { data, error } = await supabase.rpc('create_rental_request', {
                p_item_id: itemId,
                p_start_date: startDate.toISOString().split('T')[0],
                p_end_date: endDate.toISOString().split('T')[0],
                p_note: note || null
            });

            if (error) {
                return { error: parseRentalError(error) };
            }

            return { requestId: data as string };
        } catch (err) {
            return { error: parseRentalError(err) };
        }
    },

    /**
     * Accept or reject a rental request (owner only)
     */
    async respond(
        requestId: string,
        action: 'accept' | 'reject'
    ): Promise<{ rentalId: string | null } | { error: RentalError }> {
        try {
            const { data, error } = await supabase.rpc('respond_rental_request', {
                p_request_id: requestId,
                p_action: action
            });

            if (error) {
                return { error: parseRentalError(error) };
            }

            return { rentalId: data as string | null };
        } catch (err) {
            return { error: parseRentalError(err) };
        }
    },

    /**
     * Cancel a pending rental request (renter only)
     */
    async cancel(requestId: string): Promise<{ success: true } | { error: RentalError }> {
        try {
            const { error } = await supabase.rpc('cancel_rental_request', {
                p_request_id: requestId
            });

            if (error) {
                return { error: parseRentalError(error) };
            }

            return { success: true };
        } catch (err) {
            return { error: parseRentalError(err) };
        }
    },

    /**
     * Get outgoing requests (requests I made as a renter)
     */
    async listOutgoing(): Promise<RentalRequestWithDetails[]> {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return [];

        const { data, error } = await supabase
            .from('rental_requests_with_items')
            .select('*')
            .eq('renter_id', userData.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching outgoing requests:', error);
            return [];
        }

        return (data || []) as RentalRequestWithDetails[];
    },

    /**
     * Get incoming requests (requests for my items as owner)
     */
    async listIncoming(): Promise<RentalRequestWithDetails[]> {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return [];

        const { data, error } = await supabase
            .from('rental_requests_with_items')
            .select('*')
            .eq('owner_id', userData.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching incoming requests:', error);
            return [];
        }

        return (data || []) as RentalRequestWithDetails[];
    },

    /**
     * Get a single request by ID
     */
    async getById(requestId: string): Promise<RentalRequestWithDetails | null> {
        const { data, error } = await supabase
            .from('rental_requests_with_items')
            .select('*')
            .eq('id', requestId)
            .single();

        if (error) {
            console.error('Error fetching request:', error);
            return null;
        }

        return data as RentalRequestWithDetails;
    },

    /**
     * Get count of pending incoming requests (for badge)
     */
    async getPendingCount(): Promise<number> {
        try {
            const { data, error } = await supabase.rpc('get_pending_requests_count');
            
            if (error) {
                console.error('Error fetching pending count:', error);
                return 0;
            }

            return (data as number) || 0;
        } catch {
            return 0;
        }
    },

    /**
     * Subscribe to realtime changes for the current user's requests
     */
    subscribeToChanges(
        userId: string,
        onInsert: (request: RentalRequest) => void,
        onUpdate: (request: RentalRequest) => void
    ) {
        const channel = supabase
            .channel('rental_requests_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'rental_requests',
                    filter: `owner_id=eq.${userId}`
                },
                (payload) => onInsert(payload.new as RentalRequest)
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'rental_requests',
                    filter: `renter_id=eq.${userId}`
                },
                (payload) => onInsert(payload.new as RentalRequest)
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'rental_requests',
                    filter: `owner_id=eq.${userId}`
                },
                (payload) => onUpdate(payload.new as RentalRequest)
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'rental_requests',
                    filter: `renter_id=eq.${userId}`
                },
                (payload) => onUpdate(payload.new as RentalRequest)
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
};

// ============================================================================
// RENTALS SERVICE (Confirmed bookings)
// ============================================================================

export const rentalsService = {
    /**
     * Get blocked date ranges for an item (for calendar)
     */
    async getBlockedDates(itemId: string): Promise<BlockedDateRange[]> {
        try {
            const { data, error } = await supabase.rpc('get_blocked_dates_for_item', {
                p_item_id: itemId
            });

            if (error) {
                console.error('Error fetching blocked dates:', error);
                return [];
            }

            return (data || []) as BlockedDateRange[];
        } catch {
            return [];
        }
    },

    /**
     * Get all rentals for the current user (as owner or renter)
     */
    async listMine(): Promise<Rental[]> {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return [];

        const { data, error } = await supabase
            .from('rentals')
            .select('*')
            .or(`owner_id.eq.${userData.user.id},renter_id.eq.${userData.user.id}`)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching rentals:', error);
            return [];
        }

        return (data || []) as Rental[];
    },

    /**
     * Get active rentals for a specific item
     */
    async getActiveForItem(itemId: string): Promise<Rental[]> {
        const { data, error } = await supabase
            .from('rentals')
            .select('*')
            .eq('item_id', itemId)
            .eq('status', 'active')
            .order('start_date', { ascending: true });

        if (error) {
            console.error('Error fetching item rentals:', error);
            return [];
        }

        return (data || []) as Rental[];
    }
};
