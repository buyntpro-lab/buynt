/**
 * RentalActions Component
 * 
 * Displays contextual action buttons based on rental state.
 * Handles: confirm handoff, confirm return, complete rental, open dispute.
 */

import React, { useState } from 'react';
import { Button } from '../common/Button';
import type { RentalEvent } from '../../services/types';
import { rentalEventsService } from '../../services/rentalEventsService';
import { disputesService } from '../../services/disputesService';
import {
    HandMetal,
    RotateCcw,
    PartyPopper,
    AlertTriangle,
    RefreshCw,
    CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface RentalActionsProps {
    rentalId: string;
    events: RentalEvent[];
    isOwner: boolean;
    isRenter: boolean;
    rentalStatus: 'active' | 'completed' | 'cancelled';
    hasOpenDispute: boolean;
    onActionComplete: () => void;
}

type ActionType = 'confirmHandoff' | 'confirmReturn' | 'complete' | 'openDispute';

export const RentalActions: React.FC<RentalActionsProps> = ({
    rentalId,
    events,
    isOwner,
    isRenter,
    rentalStatus,
    hasOpenDispute,
    onActionComplete,
}) => {
    const [loadingAction, setLoadingAction] = useState<ActionType | null>(null);
    const [disputeReason, setDisputeReason] = useState('');
    const [showDisputeForm, setShowDisputeForm] = useState(false);

    // Get completed event types
    const completedTypes = new Set(events.map(e => e.event_type));

    // Determine which actions are available
    const handoffPhotosUploaded = completedTypes.has('HANDOFF_PHOTOS_UPLOADED');
    const handoffConfirmed = completedTypes.has('HANDOFF_CONFIRMED');
    const returnPhotosUploaded = completedTypes.has('RETURN_PHOTOS_UPLOADED');
    const returnConfirmed = completedTypes.has('RETURN_CONFIRMED');
    const isCompleted = rentalStatus === 'completed' || completedTypes.has('RENTAL_COMPLETED');
    const isCancelled = rentalStatus === 'cancelled' || completedTypes.has('RENTAL_CANCELLED');

    // Business logic for who can do what
    // Owner confirms handoff (they gave the item)
    // Renter confirms return (they gave the item back)
    const canConfirmHandoff = handoffPhotosUploaded && !handoffConfirmed && isOwner && !isCancelled;
    const canConfirmReturn = returnPhotosUploaded && !returnConfirmed && isRenter && !isCancelled;
    const canComplete = returnConfirmed && !isCompleted && !isCancelled && (isOwner || isRenter);
    const canOpenDispute = !hasOpenDispute && !isCompleted && !isCancelled && (isOwner || isRenter);

    // Handle action execution
    const handleAction = async (action: ActionType) => {
        setLoadingAction(action);

        try {
            let response;
            
            switch (action) {
                case 'confirmHandoff':
                    response = await rentalEventsService.confirmHandoff(rentalId);
                    if (response.ok) {
                        toast.success(response.message || 'Entrega confirmada');
                        onActionComplete();
                    } else {
                        toast.error(response.message || 'No se pudo confirmar la entrega');
                    }
                    break;
                case 'confirmReturn':
                    response = await rentalEventsService.confirmReturn(rentalId);
                    if (response.ok) {
                        toast.success(response.message || 'Devolución confirmada');
                        onActionComplete();
                    } else {
                        toast.error(response.message || 'No se pudo confirmar la devolución');
                    }
                    break;
                case 'complete':
                    response = await rentalEventsService.completeRental(rentalId);
                    if (response.ok) {
                        toast.success(response.message || '¡Alquiler completado con éxito!');
                        onActionComplete();
                    } else {
                        toast.error(response.message || 'No se pudo completar el alquiler');
                    }
                    break;
                default:
                    break;
            }
        } catch (err) {
            console.error('Action error:', err);
            toast.error('Error al ejecutar la acción');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleOpenDispute = async () => {
        if (!disputeReason.trim()) {
            toast.error('Describe el motivo de la disputa');
            return;
        }

        setLoadingAction('openDispute');
        try {
            const disputeId = await disputesService.open(rentalId, disputeReason.trim());
            if (disputeId) {
                toast.success('Disputa abierta correctamente');
                setShowDisputeForm(false);
                setDisputeReason('');
                onActionComplete();
            } else {
                toast.error('No se pudo abrir la disputa');
            }
        } catch (err) {
            console.error('Dispute error:', err);
            toast.error('Error al abrir la disputa');
        } finally {
            setLoadingAction(null);
        }
    };

    // Don't show anything if rental is finished or no actions available
    const hasAnyAction = canConfirmHandoff || canConfirmReturn || canComplete || canOpenDispute;
    if (isCompleted && !canOpenDispute) return null;
    if (isCancelled) return null;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Acciones disponibles</h3>

            <div className="space-y-4">
                {/* Confirm Handoff - Owner */}
                {canConfirmHandoff && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <div className="flex items-start gap-3">
                            <HandMetal className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div className="flex-1">
                                <p className="font-medium text-blue-800">Confirmar entrega</p>
                                <p className="text-sm text-blue-600 mb-3">
                                    Confirma que has entregado el artículo al arrendatario. 
                                    Las fotos ya fueron subidas.
                                </p>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleAction('confirmHandoff')}
                                    disabled={loadingAction !== null}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {loadingAction === 'confirmHandoff' ? (
                                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                    )}
                                    Confirmar entrega
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirm Return - Renter */}
                {canConfirmReturn && (
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                        <div className="flex items-start gap-3">
                            <RotateCcw className="w-5 h-5 text-purple-600 mt-0.5" />
                            <div className="flex-1">
                                <p className="font-medium text-purple-800">Confirmar devolución</p>
                                <p className="text-sm text-purple-600 mb-3">
                                    Confirma que has devuelto el artículo al propietario. 
                                    Las fotos ya fueron subidas.
                                </p>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleAction('confirmReturn')}
                                    disabled={loadingAction !== null}
                                    className="bg-purple-600 hover:bg-purple-700"
                                >
                                    {loadingAction === 'confirmReturn' ? (
                                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                    )}
                                    Confirmar devolución
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Complete Rental - Either party after return confirmed */}
                {canComplete && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                        <div className="flex items-start gap-3">
                            <PartyPopper className="w-5 h-5 text-green-600 mt-0.5" />
                            <div className="flex-1">
                                <p className="font-medium text-green-800">Completar alquiler</p>
                                <p className="text-sm text-green-600 mb-3">
                                    ¡Todo está listo! Confirma para finalizar el alquiler exitosamente.
                                </p>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleAction('complete')}
                                    disabled={loadingAction !== null}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    {loadingAction === 'complete' ? (
                                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <PartyPopper className="w-4 h-4 mr-2" />
                                    )}
                                    ¡Completar alquiler!
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Open Dispute */}
                {canOpenDispute && !showDisputeForm && (
                    <div className="pt-4 border-t border-slate-200">
                        <button
                            onClick={() => setShowDisputeForm(true)}
                            className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700"
                        >
                            <AlertTriangle className="w-4 h-4" />
                            ¿Hay algún problema? Abrir disputa
                        </button>
                    </div>
                )}

                {/* Dispute Form */}
                {showDisputeForm && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                            <div className="flex-1">
                                <p className="font-medium text-amber-800 mb-2">Abrir una disputa</p>
                                <p className="text-sm text-amber-600 mb-3">
                                    Describe el problema que tienes con este alquiler. 
                                    La otra parte será notificada y podrá responder.
                                </p>
                                <textarea
                                    value={disputeReason}
                                    onChange={(e) => setDisputeReason(e.target.value)}
                                    placeholder="Describe el problema (daños, no devolución, etc.)..."
                                    className="w-full p-3 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 mb-3"
                                    rows={3}
                                />
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowDisputeForm(false)}
                                        disabled={loadingAction !== null}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={handleOpenDispute}
                                        disabled={loadingAction !== null || !disputeReason.trim()}
                                        className="bg-amber-600 hover:bg-amber-700"
                                    >
                                        {loadingAction === 'openDispute' ? (
                                            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                        ) : (
                                            <AlertTriangle className="w-4 h-4 mr-2" />
                                        )}
                                        Abrir disputa
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* No actions available message */}
                {!hasAnyAction && !showDisputeForm && (
                    <p className="text-sm text-slate-500 text-center py-4">
                        {!handoffPhotosUploaded 
                            ? 'Sube las fotos de entrega para continuar' 
                            : !handoffConfirmed
                            ? 'Esperando confirmación de entrega del propietario'
                            : !returnPhotosUploaded
                            ? 'Sube las fotos de devolución para continuar'
                            : !returnConfirmed
                            ? 'Esperando confirmación de devolución del arrendatario'
                            : 'No hay acciones disponibles'}
                    </p>
                )}
            </div>
        </div>
    );
};

export default RentalActions;
