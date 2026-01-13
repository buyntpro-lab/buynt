import React, { useState, useEffect, useMemo } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { differenceInDays, startOfToday, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';
import { Button } from '../common/Button';
import { rentalRequestsService, rentalsService } from '../../services/rentalRequestsService';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import type { Item, BlockedDateRange } from '../../services/types';
import toast from 'react-hot-toast';
import { Calendar, CheckCircle, AlertCircle } from 'lucide-react';

interface BookingWidgetProps {
    item: Item;
}

export const BookingWidget: React.FC<BookingWidgetProps> = ({ item }) => {
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [range, setRange] = useState<DateRange | undefined>();
    const [blockedRanges, setBlockedRanges] = useState<BlockedDateRange[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingDates, setIsFetchingDates] = useState(true);
    const [requestSent, setRequestSent] = useState(false);
    const [note, setNote] = useState('');

    // Check if current user is the owner
    const isOwner = isAuthenticated && user?.id === item.owner_id;

    // Fetch blocked dates from active rentals
    useEffect(() => {
        const fetchBlockedDates = async () => {
            setIsFetchingDates(true);
            try {
                const ranges = await rentalsService.getBlockedDates(item.id);
                setBlockedRanges(ranges);
            } catch (error) {
                console.error('Error fetching blocked dates:', error);
            } finally {
                setIsFetchingDates(false);
            }
        };
        fetchBlockedDates();
    }, [item.id]);

    // Convert blocked ranges to individual dates for the calendar
    const disabledDays = useMemo(() => {
        const dates: Date[] = [];
        blockedRanges.forEach((rangeItem) => {
            const start = new Date(rangeItem.start_date);
            const end = new Date(rangeItem.end_date);
            const daysInRange = eachDayOfInterval({ start, end });
            dates.push(...daysInRange);
        });
        return dates;
    }, [blockedRanges]);

    // Check if selected range overlaps with any blocked range
    const hasOverlap = useMemo(() => {
        if (!range?.from || !range?.to) return false;
        
        return blockedRanges.some((blocked) => {
            const blockedStart = new Date(blocked.start_date);
            const blockedEnd = new Date(blocked.end_date);
            
            // Check if ranges overlap
            return !(range.to! < blockedStart || range.from! > blockedEnd);
        });
    }, [range, blockedRanges]);

    const handleBook = async () => {
        if (!range?.from || !range?.to) return;

        // Check if user is authenticated
        if (!isAuthenticated) {
            toast.error('Debes iniciar sesión para solicitar un alquiler');
            navigate('/login');
            return;
        }

        // Can't book your own item
        if (isOwner) {
            toast.error('No puedes alquilar tu propio artículo');
            return;
        }

        // Check for date overlap
        if (hasOverlap) {
            toast.error('Las fechas seleccionadas ya están reservadas');
            return;
        }

        setIsLoading(true);

        const result = await rentalRequestsService.create(
            item.id,
            range.from,
            range.to,
            note || undefined
        );

        setIsLoading(false);

        if ('error' in result) {
            // Show user-friendly error message
            switch (result.error.code) {
                case 'dates_not_available':
                    toast.error('Esas fechas ya están reservadas. Por favor, elige otras.');
                    // Refresh blocked dates
                    const newRanges = await rentalsService.getBlockedDates(item.id);
                    setBlockedRanges(newRanges);
                    break;
                case 'cannot_rent_own_item':
                    toast.error('No puedes alquilar tu propio artículo');
                    break;
                case 'invalid_date_range':
                    toast.error('El rango de fechas no es válido');
                    break;
                case 'not_authenticated':
                    toast.error('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.');
                    navigate('/login');
                    break;
                default:
                    toast.error(result.error.message);
            }
            return;
        }

        // Success!
        toast.success('¡Solicitud enviada correctamente!');
        setRequestSent(true);
    };

    const daysSelected = range?.from && range?.to ? differenceInDays(range.to, range.from) + 1 : 0;
    const subtotal = daysSelected * item.price_day;
    const deposit = 50; // Fixed deposit for MVP
    const totalPrice = subtotal + deposit;

    // Success state
    if (requestSent) {
        return (
            <div className="bg-white p-6 rounded-3xl shadow-lg border border-teal-100 text-center animate-in fade-in">
                <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-teal-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">¡Solicitud enviada!</h3>
                <p className="text-gray-500 mb-2">El propietario debe aceptar tu reserva.</p>
                <p className="text-sm text-gray-400 mb-6">Te notificaremos cuando responda.</p>
                <div className="flex flex-col gap-2">
                    <Button 
                        variant="primary" 
                        onClick={() => navigate('/solicitudes?tab=enviadas')}
                        className="w-full"
                    >
                        Ver mis solicitudes
                    </Button>
                    <Button 
                        variant="outline" 
                        onClick={() => setRequestSent(false)}
                        className="w-full"
                    >
                        Hacer otra solicitud
                    </Button>
                </div>
            </div>
        );
    }

    // Owner view - can't book their own item
    if (isOwner) {
        return (
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Este es tu artículo</h3>
                <p className="text-slate-500 text-sm mb-4">
                    No puedes alquilar tu propio artículo, pero puedes ver las solicitudes recibidas.
                </p>
                <Button 
                    variant="outline" 
                    onClick={() => navigate('/solicitudes?tab=recibidas')}
                    className="w-full"
                >
                    Ver solicitudes recibidas
                </Button>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 sticky top-24">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Selecciona fechas</h3>

            {isFetchingDates ? (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                </div>
            ) : (
                <>
                    <style>{`
                        .rdp { 
                            --rdp-accent-color: var(--color-primary); 
                            --rdp-range_start-background: none !important;
                            --rdp-range_end-background: none !important;
                            --rdp-range_middle-background-color: transparent !important;
                            margin: 0; 
                        }
                        
                        .rdp-month_grid { border-collapse: collapse !important; }
                        .rdp-day { padding: 0 !important; }

                        .rdp-day_button {
                            background-color: transparent !important;
                            border-radius: 0 !important;
                            width: 100% !important;
                            height: 100% !important;
                            display: flex !important;
                            align-items: center !important;
                            justify-content: center !important;
                            color: inherit !important;
                        }

                        .rdp-day[aria-selected="true"] {
                            background-color: var(--color-primary) !important;
                            color: white !important;
                            background-image: none !important;
                        }

                        .rdp-day.rdp-range_start, 
                        .rdp-day.rdp-day_range_start {
                            border-top-left-radius: 999px !important;
                            border-bottom-left-radius: 999px !important;
                        }

                        .rdp-day.rdp-range_end,
                        .rdp-day.rdp-day_range_end {
                            border-top-right-radius: 999px !important;
                            border-bottom-right-radius: 999px !important;
                        }

                        .rdp-day.rdp-range_middle,
                        .rdp-day.rdp-day_range_middle {
                            border-radius: 0 !important;
                        }

                        .rdp-day[aria-selected="true"]:not(.rdp-range_middle):not(.rdp-range_start):not(.rdp-range_end):not(.rdp-day_range_middle):not(.rdp-day_range_start):not(.rdp-day_range_end),
                        .rdp-day.rdp-range_start.rdp-range_end {
                            border-radius: 999px !important;
                        }
                        
                        .rdp-day[aria-disabled="true"] {
                            background-color: #fee2e2 !important;
                            color: #991b1b !important;
                            text-decoration: line-through;
                        }
                    `}</style>

                    <div className="border border-gray-100 rounded-2xl p-2 mb-4 flex justify-center">
                        <DayPicker
                            mode="range"
                            selected={range}
                            onSelect={setRange}
                            disabled={[{ before: startOfToday() }, ...disabledDays]}
                            locale={es}
                            modifiersStyles={{
                                selected: { backgroundColor: 'var(--color-primary)' }
                            }}
                        />
                    </div>

                    {blockedRanges.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-red-600 mb-4 bg-red-50 p-2 rounded-lg">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>Los días en rojo ya están reservados</span>
                        </div>
                    )}
                </>
            )}

            {range?.from && range?.to ? (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                    {/* Overlap warning */}
                    {hasOverlap && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">El rango seleccionado incluye fechas ya reservadas</span>
                        </div>
                    )}

                    {/* Note input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Mensaje para el propietario (opcional)
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Cuéntale para qué lo necesitas..."
                            className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            rows={2}
                        />
                    </div>

                    {/* Price breakdown */}
                    <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                        <div className="flex justify-between text-gray-600">
                            <span>{daysSelected} días × {item.price_day}€</span>
                            <span>{subtotal}€</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Fianza reembolsable</span>
                            <span>{deposit}€</span>
                        </div>
                        <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-lg text-gray-900">
                            <span>Total</span>
                            <span>{totalPrice}€</span>
                        </div>
                    </div>

                    <Button
                        className="w-full py-4 text-lg font-bold shadow-xl shadow-teal-100"
                        onClick={handleBook}
                        disabled={isLoading || hasOverlap || !isAuthenticated}
                    >
                        {isLoading ? 'Enviando...' : 'Solicitar Alquiler'}
                    </Button>
                    
                    {!isAuthenticated && (
                        <p className="text-xs text-center text-amber-600 bg-amber-50 p-2 rounded-lg">
                            Debes <button onClick={() => navigate('/login')} className="underline font-medium">iniciar sesión</button> para solicitar un alquiler.
                        </p>
                    )}
                    
                    <p className="text-xs text-center text-gray-400">
                        No se te cobrará nada hasta que el propietario acepte.
                    </p>
                </div>
            ) : (
                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Selecciona fecha de inicio y fin para ver el precio.
                </div>
            )}
        </div>
    );
};
