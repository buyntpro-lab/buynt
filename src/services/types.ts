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
    owner_contact: string;
    created_at: string;
    is_available?: boolean;
}

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
