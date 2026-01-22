/**
 * RentalProgressSummary Component
 * 
 * Compact progress card for the rental detail page.
 * Shows progress bar, current step, dual party indicators, and CTA to wizard.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../common/Button';
import type { ComputedProgress, ViewerRole, PartyCounts } from '../../lib/rentalProgress';
import { MIN_PHOTOS_PER_PARTY } from '../../lib/rentalProgress';
import { 
    Clock, 
    CheckCircle, 
    ChevronRight,
    AlertTriangle,
    PartyPopper,
    Camera,
    User
} from 'lucide-react';

interface RentalProgressSummaryProps {
    rentalId: string;
    progress: ComputedProgress;
    viewerRole: ViewerRole;
    partyCounts?: PartyCounts;
    isLoading?: boolean;
}

export const RentalProgressSummary: React.FC<RentalProgressSummaryProps> = ({
    rentalId,
    progress,
    viewerRole,
    partyCounts,
    isLoading,
}) => {
    const navigate = useNavigate();
    
    const handleContinue = () => {
        navigate(`/rentals/${rentalId}/progress`);
    };
    
    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6">
                <div className="animate-pulse">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-5 h-5 bg-slate-200 rounded-full"></div>
                        <div className="h-5 bg-slate-200 rounded w-40"></div>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full mb-4"></div>
                    <div className="h-4 bg-slate-200 rounded w-32 mb-3"></div>
                    <div className="h-10 bg-slate-200 rounded"></div>
                </div>
            </div>
        );
    }
    
    const { 
        completedCount, 
        currentStep, 
        progressPercent, 
        isFullyComplete,
        isCancelled,
        steps
    } = progress;
    
    // Determine status color and icon
    const getStatusConfig = () => {
        if (isCancelled) {
            return {
                color: 'red',
                icon: <AlertTriangle className="w-5 h-5" />,
                label: 'Cancelado',
                bgClass: 'bg-red-50 border-red-200',
                textClass: 'text-red-600',
                barClass: 'bg-red-500',
            };
        }
        if (isFullyComplete) {
            return {
                color: 'green',
                icon: <PartyPopper className="w-5 h-5" />,
                label: '¡Completado!',
                bgClass: 'bg-green-50 border-green-200',
                textClass: 'text-green-600',
                barClass: 'bg-green-500',
            };
        }
        return {
            color: 'teal',
            icon: <Clock className="w-5 h-5" />,
            label: 'En progreso',
            bgClass: 'bg-white border-slate-200',
            textClass: 'text-teal-600',
            barClass: 'bg-teal-500',
        };
    };
    
    const status = getStatusConfig();
    
    // Get current step info
    const currentStepTitle = currentStep?.title || 'Completado';
    const currentStepDesc = currentStep?.description || '¡Todo terminó exitosamente!';
    
    // Determine if viewer should take action
    const viewerShouldAct = currentStep && (
        currentStep.actorRole === 'either' ||
        currentStep.actorRole === viewerRole
    );
    
    return (
        <div className={`rounded-2xl border p-4 md:p-6 ${status.bgClass}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className={status.textClass}>
                        {status.icon}
                    </div>
                    <h3 className="font-semibold text-slate-900">Progreso del alquiler</h3>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    isCancelled ? 'bg-red-100 text-red-700' :
                    isFullyComplete ? 'bg-green-100 text-green-700' :
                    'bg-teal-100 text-teal-700'
                }`}>
                    {status.label}
                </span>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">Progreso</span>
                    <span className={`text-xs font-medium ${status.textClass}`}>
                        {completedCount} / {steps.length} pasos
                    </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-500 ${status.barClass}`}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>
            
            {/* Dual Party Evidence Indicators */}
            {partyCounts && !isFullyComplete && !isCancelled && (
                <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                        <Camera className="w-4 h-4 text-slate-600" />
                        <span className="text-xs font-medium text-slate-700">Evidencias fotográficas</span>
                    </div>
                    <div className="space-y-1.5 ml-6">
                        {/* Handoff Status */}
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">Entrega:</span>
                            <div className="flex items-center gap-2">
                                <span className={`flex items-center gap-1 ${
                                    viewerRole === 'owner' 
                                        ? partyCounts.ownerHandoff >= MIN_PHOTOS_PER_PARTY ? 'text-green-600' : 'text-amber-600'
                                        : partyCounts.renterHandoff >= MIN_PHOTOS_PER_PARTY ? 'text-green-600' : 'text-amber-600'
                                }`}>
                                    <User className="w-3 h-3" />
                                    tú {viewerRole === 'owner' ? partyCounts.ownerHandoff : partyCounts.renterHandoff}/{MIN_PHOTOS_PER_PARTY}
                                    {(viewerRole === 'owner' ? partyCounts.ownerHandoff : partyCounts.renterHandoff) >= MIN_PHOTOS_PER_PARTY && (
                                        <CheckCircle className="w-3 h-3" />
                                    )}
                                </span>
                                <span className="text-slate-400">·</span>
                                <span className={`flex items-center gap-1 ${
                                    viewerRole === 'owner' 
                                        ? partyCounts.renterHandoff >= MIN_PHOTOS_PER_PARTY ? 'text-green-600' : 'text-slate-400'
                                        : partyCounts.ownerHandoff >= MIN_PHOTOS_PER_PARTY ? 'text-green-600' : 'text-slate-400'
                                }`}>
                                    otra parte {viewerRole === 'owner' ? partyCounts.renterHandoff : partyCounts.ownerHandoff}/{MIN_PHOTOS_PER_PARTY}
                                    {(viewerRole === 'owner' ? partyCounts.renterHandoff : partyCounts.ownerHandoff) >= MIN_PHOTOS_PER_PARTY && (
                                        <CheckCircle className="w-3 h-3" />
                                    )}
                                </span>
                            </div>
                        </div>
                        
                        {/* Return Status */}
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">Devolución:</span>
                            <div className="flex items-center gap-2">
                                <span className={`flex items-center gap-1 ${
                                    viewerRole === 'owner' 
                                        ? partyCounts.ownerReturn >= MIN_PHOTOS_PER_PARTY ? 'text-green-600' : 'text-slate-400'
                                        : partyCounts.renterReturn >= MIN_PHOTOS_PER_PARTY ? 'text-green-600' : 'text-slate-400'
                                }`}>
                                    <User className="w-3 h-3" />
                                    tú {viewerRole === 'owner' ? partyCounts.ownerReturn : partyCounts.renterReturn}/{MIN_PHOTOS_PER_PARTY}
                                    {(viewerRole === 'owner' ? partyCounts.ownerReturn : partyCounts.renterReturn) >= MIN_PHOTOS_PER_PARTY && (
                                        <CheckCircle className="w-3 h-3" />
                                    )}
                                </span>
                                <span className="text-slate-400">·</span>
                                <span className={`flex items-center gap-1 ${
                                    viewerRole === 'owner' 
                                        ? partyCounts.renterReturn >= MIN_PHOTOS_PER_PARTY ? 'text-green-600' : 'text-slate-400'
                                        : partyCounts.ownerReturn >= MIN_PHOTOS_PER_PARTY ? 'text-green-600' : 'text-slate-400'
                                }`}>
                                    otra parte {viewerRole === 'owner' ? partyCounts.renterReturn : partyCounts.ownerReturn}/{MIN_PHOTOS_PER_PARTY}
                                    {(viewerRole === 'owner' ? partyCounts.renterReturn : partyCounts.ownerReturn) >= MIN_PHOTOS_PER_PARTY && (
                                        <CheckCircle className="w-3 h-3" />
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Current Step Info */}
            {!isFullyComplete && !isCancelled && currentStep && (
                <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div>
                        <span className="text-sm font-medium text-slate-900">
                            Paso actual: {currentStepTitle}
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 ml-4">
                        {viewerShouldAct 
                            ? currentStep.actionLabel || currentStepDesc
                            : currentStep.waitingLabel || 'Esperando a la otra parte'
                        }
                    </p>
                </div>
            )}
            
            {/* Completed Steps Mini Summary */}
            {completedCount > 0 && completedCount < steps.length && (
                <div className="mb-4 flex flex-wrap gap-1">
                    {steps.slice(0, completedCount).map((step) => (
                        <span 
                            key={step.key}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded"
                        >
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            {step.title}
                        </span>
                    ))}
                </div>
            )}
            
            {/* CTA Button */}
            {!isCancelled && (
                <Button
                    variant={viewerShouldAct ? 'primary' : 'outline'}
                    onClick={handleContinue}
                    className="w-full"
                >
                    {isFullyComplete ? (
                        <>Ver detalles completos</>
                    ) : viewerShouldAct ? (
                        <>
                            Continuar progreso
                            <ChevronRight className="w-4 h-4 ml-1" />
                        </>
                    ) : (
                        <>Ver estado del alquiler</>
                    )}
                </Button>
            )}
        </div>
    );
};

export default RentalProgressSummary;
