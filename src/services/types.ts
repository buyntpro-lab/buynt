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
