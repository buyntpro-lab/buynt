/**
 * Service for rental timeline events
 * Uses Supabase RPCs from 20260121_timeline_disputes_system.sql (and 20260122_fix_rpc_return_types.sql)
 * 
 * All action RPCs now return JSONB with structure:
 * {
 *   ok: boolean,
 *   code: string,
 *   message: string,
 *   data?: any,
 *   warnings?: string[]
 * }
 */

import { supabase } from './supabase';
import type { RentalEvent, RentalEventType } from './types';

export interface RpcResponse {
    ok: boolean;
    code: string;
    message: string;
    data?: any;
    warnings?: string[];
}

/**
 * Get all events for a rental (timeline)
 */
export async function getRentalEvents(rentalId: string): Promise<RentalEvent[]> {
    const { data, error } = await supabase
        .rpc('get_rental_events', { p_rental_id: rentalId });

    if (error) {
        console.error('Error fetching rental events:', error);
        return [];
    }

    return (data || []) as RentalEvent[];
}

/**
 * Mark handoff photos as uploaded (called after booking_media upload succeeds)
 * Returns structured RPC response
 */
export async function markHandoffUploaded(rentalId: string): Promise<RpcResponse> {
    const { data, error } = await supabase
        .rpc('mark_handoff_uploaded', { p_rental_id: rentalId });

    if (error) {
        console.error('Error marking handoff uploaded:', error);
        return {
            ok: false,
            code: 'error',
            message: error.message || 'Error al marcar fotos como subidas'
        };
    }

    // Data is now JSONB object, not boolean
    return data || {
        ok: false,
        code: 'unknown',
        message: 'Respuesta vacía del servidor'
    };
}

/**
 * Confirm handoff (owner acknowledges receiving the item)
 * Returns structured RPC response
 */
export async function confirmHandoff(rentalId: string): Promise<RpcResponse> {
    const { data, error } = await supabase
        .rpc('confirm_handoff', { p_rental_id: rentalId });

    if (error) {
        console.error('Error confirming handoff:', error);
        return {
            ok: false,
            code: 'error',
            message: error.message || 'Error al confirmar entrega'
        };
    }

    // Data is now JSONB object, not UUID
    return data || {
        ok: false,
        code: 'unknown',
        message: 'Respuesta vacía del servidor'
    };
}

/**
 * Mark return photos as uploaded
 * Returns structured RPC response
 */
export async function markReturnUploaded(rentalId: string): Promise<RpcResponse> {
    const { data, error } = await supabase
        .rpc('mark_return_uploaded', { p_rental_id: rentalId });

    if (error) {
        console.error('Error marking return uploaded:', error);
        return {
            ok: false,
            code: 'error',
            message: error.message || 'Error al marcar fotos como subidas'
        };
    }

    // Data is now JSONB object, not boolean
    return data || {
        ok: false,
        code: 'unknown',
        message: 'Respuesta vacía del servidor'
    };
}

/**
 * Confirm return (owner acknowledges receiving the item back)
 * Returns structured RPC response
 */
export async function confirmReturn(rentalId: string): Promise<RpcResponse> {
    const { data, error } = await supabase
        .rpc('confirm_return', { p_rental_id: rentalId });

    if (error) {
        console.error('Error confirming return:', error);
        return {
            ok: false,
            code: 'error',
            message: error.message || 'Error al confirmar devolución'
        };
    }

    // Data is now JSONB object, not UUID
    return data || {
        ok: false,
        code: 'unknown',
        message: 'Respuesta vacía del servidor'
    };
}

/**
 * Complete the rental (final step after all confirmations)
 * Returns structured RPC response
 */
export async function completeRental(rentalId: string): Promise<RpcResponse> {
    const { data, error } = await supabase
        .rpc('complete_rental', { p_rental_id: rentalId });

    if (error) {
        console.error('Error completing rental:', error);
        return {
            ok: false,
            code: 'error',
            message: error.message || 'Error al completar alquiler'
        };
    }

    // Data is now JSONB object, not UUID
    return data || {
        ok: false,
        code: 'unknown',
        message: 'Respuesta vacía del servidor'
    };
}

/**
 * Get the latest event type for a rental (to determine current step)
 */
export async function getLatestEventType(rentalId: string): Promise<RentalEventType | null> {
    const events = await getRentalEvents(rentalId);
    if (events.length === 0) return null;
    
    // Events are ordered by created_at DESC from the RPC
    return events[0].event_type;
}

/**
 * Check if a specific event has occurred for this rental
 */
export async function hasEvent(rentalId: string, eventType: RentalEventType): Promise<boolean> {
    const events = await getRentalEvents(rentalId);
    return events.some(e => e.event_type === eventType);
}

// Export as namespace for consistency with other services
export const rentalEventsService = {
    getEvents: getRentalEvents,
    markHandoffUploaded,
    confirmHandoff,
    markReturnUploaded,
    confirmReturn,
    completeRental,
    getLatestEventType,
    hasEvent,
};
