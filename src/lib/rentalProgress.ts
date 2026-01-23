/**
 * Rental Progress Calculation Logic
 * 
 * Pure functions for computing rental progress state.
 * Used by both summary card and wizard page.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const MIN_HANDOFF_PHOTOS = 2;
export const MIN_RETURN_PHOTOS = 2;
export const MIN_PHOTOS_PER_PARTY = 2;  // Each party (owner + renter) must upload this many
export const MAX_PHOTOS_PER_PARTY = 6;  // Max photos per party per moment (bloqueante)
export const TOTAL_STEPS = 6;

// ============================================================================
// TYPES
// ============================================================================

export type ProgressStepKey = 
    | 'RESERVATION_CREATED'
    | 'HANDOFF_PHOTOS'
    | 'HANDOFF_CONFIRMED'
    | 'RETURN_PHOTOS'
    | 'RETURN_CONFIRMED'
    | 'RENTAL_COMPLETED';

export type ViewerRole = 'owner' | 'renter' | 'none';
export type UploaderRole = 'owner' | 'renter' | 'unknown';

/**
 * Party-separated photo counts for dual evidence system
 */
export interface PartyCounts {
    ownerHandoff: number;
    renterHandoff: number;
    ownerReturn: number;
    renterReturn: number;
}

export interface ProgressStep {
    key: ProgressStepKey;
    index: number;
    title: string;
    description: string;
    completedDescription: string;
    isComplete: boolean;
    completedAt?: string;
    actorRole: 'owner' | 'renter' | 'either' | 'system';
    actionLabel?: string;
    waitingLabel?: string;
}

export interface RentalProgressData {
    // Rental info
    rentalId: string;
    rentalStatus: 'active' | 'completed' | 'cancelled';
    rentalCreatedAt: string;
    
    // Media counts (legacy - total counts)
    handoffPhotoCount: number;
    returnPhotoCount: number;
    
    // NEW: Party-separated counts for dual evidence
    partyCounts: PartyCounts;
}

export interface RentalProgressData {
    // Rental info
    rentalId: string;
    rentalStatus: 'active' | 'completed' | 'cancelled';
    rentalCreatedAt: string;
    
    // Media counts
    handoffPhotoCount: number;
    returnPhotoCount: number;
    
    // Event flags (from rental_events or computed)
    hasHandoffPhotosEvent: boolean;
    hasHandoffConfirmedEvent: boolean;
    hasReturnPhotosEvent: boolean;
    hasReturnConfirmedEvent: boolean;
    hasCompletedEvent: boolean;
    
    // Timestamps from events
    handoffPhotosAt?: string;
    handoffConfirmedAt?: string;
    returnPhotosAt?: string;
    returnConfirmedAt?: string;
    completedAt?: string;
    
    // Dispute info
    hasOpenDispute: boolean;
    disputeId?: string;
}

export interface ComputedProgress {
    steps: ProgressStep[];
    completedCount: number;
    currentStepIndex: number;
    currentStep: ProgressStep | null;
    progressPercent: number;
    isFullyComplete: boolean;
    isCancelled: boolean;
}

// ============================================================================
// STEP DEFINITIONS
// ============================================================================

const STEP_DEFINITIONS: Array<{
    key: ProgressStepKey;
    title: string;
    description: string;
    completedDescription: string;
    actorRole: 'owner' | 'renter' | 'either' | 'system';
    actionLabel: string;
    waitingLabel: string;
}> = [
    {
        key: 'RESERVATION_CREATED',
        title: 'Reserva creada',
        description: 'Se ha confirmado la solicitud de alquiler',
        completedDescription: 'La reserva está confirmada',
        actorRole: 'system',
        actionLabel: '',
        waitingLabel: '',
    },
    {
        key: 'HANDOFF_PHOTOS',
        title: 'Fotos de entrega',
        description: `Subir mínimo ${MIN_HANDOFF_PHOTOS} fotos del estado del artículo al momento de la entrega`,
        completedDescription: 'Fotos de entrega documentadas',
        actorRole: 'either', // Either party can upload
        actionLabel: 'Subir fotos de entrega',
        waitingLabel: 'Esperando fotos de entrega',
    },
    {
        key: 'HANDOFF_CONFIRMED',
        title: 'Entrega confirmada',
        description: 'El propietario confirma que el artículo fue entregado correctamente',
        completedDescription: 'El artículo fue entregado correctamente',
        actorRole: 'owner',
        actionLabel: 'Confirmar entrega',
        waitingLabel: 'Esperando confirmación del propietario',
    },
    {
        key: 'RETURN_PHOTOS',
        title: 'Fotos de devolución',
        description: `Subir mínimo ${MIN_RETURN_PHOTOS} fotos del estado del artículo al devolver`,
        completedDescription: 'Fotos de devolución documentadas',
        actorRole: 'either', // Either party can upload
        actionLabel: 'Subir fotos de devolución',
        waitingLabel: 'Esperando fotos de devolución',
    },
    {
        key: 'RETURN_CONFIRMED',
        title: 'Devolución confirmada',
        description: 'El propietario confirma que el artículo fue devuelto correctamente',
        completedDescription: 'El artículo fue devuelto correctamente',
        actorRole: 'owner',
        actionLabel: 'Confirmar devolución',
        waitingLabel: 'Esperando confirmación del propietario',
    },
    {
        key: 'RENTAL_COMPLETED',
        title: 'Alquiler completado',
        description: 'Finalizar el proceso de alquiler',
        completedDescription: '¡Todo terminó exitosamente!',
        actorRole: 'owner',
        actionLabel: 'Completar alquiler',
        waitingLabel: 'Esperando que el propietario complete',
    },
];

