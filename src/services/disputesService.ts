/**
 * Service for disputes management
 * Uses existing Supabase RPCs from 20260121_timeline_disputes_system.sql
 */

import { supabase } from './supabase';
import type { Dispute, DisputeMessage, DisputeWithMessages } from './types';

/**
 * Get a dispute with all its messages
 */
export async function getDisputeWithMessages(disputeId: string): Promise<DisputeWithMessages | null> {
    const { data, error } = await supabase
        .rpc('get_dispute_with_messages', { p_dispute_id: disputeId });

    if (error) {
        console.error('Error fetching dispute:', error);
        return null;
    }

    return data as DisputeWithMessages | null;
}

/**
 * Get dispute for a rental (if any)
 */
export async function getDisputeByRentalId(rentalId: string): Promise<Dispute | null> {
    const { data, error } = await supabase
        .from('disputes')
        .select('*')
        .eq('rental_id', rentalId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // No rows returned - no dispute exists
            return null;
        }
        console.error('Error fetching dispute for rental:', error);
        return null;
    }

    return data as Dispute;
}

/**
 * Get all messages for a dispute
 */
export async function getDisputeMessages(disputeId: string): Promise<DisputeMessage[]> {
    const { data, error } = await supabase
        .from('dispute_messages')
        .select('*')
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching dispute messages:', error);
        return [];
    }

    return (data || []) as DisputeMessage[];
}

/**
 * Open a new dispute for a rental
 */
export async function openDispute(rentalId: string, reason: string): Promise<string | null> {
    const { data, error } = await supabase
        .rpc('open_dispute', { 
            p_rental_id: rentalId,
            p_reason: reason
        });

    if (error) {
        console.error('Error opening dispute:', error);
        return null;
    }

    // RPC returns the new dispute ID
    return data as string;
}

/**
 * Add a message to a dispute
 */
export async function addMessage(disputeId: string, body: string): Promise<string | null> {
    const { data, error } = await supabase
        .rpc('add_dispute_message', {
            p_dispute_id: disputeId,
            p_body: body
        });

    if (error) {
        console.error('Error adding dispute message:', error);
        return null;
    }

    // RPC returns the new message ID
    return data as string;
}

/**
 * Resolve a dispute (only participant who didn't open it)
 */
export async function resolveDispute(disputeId: string, resolutionNote: string): Promise<boolean> {
    const { data, error } = await supabase
        .rpc('resolve_dispute', {
            p_dispute_id: disputeId,
            p_resolution_note: resolutionNote
        });

    if (error) {
        console.error('Error resolving dispute:', error);
        return false;
    }

    return data === true;
}

/**
 * Get all disputes where user is a participant (owner or renter of the rental)
 */
export async function getMyDisputes(): Promise<Dispute[]> {
    // This requires joining with rentals to check participation
    // For now, fetch from view or direct query
    const { data, error } = await supabase
        .from('disputes')
        .select(`
            *,
            rentals!inner (
                owner_id,
                renter_id
            )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching my disputes:', error);
        return [];
    }

    // RLS will filter to only participant's disputes
    return (data || []).map(d => ({
        id: d.id,
        rental_id: d.rental_id,
        opened_by: d.opened_by,
        reason: d.reason,
        status: d.status,
        created_at: d.created_at,
        updated_at: d.updated_at,
        resolved_at: d.resolved_at,
        resolved_by: d.resolved_by,
        resolution_note: d.resolution_note,
    })) as Dispute[];
}

/**
 * Check if rental has an open dispute
 */
export async function hasOpenDispute(rentalId: string): Promise<boolean> {
    const dispute = await getDisputeByRentalId(rentalId);
    return dispute !== null && dispute.status === 'open';
}

// Export as namespace for consistency with other services
export const disputesService = {
    getWithMessages: getDisputeWithMessages,
    getByRentalId: getDisputeByRentalId,
    getMessages: getDisputeMessages,
    open: openDispute,
    addMessage,
    resolve: resolveDispute,
    getMine: getMyDisputes,
    hasOpenDispute,
};
