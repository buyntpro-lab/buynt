import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { rentalRequestsService } from '../services/rentalRequestsService';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import type { RentalRequestWithDetails, RentalRequestStatus } from '../services/types';
import toast from 'react-hot-toast';
import {
    ArrowLeft,
    Calendar,
    MapPin,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    MessageSquare,
    RefreshCw,
    CreditCard,
    Shield
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const statusConfig: Record<RentalRequestStatus, { 
    label: string; 
    variant: 'default' | 'success' | 'error' | 'warning';
    icon: React.ReactNode;
    description: string;
}> = {
    pending: { 
        label: 'Pendiente', 
        variant: 'warning',
        icon: <Clock className="w-5 h-5" />,
        description: 'Esperando respuesta del propietario'
    },
    accepted: { 
        label: 'Aceptada', 
        variant: 'success',
        icon: <CheckCircle className="w-5 h-5" />,
        description: '¡Reserva confirmada!'
    },
    rejected: { 
        label: 'Rechazada', 
        variant: 'error',
        icon: <XCircle className="w-5 h-5" />,
        description: 'El propietario ha rechazado la solicitud'
    },
    cancelled: { 
        label: 'Cancelada', 
        variant: 'default',
        icon: <XCircle className="w-5 h-5" />,
        description: 'Solicitud cancelada por el solicitante'
    },
    expired: { 
        label: 'Expirada', 
        variant: 'default',
        icon: <Clock className="w-5 h-5" />,
        description: 'La solicitud ha expirado'
    }
};

export const SolicitudDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [request, setRequest] = useState<RentalRequestWithDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Determine user role
    const isOwner = request?.owner_id === user?.id;
    const isRenter = request?.renter_id === user?.id;
    const canSeeRequest = isOwner || isRenter;

    useEffect(() => {
        const fetchRequest = async () => {
            if (!id) return;
            
            setIsLoading(true);
            try {
                const data = await rentalRequestsService.getById(id);
                setRequest(data);
            } catch (error) {
                console.error('Error fetching request:', error);
                toast.error('Error al cargar la solicitud');
            } finally {
                setIsLoading(false);
            }
        };

        fetchRequest();
    }, [id]);

    const handleCancel = async () => {
        if (!request || !confirm('¿Estás seguro de que quieres cancelar esta solicitud?')) return;
        
        setActionLoading(true);
        const result = await rentalRequestsService.cancel(request.id);
        setActionLoading(false);

        if ('error' in result) {
            toast.error(result.error.message);
            return;
        }

        toast.success('Solicitud cancelada');
        // Refresh the request data
        const updated = await rentalRequestsService.getById(request.id);
        setRequest(updated);
    };

    const handleRespond = async (action: 'accept' | 'reject') => {
        if (!request) return;
        
        const actionText = action === 'accept' ? 'aceptar' : 'rechazar';
        if (!confirm(`¿Estás seguro de que quieres ${actionText} esta solicitud?`)) return;

        setActionLoading(true);
        const result = await rentalRequestsService.respond(request.id, action);
        setActionLoading(false);

        if ('error' in result) {
            toast.error(result.error.message);
            return;
        }

        toast.success(action === 'accept' ? '¡Solicitud aceptada! Se ha creado la reserva.' : 'Solicitud rechazada');
        // Refresh the request data
        const updated = await rentalRequestsService.getById(request.id);
        setRequest(updated);
    };

    const formatDate = (dateStr: string) => {
        return format(parseISO(dateStr), "EEEE, d 'de' MMMM yyyy", { locale: es });
    };

    const formatTimeAgo = (dateStr: string) => {
        return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: es });
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="max-w-3xl mx-auto py-16 px-4 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
            </div>
        );
    }

    // Not found or unauthorized
    if (!request || !canSeeRequest) {
        return (
            <div className="max-w-3xl mx-auto py-12 px-4">
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
                    <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Solicitud no encontrada</h2>
                    <p className="text-slate-500 mb-6">Esta solicitud no existe o no tienes permiso para verla.</p>
                    <Button onClick={() => navigate('/solicitudes')}>Volver a solicitudes</Button>
                </div>
            </div>
        );
    }

    const status = statusConfig[request.status];
    const isPending = request.status === 'pending';

    return (
        <div className="max-w-3xl mx-auto py-6 px-4">
            {/* Back button */}
            <button
                onClick={() => navigate(-1)}
                className="flex items-center text-slate-600 hover:text-slate-900 mb-6 transition-colors"
            >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Volver
            </button>

            {/* Status Banner */}
            <div className={`rounded-2xl p-4 mb-6 flex items-center gap-4 ${
                request.status === 'pending' ? 'bg-amber-50 border border-amber-200' :
                request.status === 'accepted' ? 'bg-green-50 border border-green-200' :
                request.status === 'rejected' ? 'bg-red-50 border border-red-200' :
                'bg-slate-50 border border-slate-200'
            }`}>
                <div className={`p-2 rounded-full ${
                    request.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                    request.status === 'accepted' ? 'bg-green-100 text-green-600' :
                    request.status === 'rejected' ? 'bg-red-100 text-red-600' :
                    'bg-slate-100 text-slate-600'
                }`}>
                    {status.icon}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{status.label}</span>
                        <Badge variant={status.variant}>{request.status}</Badge>
                    </div>
                    <p className="text-sm text-slate-600">{status.description}</p>
                </div>
            </div>

            {/* Item Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                <div className="p-4 md:p-6">
                    <div className="flex gap-4 items-start">
                        <img
                            src={request.item_image_url || '/placeholder-item.jpg'}
                            alt={request.item_title}
                            className="w-24 h-24 md:w-32 md:h-32 rounded-xl object-cover bg-slate-100 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => navigate(`/item/${request.item_id}`)}
                        />
                        <div className="flex-1">
                            <h2 
                                className="text-xl font-bold text-slate-900 mb-2 cursor-pointer hover:text-teal-600 transition-colors"
                                onClick={() => navigate(`/item/${request.item_id}`)}
                            >
                                {request.item_title}
                            </h2>
                            <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                                {request.item_city && (
                                    <span className="flex items-center gap-1">
                                        <MapPin className="w-4 h-4 text-slate-400" />
                                        {request.item_city}
                                    </span>
                                )}
                                {request.item_category && (
                                    <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                                        {request.item_category}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Parties */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
                {/* Owner */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Propietario</p>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 font-bold">
                            {(request.owner_name || request.owner_email || 'P').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-medium text-slate-900">
                                {request.owner_name || 'Sin nombre'}
                                {isOwner && <span className="text-teal-600 text-sm ml-2">(Tú)</span>}
                            </p>
                            <p className="text-sm text-slate-500">{request.owner_email}</p>
                        </div>
                    </div>
                </div>

                {/* Renter */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Solicitante</p>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                            {(request.renter_name || request.renter_email || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-medium text-slate-900">
                                {request.renter_name || 'Sin nombre'}
                                {isRenter && <span className="text-teal-600 text-sm ml-2">(Tú)</span>}
                            </p>
                            <p className="text-sm text-slate-500">{request.renter_email}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dates */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 mb-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-teal-600" />
                    Fechas del alquiler
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Inicio</p>
                        <p className="font-medium text-slate-900">{formatDate(request.start_date)}</p>
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Fin</p>
                        <p className="font-medium text-slate-900">{formatDate(request.end_date)}</p>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-slate-600">
                        <span className="font-semibold text-slate-900">{request.days_count}</span> días de alquiler
                    </p>
                </div>
            </div>

            {/* Price Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 mb-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-teal-600" />
                    Desglose del precio
                </h3>
                <div className="space-y-3">
                    <div className="flex justify-between text-slate-600">
                        <span>{request.days_count} días × {request.daily_price}€/día</span>
                        <span>{(request.days_count * request.daily_price).toFixed(2)}€</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                        <span className="flex items-center gap-1">
                            <Shield className="w-4 h-4" />
                            Fianza reembolsable
                        </span>
                        <span>{request.deposit_amount.toFixed(2)}€</span>
                    </div>
                    {request.service_fee > 0 && (
                        <div className="flex justify-between text-slate-600">
                            <span>Comisión de servicio</span>
                            <span>{request.service_fee.toFixed(2)}€</span>
                        </div>
                    )}
                    <div className="border-t border-slate-200 pt-3 flex justify-between font-bold text-lg text-slate-900">
                        <span>Total</span>
                        <span>{request.total_amount.toFixed(2)}€</span>
                    </div>
                </div>
            </div>

            {/* Note */}
            {request.note && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 mb-6">
                    <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-teal-600" />
                        Mensaje del solicitante
                    </h3>
                    <p className="text-slate-600 bg-slate-50 p-4 rounded-xl">
                        "{request.note}"
                    </p>
                </div>
            )}

            {/* Timeline */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 mb-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-teal-600" />
                    Historial
                </h3>
                <div className="space-y-4">
                    <div className="flex gap-3">
                        <div className="w-2 h-2 mt-2 rounded-full bg-teal-500"></div>
                        <div>
                            <p className="font-medium text-slate-900">Solicitud creada</p>
                            <p className="text-sm text-slate-500">{formatTimeAgo(request.created_at)}</p>
                        </div>
                    </div>
                    {request.responded_at && (
                        <div className="flex gap-3">
                            <div className={`w-2 h-2 mt-2 rounded-full ${
                                request.status === 'accepted' ? 'bg-green-500' :
                                request.status === 'rejected' ? 'bg-red-500' :
                                'bg-slate-400'
                            }`}></div>
                            <div>
                                <p className="font-medium text-slate-900">
                                    {request.status === 'accepted' ? 'Solicitud aceptada' :
                                     request.status === 'rejected' ? 'Solicitud rechazada' :
                                     request.status === 'cancelled' ? 'Solicitud cancelada' :
                                     'Solicitud procesada'}
                                </p>
                                <p className="text-sm text-slate-500">{formatTimeAgo(request.responded_at)}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            {isPending && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6">
                    <h3 className="font-semibold text-slate-900 mb-4">Acciones</h3>
                    
                    {/* Renter actions */}
                    {isRenter && (
                        <div className="flex flex-col gap-3">
                            <p className="text-sm text-slate-600 mb-2">
                                Esperando respuesta del propietario. Puedes cancelar mientras la solicitud esté pendiente.
                            </p>
                            <Button
                                variant="outline"
                                onClick={handleCancel}
                                disabled={actionLoading}
                                className="text-red-600 border-red-200 hover:bg-red-50 w-full md:w-auto"
                            >
                                {actionLoading ? (
                                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <XCircle className="w-4 h-4 mr-2" />
                                )}
                                Cancelar solicitud
                            </Button>
                        </div>
                    )}

                    {/* Owner actions */}
                    {isOwner && (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600">
                                {request.renter_name || 'Un usuario'} quiere alquilar tu artículo. Revisa los detalles y decide.
                            </p>
                            <div className="flex flex-col md:flex-row gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => handleRespond('reject')}
                                    disabled={actionLoading}
                                    className="text-red-600 border-red-200 hover:bg-red-50 flex-1"
                                >
                                    {actionLoading ? (
                                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <XCircle className="w-4 h-4 mr-2" />
                                    )}
                                    Rechazar
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={() => handleRespond('accept')}
                                    disabled={actionLoading}
                                    className="flex-1"
                                >
                                    {actionLoading ? (
                                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                    )}
                                    Aceptar solicitud
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Accepted - Show contact info or message link */}
            {request.status === 'accepted' && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 md:p-6">
                    <div className="flex items-start gap-3">
                        <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-green-800 mb-2">¡Reserva confirmada!</h3>
                            <p className="text-green-700 text-sm mb-4">
                                {isRenter 
                                    ? 'El propietario ha aceptado tu solicitud. Ya puedes coordinar la entrega.'
                                    : 'Has aceptado la solicitud. El solicitante puede contactarte para coordinar.'}
                            </p>
                            {/* TODO: Add link to conversation when messaging is integrated */}
                            <Button
                                variant="outline"
                                onClick={() => navigate('/messages')}
                                className="border-green-300 text-green-700 hover:bg-green-100"
                            >
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Ir a mensajes
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SolicitudDetail;