// ============================================================================
// COMPUTATION FUNCTIONS
// ============================================================================

/**
 * Compute the completion status for each step
 */
function isStepComplete(key: ProgressStepKey, data: RentalProgressData): boolean {
    switch (key) {
        case 'RESERVATION_CREATED':
            // Always true if we have a rental
            return true;
        
        case 'HANDOFF_PHOTOS':
            // DUAL EVIDENCE: Both owner AND renter must upload minimum photos
            const ownerHandoffOk = data.partyCounts.ownerHandoff >= MIN_PHOTOS_PER_PARTY;
            const renterHandoffOk = data.partyCounts.renterHandoff >= MIN_PHOTOS_PER_PARTY;
            return (ownerHandoffOk && renterHandoffOk) || data.hasHandoffPhotosEvent;
            
        case 'HANDOFF_CONFIRMED':
            return data.hasHandoffConfirmedEvent;
            
        case 'RETURN_PHOTOS':
            // DUAL EVIDENCE: Both owner AND renter must upload minimum photos
            const ownerReturnOk = data.partyCounts.ownerReturn >= MIN_PHOTOS_PER_PARTY;
            const renterReturnOk = data.partyCounts.renterReturn >= MIN_PHOTOS_PER_PARTY;
            return (ownerReturnOk && renterReturnOk) || data.hasReturnPhotosEvent;
            
        case 'RETURN_CONFIRMED':
            return data.hasReturnConfirmedEvent;
            
        case 'RENTAL_COMPLETED':
            return data.rentalStatus === 'completed' || data.hasCompletedEvent;
            
        default:
            return false;
    }
}

/**
 * Get completion timestamp for a step
 */
function getStepCompletedAt(key: ProgressStepKey, data: RentalProgressData): string | undefined {
    switch (key) {
        case 'RESERVATION_CREATED':
            return data.rentalCreatedAt;
        case 'HANDOFF_PHOTOS':
            return data.handoffPhotosAt;
        case 'HANDOFF_CONFIRMED':
            return data.handoffConfirmedAt;
        case 'RETURN_PHOTOS':
            return data.returnPhotosAt;
        case 'RETURN_CONFIRMED':
            return data.returnConfirmedAt;
        case 'RENTAL_COMPLETED':
            return data.completedAt;
        default:
            return undefined;
    }
}

/**
 * Main computation function - returns complete progress state
 */
export function computeRentalProgress(data: RentalProgressData): ComputedProgress {
    const isCancelled = data.rentalStatus === 'cancelled';
    
    // Build steps with completion status
    const steps: ProgressStep[] = STEP_DEFINITIONS.map((def, index) => ({
        key: def.key,
        index,
        title: def.title,
        description: def.description,
        completedDescription: def.completedDescription,
        isComplete: isStepComplete(def.key, data),
        completedAt: getStepCompletedAt(def.key, data),
        actorRole: def.actorRole,
        actionLabel: def.actionLabel,
        waitingLabel: def.waitingLabel,
    }));
    
    // Count completed steps (must be sequential - can't skip)
    let completedCount = 0;
    for (const step of steps) {
        if (step.isComplete) {
            completedCount++;
        } else {
            break; // Stop at first incomplete
        }
    }
    
    // Current step is first incomplete (or last if all complete)
    const currentStepIndex = Math.min(completedCount, TOTAL_STEPS - 1);
    const currentStep = completedCount < TOTAL_STEPS ? steps[currentStepIndex] : null;
    
    // Progress percentage
    const progressPercent = Math.round((completedCount / TOTAL_STEPS) * 100);
    
    // Fully complete check
    const isFullyComplete = completedCount === TOTAL_STEPS || data.rentalStatus === 'completed';
    
    return {
        steps,
        completedCount,
        currentStepIndex,
        currentStep,
        progressPercent,
        isFullyComplete,
        isCancelled,
    };
}

