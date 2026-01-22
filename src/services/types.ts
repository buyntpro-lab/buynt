export interface Item {
    id: string;
    title: string;
    description: string;
    price_day: number;
    city: string;
    image_url: string;
    category?: string;
    owner_id?: string;
    owner_name: string;
    owner_contact?: string;  // Optional: only included for item owner, hidden in public views
    created_at: string;
    is_available?: boolean;
    image_migrated_at?: string;  // Timestamp when image was migrated to Storage
}

// ============================================================================
// ITEM IMAGES TYPES (Storage-based photos)
// ============================================================================

export interface ItemImage {
    id: string;
    item_id: string;
    path: string;
    bucket: string;
    is_cover: boolean;
    sort: number;
    width?: number;
    height?: number;
    mime?: string;
    bytes?: number;
    source_url?: string;  // Original URL if migrated
    created_by: string;
    created_at: string;
}

// For creating new images
export interface ItemImageInsert {
    item_id: string;
    path: string;
    bucket?: string;
    is_cover?: boolean;
    sort?: number;
    width?: number;
    height?: number;
    mime?: string;
    bytes?: number;
    source_url?: string;
    created_by: string;
}

// ============================================================================
// BOOKING MEDIA TYPES (Handoff/Return evidence)
// ============================================================================

export type BookingMediaType = 'handoff' | 'return';

export interface BookingMedia {
    id: string;
    rental_id: string;
    type: BookingMediaType;
    path: string;
    bucket: string;
    bytes?: number;
    note?: string;
    uploaded_by: string;
    created_at: string;
}

// For creating new booking media
export interface BookingMediaInsert {
    rental_id: string;
    type: BookingMediaType;
    path: string;
    bucket?: string;
    bytes?: number;
    note?: string;
    uploaded_by: string;
}

// ============================================================================
// LEGACY REQUEST TYPE - DEPRECATED (consolidation_A)
// ============================================================================
// DO NOT USE: This interface maps to the old `requests` table which is locked down.
// Use RentalRequest and RentalRequestWithDetails types instead.
// See rentalRequestsService.ts for the modern API.
// ============================================================================
/**
 * @deprecated Use RentalRequest or RentalRequestWithDetails instead.
 * This interface maps to the legacy `requests` table which is now locked with RLS deny-all.
 */
export interface Request {
    id: string;
    item_id: string;
    requester_name: string;
    requester_contact: string;
    start_date: string;
    end_date: string;
    total_price: number;
    message: string;
    status: 'pending' | 'accepted' | 'rejected';
    created_at: string;
}

export interface Message {
    id: string;
    booking_id?: string;
    product_id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    is_read: boolean;
    created_at: string;
}

export interface User {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
    dni_verified?: boolean;
    phone?: string;
    created_at?: string;
}

// ============================================================================
// CHAT SYSTEM TYPES
// ============================================================================

export interface Conversation {
    id: string;
    product_id: string;
    owner_id: string;
    renter_id: string;
    created_at: string;
    updated_at: string;
    owner_last_read_at?: string;
    renter_last_read_at?: string;
}

export interface ChatMessage {
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string;
    created_at: string;
}

export interface MessageAttachment {
    id: string;
    message_id: string;
    conversation_id: string;
    storage_path: string;
    mime_type?: string;
    file_name: string;
    file_size: number;
    created_at: string;
}

export interface UserBlock {
    id: string;
    blocker_id: string;
    blocked_id: string;
    created_at: string;
}

export interface Notification {
    id: string;
    user_id: string;
    type: 'message';
    conversation_id?: string;
    payload: Record<string, any>;
    created_at: string;
    read_at?: string;
}

export interface ConversationListItem {
    conversation_id: string;
    product_id: string;
    product_title: string;
    product_image_url: string;
    product_owner_name: string;
    other_user_id: string;
    other_user_email: string;
    other_user_name: string;
    last_message_body?: string;
    last_message_at?: string;
    last_message_sender_id?: string;
    unread_count: number;
    is_read: boolean;
}

// ============================================================================
// RENTAL REQUESTS SYSTEM TYPES
// ============================================================================

export type RentalRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
export type RentalStatus = 'active' | 'completed' | 'cancelled';

export interface RentalRequest {
    id: string;
    item_id: string;
    owner_id: string;
    renter_id: string;
    start_date: string;         // ISO date string (YYYY-MM-DD)
    end_date: string;           // ISO date string (YYYY-MM-DD)
    daily_price: number;
    days_count: number;
    deposit_amount: number;
    service_fee: number;
    total_amount: number;
    currency: string;
    note: string | null;
    status: RentalRequestStatus;
    created_at: string;
    updated_at: string;
    responded_at: string | null;
    rental_id: string | null;
}

export interface RentalRequestWithDetails extends RentalRequest {
    item_title: string;
    item_image_url: string;
    item_city: string;
    item_category: string;
    owner_name: string | null;
    owner_email: string | null;
    renter_name: string | null;
    renter_email: string | null;
}

export interface Rental {
    id: string;
    request_id: string | null;
    item_id: string;
    owner_id: string;
    renter_id: string;
    start_date: string;
    end_date: string;
    daily_price: number;
    days_count: number;
    deposit_amount: number;
    service_fee: number;
    total_amount: number;
    currency: string;
    status: RentalStatus;
    created_at: string;
    updated_at: string;
}

// Extended rental with item and user details
export interface RentalWithDetails extends Rental {
    item_title: string;
    item_image_url: string;
    item_city: string;
    owner_name: string | null;
    owner_email: string | null;
    renter_name: string | null;
    renter_email: string | null;
    // Progress flags
    handoff_uploaded: boolean;
    handoff_confirmed: boolean;
    return_uploaded: boolean;
    return_confirmed: boolean;
    has_open_dispute: boolean;
}

export interface BlockedDateRange {
    start_date: string;
    end_date: string;
}

// ============================================================================
// RENTAL EVENTS (Timeline) TYPES
// ============================================================================

export type RentalEventType = 
    | 'RENTAL_CREATED'
    | 'HANDOFF_PHOTOS_UPLOADED'
    | 'HANDOFF_CONFIRMED'
    | 'RETURN_PHOTOS_UPLOADED'
    | 'RETURN_CONFIRMED'
    | 'RENTAL_COMPLETED'
    | 'RENTAL_CANCELLED'
    | 'DISPUTE_OPENED'
    | 'DISPUTE_RESOLVED';

export interface RentalEvent {
    id: string;
    rental_id: string;
    event_type: RentalEventType;
    actor_id: string | null;
    actor_email?: string;
    payload: Record<string, any>;
    created_at: string;
}

// ============================================================================
// DISPUTES TYPES
// ============================================================================

export type DisputeStatus = 'open' | 'resolved' | 'closed';

export interface Dispute {
    id: string;
    rental_id: string;
    opened_by: string;
    opener_email?: string;
    reason: string;
    status: DisputeStatus;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
    resolved_by: string | null;
    resolver_email?: string;
    resolution_note: string | null;
}

export interface DisputeMessage {
    id: string;
    dispute_id: string;
    sender_id: string;
    sender_email?: string;
    body: string;
    created_at: string;
}

export interface DisputeWithMessages extends Dispute {
    messages: DisputeMessage[];
}
