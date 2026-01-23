/**
 * RentalProgressWizard Page
 * 
 * Step-by-step guided wizard for rental progress.
 * Shows detailed current step with actions and timeline.
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRentalProgress } from '../hooks/useRentalProgress';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { DualEvidenceUploader } from '../components/booking/DualEvidenceUploader';
import { DisputePanel } from '../components/rental/DisputePanel';
import { rentalEventsService } from '../services/rentalEventsService';
import { 
    getStepAction, 
    isStepActionEnabled,
    type ProgressStep,
    MIN_PHOTOS_PER_PARTY,
} from '../lib/rentalProgress';
import toast from 'react-hot-toast';
import {
    ArrowLeft,
    CheckCircle,
    Circle,
    Clock,
    Camera,
    HandMetal,
    RotateCcw,
    PartyPopper,
    AlertTriangle,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Info,
} from 'lucide-react';
import { parseISO, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// ============================================================================
// STEP ICONS
// ============================================================================

const STEP_ICONS: Record<string, React.ReactNode> = {
    RESERVATION_CREATED: <CheckCircle className="w-5 h-5" />,
    HANDOFF_PHOTOS: <Camera className="w-5 h-5" />,
    HANDOFF_CONFIRMED: <HandMetal className="w-5 h-5" />,
    RETURN_PHOTOS: <Camera className="w-5 h-5" />,
    RETURN_CONFIRMED: <RotateCcw className="w-5 h-5" />,
    RENTAL_COMPLETED: <PartyPopper className="w-5 h-5" />,
};

// ============================================================================
// COMPONENT
// ============================================================================

export const RentalProgressWizard: React.FC = () => {
    const { id: rentalId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const {
        isLoading,
        error,
        rental,
        viewerRole,
        progressData,
        progress,
        events,
        groupedMedia,
        partyCounts,
        handoffPhotoCount,
        returnPhotoCount,
        hasOpenDispute,
        refresh,
    } = useRentalProgress(rentalId);
    
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [showDispute, setShowDispute] = useState(false);
    
    // Handle action execution
    const handleAction = async (stepKey: string) => {
        if (!rentalId || !progressData) return;
        
        setActionLoading(stepKey);
        
        try {
            let response;
            
            switch (stepKey) {
                case 'HANDOFF_CONFIRMED':
                    response = await rentalEventsService.confirmHandoff(rentalId);
                    if (response.ok) {
                        toast.success(response.message || '¡Entrega confirmada!');
                    } else {
                        toast.error(response.message || 'No se pudo confirmar la entrega');
                    }
                    break;
                    
                case 'RETURN_CONFIRMED':
                    response = await rentalEventsService.confirmReturn(rentalId);
                    if (response.ok) {
                        toast.success(response.message || '¡Devolución confirmada!');
                    } else {
                        toast.error(response.message || 'No se pudo confirmar la devolución');
                    }
                    break;
                    
                case 'RENTAL_COMPLETED':
                    response = await rentalEventsService.completeRental(rentalId);
                    if (response.ok) {
                        toast.success(response.message || '🎉 ¡Alquiler completado con éxito!');
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
            setActionLoading(null);
            // Always refresh data after action attempt
            await refresh();
        }
    };
    
    // Handle photo upload complete
    const handlePhotoUploadComplete = async () => {
        await refresh();
    };
    
    // Loading state
    if (isLoading) {
        return (
            <div className="max-w-3xl mx-auto py-16 px-4 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
            </div>
        );
    }
    
    // Error state
    if (error || !rental || !progress || !progressData) {
        return (
            <div className="max-w-3xl mx-auto py-12 px-4">
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">
                        {error || 'No se pudo cargar el alquiler'}
                    </h2>
                    <p className="text-slate-500 mb-6">
                        Verifica que el enlace sea correcto o intenta de nuevo.
                    </p>
                    <Button onClick={() => navigate(-1)}>Volver</Button>
                </div>
            </div>
        );
    }
    
    // Access control
    if (viewerRole === 'none') {
        return (
            <div className="max-w-3xl mx-auto py-12 px-4">
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">
                        Acceso denegado
                    </h2>
                    <p className="text-slate-500 mb-6">
                        No tienes permiso para ver este alquiler.
                    </p>
                    <Button onClick={() => navigate('/')}>Ir al inicio</Button>
                </div>
            </div>
        );
    }
    
    const { steps, completedCount, currentStepIndex, progressPercent, isFullyComplete, isCancelled } = progress;
    
    // Render step panel
    const renderStepPanel = (step: ProgressStep) => {
        const isCurrentStep = currentStepIndex === step.index && !isFullyComplete;
        const action = getStepAction(step, viewerRole, isStepActionEnabled(step.key, progressData));
        const icon = STEP_ICONS[step.key] || <Circle className="w-5 h-5" />;
        
        // Photo upload steps have special UI
        const isPhotoStep = step.key === 'HANDOFF_PHOTOS' || step.key === 'RETURN_PHOTOS';
        const photoType: 'handoff' | 'return' = step.key === 'HANDOFF_PHOTOS' ? 'handoff' : 'return';
        
        // Get party photos for dual uploader
        const yourPhotos = photoType === 'handoff' 
            ? (groupedMedia?.[photoType]?.[viewerRole] || [])
            : (groupedMedia?.[photoType]?.[viewerRole] || []);
        const otherRole = viewerRole === 'owner' ? 'renter' : 'owner';
        const otherPhotos = photoType === 'handoff'
            ? (groupedMedia?.[photoType]?.[otherRole] || [])
            : (groupedMedia?.[photoType]?.[otherRole] || []);
        
        // Labels for dual uploader
        const yourLabel = viewerRole === 'owner' ? 'Arrendador' : 'Arrendatario';
        const otherLabel = viewerRole === 'owner' ? 'Arrendatario' : 'Arrendador';
        
        return (
            <div 
                key={step.key}
                className={`rounded-2xl border transition-all ${
                    step.isComplete 
                        ? 'bg-green-50 border-green-200'
                        : isCurrentStep
                            ? 'bg-white border-teal-300 shadow-md ring-2 ring-teal-100'
                            : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
            >
                {/* Step Header */}
                <div className="p-4 flex items-center gap-4">
                    <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                        ${step.isComplete 
                            ? 'bg-green-100 text-green-600' 
                            : isCurrentStep
                                ? 'bg-teal-500 text-white'
                                : 'bg-slate-200 text-slate-400'
                        }
                    `}>
                        {step.isComplete ? <CheckCircle className="w-5 h-5" /> : icon}
                    </div>
                    
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <span className={`font-semibold ${
                                step.isComplete ? 'text-green-800' :
                                isCurrentStep ? 'text-slate-900' :
                                'text-slate-500'
                            }`}>
                                {step.index + 1}. {step.title}
                            </span>
                            {isCurrentStep && !step.isComplete && (
                                <span className="px-2 py-0.5 text-xs bg-teal-100 text-teal-700 rounded-full animate-pulse">
                                    Paso actual
                                </span>
                            )}
                            {step.isComplete && (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                        </div>
                        <p className={`text-sm ${
                            step.isComplete ? 'text-green-600' :
                            isCurrentStep ? 'text-slate-600' :
                            'text-slate-400'
                        }`}>
                            {step.isComplete ? step.completedDescription : step.description}
                        </p>
                        {step.completedAt && (
                            <p className="text-xs text-slate-400 mt-1">
                                {formatDistanceToNow(parseISO(step.completedAt), { addSuffix: true, locale: es })}
                            </p>
                        )}
                    </div>
                </div>
                
                {/* Photo Step Content - Show when current OR completed */}
                {isPhotoStep && rentalId && groupedMedia && (isCurrentStep || step.isComplete) && (
                    <div className="px-4 pb-4 border-t border-slate-100 mt-2 pt-4">
                        <DualEvidenceUploader
                            rentalId={rentalId}
                            type={photoType}
                            viewerRole={viewerRole}
                            yourPhotos={yourPhotos}
                            otherPartyPhotos={otherPhotos}
                            yourLabel={yourLabel}
                            otherLabel={otherLabel}
                            canUpload={true}
                            onUploadComplete={handlePhotoUploadComplete}
                        />
                    </div>
                )}
                
                {/* Current Step Actions (non-photo steps) */}
                {isCurrentStep && !step.isComplete && !isPhotoStep && (
                    <div className="px-4 pb-4 border-t border-slate-100 mt-2 pt-4">
                        <div className="space-y-3">
                            {/* Instructions */}
                            <div className="p-3 bg-blue-50 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                                    <div className="text-sm text-blue-800">
                                        {step.key === 'HANDOFF_CONFIRMED' && (
                                            <>Verifica que las fotos de entrega documenten correctamente el estado del artículo antes de confirmar.</>
                                        )}
                                        {step.key === 'RETURN_CONFIRMED' && (
                                            <>Verifica que las fotos de devolución muestren el estado del artículo al ser devuelto.</>
                                        )}
                                        {step.key === 'RENTAL_COMPLETED' && (
                                            <>Una vez completado, el alquiler se marcará como finalizado y no se podrán realizar más acciones.</>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Action or Waiting */}
                            {action.canPerform ? (
                                <Button
                                    variant="primary"
                                    onClick={() => handleAction(step.key)}
                                    disabled={actionLoading !== null}
                                    className="w-full"
                                >
                                    {actionLoading === step.key ? (
                                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        icon
                                    )}
                                    <span className="ml-2">{action.label}</span>
                                </Button>
                            ) : (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                                    <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                                    <p className="text-sm text-amber-700">{action.label}</p>
                                    <p className="text-xs text-amber-600 mt-1">
                                        {viewerRole === 'renter' ? 'El propietario' : 'El arrendatario'} debe realizar esta acción
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };
    
    return (
        <div className="max-w-3xl mx-auto py-6 px-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center text-slate-600 hover:text-slate-900 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Volver
                </button>
                
                <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                    isCancelled ? 'bg-red-100 text-red-700' :
                    isFullyComplete ? 'bg-green-100 text-green-700' :
                    'bg-teal-100 text-teal-700'
                }`}>
                    {isCancelled ? 'Cancelado' : isFullyComplete ? 'Completado' : 'En progreso'}
                </span>
            </div>
            
            {/* Title & Item Info */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
                <h1 className="text-xl font-bold text-slate-900 mb-2">Progreso del alquiler</h1>
                {rental.item_title && (
                    <p className="text-slate-600">{rental.item_title}</p>
                )}
                <p className="text-sm text-slate-500 mt-1">
                    Eres el <strong>{viewerRole === 'owner' ? 'propietario' : 'arrendatario'}</strong>
                </p>
            </div>
            
            {/* Progress Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-700">
                        Paso {Math.min(completedCount + 1, steps.length)} de {steps.length}
                    </span>
                    <span className={`text-sm font-bold ${
                        isFullyComplete ? 'text-green-600' : 'text-teal-600'
                    }`}>
                        {completedCount} / {steps.length} completados
                    </span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-700 ${
                            isCancelled ? 'bg-red-500' :
                            isFullyComplete ? 'bg-green-500' :
                            'bg-teal-500'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>
            
            {/* Steps List */}
            <div className="space-y-4 mb-6">
                {steps.map(step => renderStepPanel(step))}
            </div>
            
            {/* Dispute Section */}
            <div className="mb-6">
                <button
                    onClick={() => setShowDispute(!showDispute)}
                    className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 mb-3"
                >
                    <AlertTriangle className="w-4 h-4" />
                    {hasOpenDispute ? 'Ver disputa abierta' : '¿Hay algún problema?'}
                    {showDispute ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {showDispute && rentalId && user?.id && (
                    <DisputePanel
                        rentalId={rentalId}
                        currentUserId={user.id}
                        onDisputeUpdate={refresh}
                    />
                )}
            </div>
            
            {/* History Section */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full p-4 flex items-center justify-between text-left"
                >
                    <span className="font-medium text-slate-700">
                        Historial de eventos ({events.length})
                    </span>
                    {showHistory ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                </button>
                
                {showHistory && (
                    <div className="px-4 pb-4 border-t border-slate-200">
                        {events.length === 0 ? (
                            <p className="text-sm text-slate-500 py-4 text-center">
                                No hay eventos registrados aún
                            </p>
                        ) : (
                            <div className="space-y-2 mt-3">
                                {events.map((event, idx) => (
                                    <div key={event.id || idx} className="flex items-start gap-3 text-sm">
                                        <div className="w-2 h-2 mt-2 rounded-full bg-teal-400"></div>
                                        <div>
                                            <span className="font-medium text-slate-700">
                                                {event.event_type.replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-slate-400 ml-2">
                                                {formatDistanceToNow(parseISO(event.created_at), { addSuffix: true, locale: es })}
                                            </span>
                                            {event.actor_email && (
                                                <span className="text-slate-400 ml-1">
                                                    por {event.actor_email.split('@')[0]}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RentalProgressWizard;
