import type { Item } from './types';
import { v4 as uuidv4 } from 'uuid';

const ITEMS_KEY = 'buynt_items';

// Seed Data
const SEED_ITEMS: Item[] = [
    {
        id: '1',
        title: 'Bicicleta urbana',
        description: 'Bicicleta ligera ideal para pasear por la ciudad. Frenos nuevos.',
        price_day: 20,
        city: 'Madrid',
        image_url: 'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&q=80&w=800',
        category: 'Bike',
        owner_name: 'Carlos',
        owner_contact: '+34600123456',
        created_at: new Date().toISOString(),
        is_available: true,
    },
    {
        id: '2',
        title: 'Esquís de pista',
        description: 'Esquís Rossignol 165cm, perfectos para nivel intermedio. Encerados.',
        price_day: 15,
        city: 'Granada',
        image_url: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&q=80&w=800',
        category: 'Ski',
        owner_name: 'Marta',
        owner_contact: 'marta@example.com',
        created_at: new Date().toISOString(),
        is_available: true,
    },
    {
        id: '3',
        title: 'Tabla surf softboard 7’0',
        description: 'Tabla perfecta para iniciación. Mucha flotabilidad.',
        price_day: 18,
        city: 'Cádiz',
        image_url: 'https://images.unsplash.com/photo-1531565637446-32307b194362?auto=format&fit=crop&q=80&w=800',
        category: 'Surf',
        owner_name: 'Pablo',
        owner_contact: '+34600999888',
        created_at: new Date().toISOString(),
        is_available: true,
    },
    {
        id: '4',
        title: 'Raquetas de pádel',
        description: 'Pack de 2 raquetas Bullpadel con pelotas incluidas.',
        price_day: 8,
        city: 'Madrid',
        image_url: 'https://images.unsplash.com/photo-1628283335503-4c570b684534?auto=format&fit=crop&q=80&w=800',
        category: 'Paddel',
        owner_name: 'Ana',
        owner_contact: 'ana@example.com',
        created_at: new Date().toISOString(),
        is_available: true,
    }
];

// Helper to initialize data
const initData = () => {
    if (!localStorage.getItem(ITEMS_KEY)) {
        localStorage.setItem(ITEMS_KEY, JSON.stringify(SEED_ITEMS));
    }
};

initData();

export const db = {
    items: {
        getAll: (): Item[] => {
            const items = localStorage.getItem(ITEMS_KEY);
            return items ? JSON.parse(items) : [];
        },
        getById: (id: string): Item | undefined => {
            const items = db.items.getAll();
            return items.find((i) => i.id === id);
        },
        add: (item: Omit<Item, 'id' | 'created_at' | 'is_available'>): Item => {
            const items = db.items.getAll();
            const newItem: Item = {
                ...item,
                id: uuidv4(),
                created_at: new Date().toISOString(),
                is_available: true,
            };
            items.unshift(newItem); // Add to beginning
            localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
            return newItem;
        },
        update: (id: string, updates: Partial<Item>) => {
            const items = db.items.getAll();
            const index = items.findIndex(i => i.id === id);
            if (index !== -1) {
                items[index] = { ...items[index], ...updates };
                localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
            }
        },
        delete: (id: string) => { // Simple delete for "My Items"
            let items = db.items.getAll();
            items = items.filter(i => i.id !== id);
            localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
        }
    },
    // NOTE: Legacy requests object removed in consolidation_A
    // All request operations now use rentalRequestsService with Supabase RPCs
};
