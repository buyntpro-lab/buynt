/**
 * RentalTimeline Component
 * 
 * Displays a visual timeline of rental events (progress tracker).
 * Shows completed, current, and upcoming steps in the rental flow.
 */

import React from 'react';
import type { RentalEvent, RentalEventType } from '../../services/types';
import { 
    CheckCircle, 
    Clock, 
    Camera, 
    HandMetal, 
    RotateCcw, 
    PartyPopper,
    AlertTriangle,
    Circle
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface RentalTimelineProps {
    events: RentalEvent[];
    isLoading?: boolean;
}

// Event configuration for display
const eventConfig: Record<RentalEventType, {
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
}> = {
    RENTAL_CREATED: {
        label: 'Reserva creada',
        description: 'Se ha confirmado la solicitud de alquiler',
        icon: <CheckCircle className="w-5 h-5" />,
        color: 'text-teal-600 bg-teal-100',
    },
    HANDOFF_PHOTOS_UPLOADED: {
        label: 'Fotos de entrega',
        description: 'Se subieron las fotos del estado inicial',
        icon: <Camera className="w-5 h-5" />,
        color: 'text-blue-600 bg-blue-100',
    },
    HANDOFF_CONFIRMED: {
        label: 'Entrega confirmada',
        description: 'El artículo fue entregado correctamente',
        icon: <HandMetal className="w-5 h-5" />,
        color: 'text-indigo-600 bg-indigo-100',
    },
    RETURN_PHOTOS_UPLOADED: {
        label: 'Fotos de devolución',
        description: 'Se subieron las fotos del estado al devolver',
        icon: <Camera className="w-5 h-5" />,
        color: 'text-purple-600 bg-purple-100',
    },
    RETURN_CONFIRMED: {
        label: 'Devolución confirmada',
        description: 'El artículo fue devuelto correctamente',
        icon: <RotateCcw className="w-5 h-5" />,
        color: 'text-pink-600 bg-pink-100',
    },
    RENTAL_COMPLETED: {
        label: 'Alquiler completado',
        description: '¡Todo terminó exitosamente!',
        icon: <PartyPopper className="w-5 h-5" />,
        color: 'text-green-600 bg-green-100',
    },
    RENTAL_CANCELLED: {
        label: 'Alquiler cancelado',
        description: 'El alquiler fue cancelado',
        icon: <AlertTriangle className="w-5 h-5" />,
        color: 'text-red-600 bg-red-100',
    },
    DISPUTE_OPENED: {
        label: 'Disputa abierta',
        description: 'Se ha abierto una disputa',
        icon: <AlertTriangle className="w-5 h-5" />,
        color: 'text-amber-600 bg-amber-100',
    },
    DISPUTE_RESOLVED: {
        label: 'Disputa resuelta',
        description: 'La disputa ha sido resuelta',
        icon: <CheckCircle className="w-5 h-5" />,
        color: 'text-green-600 bg-green-100',
    },
};

// The expected flow for a normal rental
const EXPECTED_FLOW: RentalEventType[] = [
    'RENTAL_CREATED',
    'HANDOFF_PHOTOS_UPLOADED',
    'HANDOFF_CONFIRMED',
    'RETURN_PHOTOS_UPLOADED',
    'RETURN_CONFIRMED',
    'RENTAL_COMPLETED',
];

export const RentalTimeline: React.FC<RentalTimelineProps> = ({ events, isLoading }) => {
    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-teal-600" />
                    <h3 className="font-semibold text-slate-900">Progreso del alquiler</h3>
                </div>
                <div className="animate-pulse space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex gap-3">
                            <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                                <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Create a map of completed events
    const completedEventTypes = new Set(events.map(e => e.event_type));
    
    // Check if rental has a terminal state
    const isCancelled = completedEventTypes.has('RENTAL_CANCELLED');
    const isCompleted = completedEventTypes.has('RENTAL_COMPLETED');
    const hasDispute = completedEventTypes.has('DISPUTE_OPENED');

    // Build the timeline steps - mix completed events with expected flow
    const timelineSteps: Array<{
        event?: RentalEvent;
        eventType: RentalEventType;
        status: 'completed' | 'current' | 'upcoming';
    }> = [];

    // Find the last completed step in the expected flow
    let lastCompletedIndex = -1;
    EXPECTED_FLOW.forEach((type, index) => {
        if (completedEventTypes.has(type)) {
            lastCompletedIndex = index;
        }
    });

    // Add steps based on expected flow
    EXPECTED_FLOW.forEach((type, index) => {
        const event = events.find(e => e.event_type === type);
        let status: 'completed' | 'current' | 'upcoming';
        
        if (completedEventTypes.has(type)) {
            status = 'completed';
        } else if (index === lastCompletedIndex + 1 && !isCompleted && !isCancelled) {
            status = 'current';
        } else {
            status = 'upcoming';
        }

        timelineSteps.push({ event, eventType: type, status });
    });

    // Add any special events (disputes, cancellation) that occurred
    const specialEvents = events.filter(e => 
        e.event_type === 'DISPUTE_OPENED' || 
        e.event_type === 'DISPUTE_RESOLVED' ||
        e.event_type === 'RENTAL_CANCELLED'
    );

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6">
            <div className="flex items-center gap-2 mb-6">
                <Clock className="w-5 h-5 text-teal-600" />
                <h3 className="font-semibold text-slate-900">Progreso del alquiler</h3>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">Progreso</span>
                    <span className="text-xs font-medium text-teal-600">
                        {Math.min((lastCompletedIndex + 1), EXPECTED_FLOW.length)} / {EXPECTED_FLOW.length} pasos
                    </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-500 ${
                            isCancelled ? 'bg-red-500' :
                            isCompleted ? 'bg-green-500' :
                            hasDispute ? 'bg-amber-500' :
                            'bg-teal-500'
                        }`}
                        style={{ 
                            width: `${Math.min(((lastCompletedIndex + 1) / EXPECTED_FLOW.length) * 100, 100)}%` 
                        }}
                    />
                </div>
            </div>

            {/* Timeline Steps */}
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200"></div>

                <div className="space-y-4">
                    {timelineSteps.map((step, index) => {
                        const config = eventConfig[step.eventType];
                        const isLast = index === timelineSteps.length - 1;
                        
                        return (
                            <div key={step.eventType} className="relative flex gap-4">
                                {/* Icon */}
                                <div className={`
                                    relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                                    ${step.status === 'completed' ? config.color :
                                      step.status === 'current' ? 'bg-teal-500 text-white animate-pulse' :
                                      'bg-slate-100 text-slate-400'}
                                `}>
                                    {step.status === 'completed' ? config.icon :
                                     step.status === 'current' ? <Clock className="w-4 h-4" /> :
                                     <Circle className="w-3 h-3" />}
                                </div>

                                {/* Content */}
                                <div className={`flex-1 pb-4 ${isLast ? 'pb-0' : ''}`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`font-medium ${
                                            step.status === 'completed' ? 'text-slate-900' :
                                            step.status === 'current' ? 'text-teal-700' :
                                            'text-slate-400'
                                        }`}>
                                            {config.label}
                                        </span>
                                        {step.status === 'current' && (
                                            <span className="px-2 py-0.5 text-xs bg-teal-100 text-teal-700 rounded-full">
                                                Siguiente paso
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-sm ${
                                        step.status === 'upcoming' ? 'text-slate-300' : 'text-slate-500'
                                    }`}>
                                        {config.description}
                                    </p>
                                    {step.event && (
                                        <p className="text-xs text-slate-400 mt-1">
                                            {formatDistanceToNow(parseISO(step.event.created_at), { 
                                                addSuffix: true, 
                                                locale: es 
                                            })}
                                            {step.event.actor_email && (
                                                <span className="ml-1">
                                                    por {step.event.actor_email.split('@')[0]}
                                                </span>
                                            )}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Special events (disputes, cancellation) */}
                    {specialEvents.map((event) => {
                        const config = eventConfig[event.event_type];
                        return (
                            <div key={event.id} className="relative flex gap-4">
                                <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.color}`}>
                                    {config.icon}
                                </div>
                                <div className="flex-1">
                                    <span className="font-medium text-slate-900">{config.label}</span>
                                    <p className="text-sm text-slate-500">{config.description}</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {formatDistanceToNow(parseISO(event.created_at), { 
                                            addSuffix: true, 
                                            locale: es 
                                        })}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default RentalTimeline;
