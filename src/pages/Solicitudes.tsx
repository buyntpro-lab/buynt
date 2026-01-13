import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { rentalRequestsService } from '../services/rentalRequestsService';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import type { RentalRequestWithDetails, RentalRequestStatus } from '../services/types';
import toast from 'react-hot-toast';
import { 
    Send, 
    Inbox, 
    Calendar, 
    MapPin, 
    CheckCircle, 
    XCircle, 
    AlertCircle,
    ChevronRight,
    RefreshCw,
    Package
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

type TabType = 'enviadas' | 'recibidas';

const statusConfig: Record<RentalRequestStatus, { label: string; variant: 'default' | 'success' | 'error' | 'warning' }> = {
    pending: { label: 'Pendiente', variant: 'warning' },
    accepted: { label: 'Aceptada', variant: 'success' },
    rejected: { label: 'Rechazada', variant: 'error' },
    cancelled: { label: 'Cancelada', variant: 'default' },
    expired: { label: 'Expirada', variant: 'default' }
};

export const Solicitudes: React.FC = () => {
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    
    const [activeTab, setActiveTab] = useState<TabType>(
        (searchParams.get('tab') as TabType) || 'enviadas'
    );
    const [outgoingRequests, setOutgoingRequests] = useState<RentalRequestWithDetails[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<RentalRequestWithDetails[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Fetch requests
    const fetchRequests = useCallback(async () => {
        if (!isAuthenticated || !user) return;
        
        setIsLoading(true);
        try {
            const [outgoing, incoming] = await Promise.all([
                rentalRequestsService.listOutgoing(),
                rentalRequestsService.listIncoming()
            ]);
            setOutgoingRequests(outgoing);
            setIncomingRequests(incoming);
        } catch (error) {
            console.error('Error fetching requests:', error);
            toast.error('Error al cargar las solicitudes');
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, user]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    // Setup realtime subscription
    useEffect(() => {
        if (!user?.id) return;

        const unsubscribe = rentalRequestsService.subscribeToChanges(
            user.id,
            () => {
                // On insert - refresh the list
                fetchRequests();
            },
            () => {
                // On update - refresh the list
                fetchRequests();
            }
        );

        return () => {
            unsubscribe();
        };
    }, [user?.id, fetchRequests]);

    // Sync tab with URL
    useEffect(() => {
        const tabFromUrl = searchParams.get('tab') as TabType;
        if (tabFromUrl && (tabFromUrl === 'enviadas' || tabFromUrl === 'recibidas')) {
            setActiveTab(tabFromUrl);
        }
    }, [searchParams]);

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        setSearchParams({ tab });
    };

    // Handle cancel request (renter only)
    const handleCancel = async (requestId: string) => {
        if (!confirm('¿Estás seguro de que quieres cancelar esta solicitud?')) return;
        
        setActionLoading(requestId);
        const result = await rentalRequestsService.cancel(requestId);
        setActionLoading(null);

        if ('error' in result) {
            toast.error(result.error.message);
            return;
        }

        toast.success('Solicitud cancelada');
        fetchRequests();
    };

    // Handle accept/reject (owner only)
    const handleRespond = async (requestId: string, action: 'accept' | 'reject') => {
        const actionText = action === 'accept' ? 'aceptar' : 'rechazar';
        if (!confirm(`¿Estás seguro de que quieres ${actionText} esta solicitud?`)) return;

        setActionLoading(requestId);
        const result = await rentalRequestsService.respond(requestId, action);
        setActionLoading(null);

        if ('error' in result) {
            toast.error(result.error.message);
            return;
        }

        toast.success(action === 'accept' ? '¡Solicitud aceptada!' : 'Solicitud rechazada');
        fetchRequests();
    };

    const formatDateRange = (startDate: string, endDate: string) => {
        const start = parseISO(startDate);
        const end = parseISO(endDate);
        return `${format(start, "d MMM", { locale: es })} - ${format(end, "d MMM yyyy", { locale: es })}`;
    };

    // Not authenticated
    if (!isAuthenticated) {
        return (
            <div className="max-w-4xl mx-auto py-12 px-4 text-center">
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
                    <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Inicia sesión</h2>
                    <p className="text-slate-500 mb-6">Necesitas iniciar sesión para ver tus solicitudes.</p>
                    <Button onClick={() => navigate('/login')}>Iniciar sesión</Button>
                </div>
            </div>
        );
    }

    const pendingIncomingCount = incomingRequests.filter(r => r.status === 'pending').length;
    const currentRequests = activeTab === 'enviadas' ? outgoingRequests : incomingRequests;

    return (
        <div className="max-w-4xl mx-auto py-6 px-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Solicitudes</h1>
                <button 
                    onClick={() => fetchRequests()}
                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                    title="Refrescar"
                >
                    <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                <button
                    onClick={() => handleTabChange('enviadas')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
                        activeTab === 'enviadas'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Send className="w-4 h-4" />
                    <span>Enviadas</span>
                    {outgoingRequests.length > 0 && (
                        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                            {outgoingRequests.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => handleTabChange('recibidas')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
                        activeTab === 'recibidas'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Inbox className="w-4 h-4" />
                    <span>Recibidas</span>
                    {pendingIncomingCount > 0 && (
                        <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                            {pendingIncomingCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Loading State */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
                </div>
            ) : currentRequests.length === 0 ? (
                /* Empty State */
                <div className="text-center py-16 px-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                    <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">
                        {activeTab === 'enviadas' 
                            ? 'No has enviado solicitudes' 
                            : 'No tienes solicitudes recibidas'}
                    </h3>
                    <p className="text-slate-500 mb-6">
                        {activeTab === 'enviadas'
                            ? 'Explora los artículos disponibles y solicita tu primer alquiler.'
                            : 'Cuando alguien solicite alquilar tus artículos, lo verás aquí.'}
                    </p>
                    {activeTab === 'enviadas' && (
                        <Button onClick={() => navigate('/explorar')}>Explorar artículos</Button>
                    )}
                </div>
            ) : (
                /* Request List */
                <div className="space-y-4">
                    {currentRequests.map((request) => (
                        <RequestCard
                            key={request.id}
                            request={request}
                            viewType={activeTab}
                            formatDateRange={formatDateRange}
                            onCancel={handleCancel}
                            onRespond={handleRespond}
                            actionLoading={actionLoading}
                            onViewDetail={() => navigate(`/solicitudes/${request.id}`)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// Request Card Component
interface RequestCardProps {
    request: RentalRequestWithDetails;
    viewType: TabType;
    formatDateRange: (start: string, end: string) => string;
    onCancel: (id: string) => void;
    onRespond: (id: string, action: 'accept' | 'reject') => void;
    actionLoading: string | null;
    onViewDetail: () => void;
}

const RequestCard: React.FC<RequestCardProps> = ({
    request,
    viewType,
    formatDateRange,
    onCancel,
    onRespond,
    actionLoading,
    onViewDetail
}) => {
    const status = statusConfig[request.status];
    const isActionLoading = actionLoading === request.id;
    const isPending = request.status === 'pending';

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-4 md:p-6">
                <div className="flex gap-4">
                    {/* Item Image */}
                    <div className="flex-shrink-0">
                        <img
                            src={request.item_image_url || '/placeholder-item.jpg'}
                            alt={request.item_title}
                            className="w-20 h-20 md:w-24 md:h-24 rounded-xl object-cover bg-slate-100"
                        />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="font-semibold text-slate-900 truncate">
                                {request.item_title}
                            </h3>
                            <Badge variant={status.variant}>{status.label}</Badge>
                        </div>

                        {/* User info */}
                        <p className="text-sm text-slate-500 mb-2">
                            {viewType === 'enviadas' 
                                ? `De: ${request.owner_name || request.owner_email}`
                                : `De: ${request.renter_name || request.renter_email}`
                            }
                        </p>

                        {/* Date & Location */}
                        <div className="flex flex-wrap gap-3 text-sm text-slate-600 mb-3">
                            <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                {formatDateRange(request.start_date, request.end_date)}
                            </span>
                            {request.item_city && (
                                <span className="flex items-center gap-1">
                                    <MapPin className="w-4 h-4 text-slate-400" />
                                    {request.item_city}
                                </span>
                            )}
                        </div>

                        {/* Price breakdown */}
                        <div className="flex items-center gap-4 text-sm">
                            <span className="text-slate-600">
                                {request.days_count} días × {request.daily_price}€
                            </span>
                            <span className="font-semibold text-slate-900">
                                Total: {request.total_amount}€
                            </span>
                        </div>

                        {/* Note if exists */}
                        {request.note && (
                            <p className="mt-3 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg line-clamp-2">
                                "{request.note}"
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions Footer */}
            <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between gap-2">
                <button
                    onClick={onViewDetail}
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                >
                    Ver detalle <ChevronRight className="w-4 h-4" />
                </button>

                <div className="flex gap-2">
                    {/* Renter actions (outgoing) */}
                    {viewType === 'enviadas' && isPending && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onCancel(request.id)}
                            disabled={isActionLoading}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                            {isActionLoading ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Cancelar
                                </>
                            )}
                        </Button>
                    )}

                    {/* Owner actions (incoming) */}
                    {viewType === 'recibidas' && isPending && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onRespond(request.id, 'reject')}
                                disabled={isActionLoading}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                                {isActionLoading ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <XCircle className="w-4 h-4 mr-1" />
                                        Rechazar
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => onRespond(request.id, 'accept')}
                                disabled={isActionLoading}
                            >
                                {isActionLoading ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        Aceptar
                                    </>
                                )}
                            </Button>
                        </>
                    )}

                    {/* Status badge for processed requests */}
                    {request.status === 'accepted' && (
                        <span className="text-sm text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Reserva confirmada
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Solicitudes;
