import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';
import type { Request, Item } from '../services/types';

export const MyRequests: React.FC = () => {
    const { user, isAuthenticated } = useAuth();
    const [requestsWithItems, setRequestsWithItems] = useState<{ request: Request, item: Item }[]>([]);

    useEffect(() => {
        if (!isAuthenticated || !user) return;

        // In a real app we'd query API. Here we filter all requests by requester_contact
        const allRequests = db.requests.getAll();
        const myRequests = allRequests.filter(r =>
            r.requester_contact === user.email
        );

        const enriched = myRequests.map(r => {
            const item = db.items.getById(r.item_id);
            return item ? { request: r, item } : null;
        }).filter(Boolean) as { request: Request, item: Item }[];

        setRequestsWithItems(enriched);
    }, [user, isAuthenticated]);

    if (!isAuthenticated) return <div className="p-8 text-center text-slate-500">Please login to view requests.</div>;

    return (
        <div className="max-w-4xl mx-auto py-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-8">Mis Solicitudes Enviadas</h1>

            {requestsWithItems.length === 0 ? (
                <div className="text-center py-12 p-8 bg-white rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-slate-500">No has hecho ninguna solicitud.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {requestsWithItems.map(({ request, item }) => (
                        <div key={request.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                            <div className="flex gap-4 items-center">
                                <img src={item.image_url} alt={item.title} className="w-16 h-16 rounded-lg object-cover bg-slate-100" />
                                <div>
                                    <h3 className="font-bold text-slate-800">{item.title}</h3>
                                    <div className="text-sm text-slate-500">
                                        {request.start_date} - {request.end_date}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">
                                        Propietario: {item.owner_name}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                                <Badge variant={request.status === 'accepted' ? 'success' : request.status === 'rejected' ? 'error' : 'default'}>
                                    {request.status === 'pending' ? 'Pendiente' : request.status === 'accepted' ? 'Aceptada' : 'Rechazada'}
                                </Badge>
                                {request.status === 'accepted' && (
                                    <div className="text-sm text-green-600 font-medium">
                                        Contacto: {item.owner_contact}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