// ============================================================================
// HELPER FUNCTIONS FOR DUAL EVIDENCE
// ============================================================================

/**
 * Derive uploader role by comparing uploaded_by with rental owner/renter
 */
export function getUploaderRole(
    uploadedBy: string,
    ownerId: string,
    renterId: string
): UploaderRole {
    if (uploadedBy === ownerId) return 'owner';
    if (uploadedBy === renterId) return 'renter';
    return 'unknown';
}

/**
 * Group booking media by moment and party
 */
export interface GroupedMedia {
    handoff: {
        owner: Array<{ id: string; path: string; created_at: string; uploaded_by: string; note?: string }>;
        renter: Array<{ id: string; path: string; created_at: string; uploaded_by: string; note?: string }>;
        unknown: Array<{ id: string; path: string; created_at: string; uploaded_by: string; note?: string }>;
    };
    return: {
        owner: Array<{ id: string; path: string; created_at: string; uploaded_by: string; note?: string }>;
        renter: Array<{ id: string; path: string; created_at: string; uploaded_by: string; note?: string }>;
        unknown: Array<{ id: string; path: string; created_at: string; uploaded_by: string; note?: string }>;
    };
}

/**
 * Group booking media list into moments and parties
 */
export function groupMediaByMomentAndParty(
    mediaList: Array<{ id: string; type: string; path: string; created_at: string; uploaded_by: string; note?: string }>,
    ownerId: string,
    renterId: string
): GroupedMedia {
    const grouped: GroupedMedia = {
        handoff: { owner: [], renter: [], unknown: [] },
        return: { owner: [], renter: [], unknown: [] }
    };
    
    for (const media of mediaList) {
        const moment = media.type === 'handoff' ? 'handoff' : 'return';
        const role = getUploaderRole(media.uploaded_by, ownerId, renterId);
        grouped[moment][role].push(media);
    }
    
    return grouped;
}

/**
 * Compute party counts from grouped media
 */
export function computePartyCounts(grouped: GroupedMedia): PartyCounts {
    return {
        ownerHandoff: grouped.handoff.owner.length,
        renterHandoff: grouped.handoff.renter.length,
        ownerReturn: grouped.return.owner.length,
        renterReturn: grouped.return.renter.length
    };
}

/**
 * Get the appropriate action for current viewer
 */
export function getStepAction(
    step: ProgressStep,
    viewerRole: ViewerRole,
    canAct: boolean
): { canPerform: boolean; label: string; isWaiting: boolean } {
    // If step is complete, no action needed
    if (step.isComplete) {
        return { canPerform: false, label: '', isWaiting: false };
    }
    
    // System steps have no action
    if (step.actorRole === 'system') {
        return { canPerform: false, label: '', isWaiting: false };
    }
    
    // Check if viewer can perform this action
    const canPerform = canAct && (
        step.actorRole === 'either' ||
        step.actorRole === viewerRole
    );
    
    if (canPerform) {
        return { 
            canPerform: true, 
            label: step.actionLabel || '', 
            isWaiting: false 
        };
    } else {
        return { 
            canPerform: false, 
            label: step.waitingLabel || 'Esperando...', 
            isWaiting: true 
        };
    }
}

/**
 * Check if a step's action is enabled (all prerequisites met)
 */
export function isStepActionEnabled(
    stepKey: ProgressStepKey,
    data: RentalProgressData
): boolean {
    switch (stepKey) {
        case 'HANDOFF_PHOTOS':
            // Can always upload if reservation exists
            return true;
            
        case 'HANDOFF_CONFIRMED':
            // Need handoff photos first
            return data.handoffPhotoCount >= MIN_HANDOFF_PHOTOS || data.hasHandoffPhotosEvent;
            
        case 'RETURN_PHOTOS':
            // Need handoff confirmed first
            return data.hasHandoffConfirmedEvent;
            
        case 'RETURN_CONFIRMED':
            // Need return photos first
            return data.returnPhotoCount >= MIN_RETURN_PHOTOS || data.hasReturnPhotosEvent;
            
        case 'RENTAL_COMPLETED':
            // Need return confirmed first
            return data.hasReturnConfirmedEvent;
            
        default:
            return false;
    }
}
