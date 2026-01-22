/**
 * useRentalProgress Hook
 * 
 * Single source of truth for rental progress data and computation.
 * Fetches all required data and computes progress state.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import type { RentalEvent } from '../services/types';
import {
    computeRentalProgress,
    groupMediaByMomentAndParty,
    computePartyCounts,
    type RentalProgressData,
    type ComputedProgress,
    type ViewerRole,
    type GroupedMedia,
    type PartyCounts
} from '../lib/rentalProgress';

// ============================================================================
// TYPES
// ============================================================================

interface RentalInfo {
    id: string;
    status: 'active' | 'completed' | 'cancelled';
    owner_id: string;
    renter_id: string;
    created_at: string;
    item_id: string;
    item_title?: string;
    item_image_url?: string;
}

interface UseRentalProgressResult {
    // Loading states
    isLoading: boolean;
    error: string | null;
    
    // Rental info
    rental: RentalInfo | null;
    viewerRole: ViewerRole;
    
    // Progress data
    progressData: RentalProgressData | null;
    progress: ComputedProgress | null;
    
    // Events for timeline
    events: RentalEvent[];
    
    // Media counts (legacy - total)
    handoffPhotoCount: number;
    returnPhotoCount: number;
    
    // NEW: Grouped media by moment and party
    groupedMedia: GroupedMedia | null;
    partyCounts: PartyCounts;
    
    // Dispute info
    handoffPhotoCount: number;
    returnPhotoCount: number;
    
    // Dispute
    hasOpenDispute: boolean;
    disputeId: string | null;
    
    // Actions
    refresh: () => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useRentalProgress(rentalId: string | undefined): UseRentalProgressResult {
    const { user } = useAuth();
    
    // CRITICAL: Start with isLoading=false to render grid INSTANTLY
    // Data loads in background without blocking UI
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [rental, setRental] = useState<RentalInfo | null>(null);
    const [events, setEvents] = useState<RentalEvent[]>([]);
    const [handoffPhotoCount, setHandoffPhotoCount] = useState(0);
    const [returnPhotoCount, setReturnPhotoCount] = useState(0);
    const [groupedMedia, setGroupedMedia] = useState<GroupedMedia | null>(null);
    const [partyCounts, setPartyCounts] = useState<PartyCounts>({
        ownerHandoff: 0,
        renterHandoff: 0,
        ownerReturn: 0,
        renterReturn: 0
    });
    const [hasOpenDispute, setHasOpenDispute] = useState(false);
    const [disputeId, setDisputeId] = useState<string | null>(null);
    
    // Compute viewer role
    const viewerRole: ViewerRole = rental
        ? rental.owner_id === user?.id 
            ? 'owner' 
            : rental.renter_id === user?.id 
                ? 'renter' 
                : 'none'
        : 'none';
    
    // Fetch all data
    const fetchData = useCallback(async () => {
        if (!rentalId || !user?.id) {
            setIsLoading(false);
            return;
        }
        
        setIsLoading(true);
        setError(null);
        
        try {
            // Fetch rental info with item details
            const { data: rentalData, error: rentalError } = await supabase
                .from('rentals')
                .select(`
                    id,
                    status,
                    owner_id,
                    renter_id,
                    created_at,
                    item_id,
                    items (
                        title,
                        image_url
                    )
                `)
                .eq('id', rentalId)
                .single();
            
            if (rentalError) {
                // Try without join if items join fails
                const { data: basicRental, error: basicError } = await supabase
                    .from('rentals')
                    .select('id, status, owner_id, renter_id, created_at, item_id')
                    .eq('id', rentalId)
                    .single();
                
                if (basicError) {
                    throw new Error('No se pudo cargar el alquiler');
                }
                
                setRental({
                    ...basicRental,
                    status: basicRental.status as 'active' | 'completed' | 'cancelled',
                    item_title: undefined,
                    item_image_url: undefined,
                });
            } else {
                const items = rentalData.items as { title?: string; image_url?: string } | null;
                setRental({
                    id: rentalData.id,
                    status: rentalData.status as 'active' | 'completed' | 'cancelled',
                    owner_id: rentalData.owner_id,
                    renter_id: rentalData.renter_id,
                    created_at: rentalData.created_at,
                    item_id: rentalData.item_id,
                    item_title: items?.title,
                    item_image_url: items?.image_url,
                });
            }
            
            // Fetch rental events (try RPC first, fallback to direct query)
            let fetchedEvents: RentalEvent[] = [];
            const { data: eventsData, error: eventsError } = await supabase
                .rpc('get_rental_events', { p_rental_id: rentalId });
            
            if (eventsError) {
                console.warn('RPC get_rental_events failed, trying direct query:', eventsError.message);
                // Fallback: direct query (may fail if table doesn't exist)
                const { data: directEvents } = await supabase
                    .from('rental_events')
                    .select('*')
                    .eq('rental_id', rentalId)
                    .order('created_at', { ascending: true });
                
                fetchedEvents = (directEvents || []) as RentalEvent[];
            } else {
                fetchedEvents = (eventsData || []) as RentalEvent[];
            }
            setEvents(fetchedEvents);
            
            // Fetch booking_media with ALL fields needed for party separation
            const { data: mediaList, error: mediaError } = await supabase
                .from('booking_media')
                .select('id, type, path, bucket, uploaded_by, created_at, note')
                .eq('rental_id', rentalId)
                .order('created_at', { ascending: true });
            
            if (!mediaError && mediaList && rentalData) {
                // Compute legacy total counts
                const handoff = mediaList.filter(m => m.type === 'handoff').length;
                const returnCount = mediaList.filter(m => m.type === 'return').length;
                setHandoffPhotoCount(handoff);
                setReturnPhotoCount(returnCount);
                
                // NEW: Group by moment and party
                const grouped = groupMediaByMomentAndParty(
                    mediaList,
                    rentalData.owner_id,
                    rentalData.renter_id
                );
                setGroupedMedia(grouped);
                
                // Compute party counts
                const counts = computePartyCounts(grouped);
                setPartyCounts(counts);
            }
            
            // Check for open dispute
            const { data: disputeData } = await supabase
                .from('disputes')
                .select('id, status')
                .eq('rental_id', rentalId)
                .eq('status', 'open')
                .limit(1)
                .maybeSingle();
            
            if (disputeData) {
                setHasOpenDispute(true);
                setDisputeId(disputeData.id);
            } else {
                setHasOpenDispute(false);
                setDisputeId(null);
            }
            
        } catch (err) {
            console.error('Error fetching rental progress:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setIsLoading(false);
        }
    }, [rentalId, user?.id]);
    
    // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    // Build progress data from fetched data
    const progressData: RentalProgressData | null = rental ? {
        rentalId: rental.id,
        rentalStatus: rental.status,
        rentalCreatedAt: rental.created_at,
        
        handoffPhotoCount,
        returnPhotoCount,
        partyCounts,  // NEW
        
        // Extract event flags from events array
        hasHandoffPhotosEvent: events.some(e => e.event_type === 'HANDOFF_PHOTOS_UPLOADED'),
        hasHandoffConfirmedEvent: events.some(e => e.event_type === 'HANDOFF_CONFIRMED'),
        hasReturnPhotosEvent: events.some(e => e.event_type === 'RETURN_PHOTOS_UPLOADED'),
        hasReturnConfirmedEvent: events.some(e => e.event_type === 'RETURN_CONFIRMED'),
        hasCompletedEvent: events.some(e => e.event_type === 'RENTAL_COMPLETED'),
        
        // Extract timestamps
        handoffPhotosAt: events.find(e => e.event_type === 'HANDOFF_PHOTOS_UPLOADED')?.created_at,
        handoffConfirmedAt: events.find(e => e.event_type === 'HANDOFF_CONFIRMED')?.created_at,
        returnPhotosAt: events.find(e => e.event_type === 'RETURN_PHOTOS_UPLOADED')?.created_at,
        returnConfirmedAt: events.find(e => e.event_type === 'RETURN_CONFIRMED')?.created_at,
        completedAt: events.find(e => e.event_type === 'RENTAL_COMPLETED')?.created_at,
        
        hasOpenDispute,
        disputeId: disputeId || undefined,
    } : null;
    
    // Compute progress
    const progress = progressData ? computeRentalProgress(progressData) : null;
    
    return {
        isLoading,
        error,
        rental,
        viewerRole,
        progressData,
        progress,
        events,
        handoffPhotoCount,
        returnPhotoCount,
        groupedMedia,  // NEW
        partyCounts,   // NEW
        hasOpenDispute,
        disputeId,
        refresh: fetchData,
    };
}

export default useRentalProgress;
