import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import type { Request, Item } from '../services/types';

export const Inbox: React.FC = () => {
    const { user, isAuthenticated } = useAuth();
    const [incomingRequests, setIncomingRequests] = useState<{ request: Request, item: Item }[]>([]);

    const loadRequests = () => {
        if (!isAuthenticated || !user) return;

        // Use the helper we defined in db.ts, or manual filter
        const requests = db.requests.getByOwnerContact(user.email);

        // Enrich
        const enriched = requests.map(r => {
            const item = db.items.getById(r.item_id);
            return item ? { request: r, item } : null;
        }).filter(Boolean) as { request: Request, item: Item }[];

        // Sort by date desc (recent first)
        enriched.sort((a, b) => new Date(b.request.created_at).getTime() - new Date(a.request.created_at).getTime());

        setIncomingRequests(enriched);
    };

    useEffect(() => {
        loadRequests();
    }, [user, isAuthenticated]);

    const handleStatusChange = (id: string, status: 'accepted' | 'rejected') => {
        db.requests.updateStatus(id, status);
        loadRequests();
    };

    if (!isAuthenticated) return <div className="p-8 text-center text-slate-500">Please login to view inbox.</div>;

    return (
        <div className="max-w-4xl mx-auto py-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-8">Solicitudes Recibidas</h1>
            {incomingRequests.length === 0 ? (
                <div className="text-center py-12 p-8 bg-white rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-slate-500">No tienes solicitudes pendientes.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {incomingRequests.map(({ request, item }) => (
                        <div key={request.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                                <div className="flex gap-4 items-center">
                                    <img src={item.image_url} alt={item.title} className="w-12 h-12 rounded-lg object-cover bg-slate-100" />
                                    <div>
                                        <div className="font-bold text-slate-800">Solicitud para: {item.title}</div>
                                        <div className="text-xs text-slate-500">De: {request.requester_name}</div>
                                    </div>
                                </div>
                                <div className="text-sm font-medium text-slate-500">
                                    {new Date(request.created_at).toLocaleDateString()}
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700">
                                <div className="flex gap-4 mb-2">
                                    <div className="font-semibold">Fechas:</div>
                                    <div>{request.start_date} al {request.end_date}</div>
                                </div>
                                {request.message && (
                                    <div className="italic">"{request.message}"</div>
                                )}
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                <div className="text-sm text-slate-500">
                                    Estado: <span className="font-medium capitalize">{request.status}</span>
                                </div>
                                {request.status === 'pending' && (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-red-500 hover:bg-red-50 hover:text-red-600 border-red-200"
                                            onClick={() => handleStatusChange(request.id, 'rejected')}
                                        >
                                            <X className="w-4 h-4 mr-1" /> Rechazar
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="bg-green-600 hover:bg-green-700 text-white"
                                            onClick={() => handleStatusChange(request.id, 'accepted')}
                                        >
                                            <Check className="w-4 h-4 mr-1" /> Aceptar
                                        </Button>
                                    </div>
                                )}
                                {request.status === 'accepted' && (
                                    <div className="flex items-center gap-2 text-green-600 font-medium text-sm">
                                        <Check className="w-4 h-4" /> Contacto enviado al usuario
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
