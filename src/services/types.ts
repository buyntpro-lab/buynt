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
    message: string;
    status: 'pending' | 'accepted' | 'rejected';
    created_at: string;
}

export interface User {
    id: string;
    email: string;
    name: string;
}
