import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { itemsService, bookingsService } from '../services/supabaseDb';
import { Button } from '../components/common/Button';
import { Package, Calendar, LogOut, CheckCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { Item } from '../services/types';

export const Profile: React.FC = () => {
    const { user, signOut, isAuthenticated, loading: authLoading } = useAuth();
    const [items, setItems] = useState<Item[]>([]);
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            navigate('/login');
            return;
        }

        if (user) {
            loadData();
        }
    }, [user, authLoading, isAuthenticated]);

    const loadData = async () => {
        setLoading(true);
        if (user) {
            const [myItems, myBookings] = await Promise.all([
                itemsService.getByUserId(user.id),
                bookingsService.getByUserId(user.id)
            ]);
            setItems(myItems);
            setBookings(myBookings);
        }
        setLoading(false);
    };

    const handleSignOut = async () => {
        await signOut();
        navigate('/');
    };

    if (authLoading || loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            {/* Header / Info */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 mb-8 flex flex-col md:flex-row items-center gap-8">
                <div className="relative group">
                    <img
                        src={user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.full_name}&background=6366f1&color=fff`}
                        alt="Profile"
                        className="w-24 h-24 rounded-2xl object-cover ring-4 ring-primary/10"
                    />
                    {user?.dni_verified && (
                        <div className="absolute -bottom-2 -right-2 bg-green-500 text-white p-1 rounded-full border-2 border-white shadow-sm" title="DNI Verificado">
                            <CheckCircle className="w-4 h-4" />
                        </div>
                    )}
                </div>

                <div className="flex-1 text-center md:text-left">
                    <h1 className="text-3xl font-bold text-slate-900 mb-1">{user?.full_name}</h1>
                    <p className="text-slate-500 mb-4">{user?.email}</p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-3">
                        <div className="bg-slate-50 px-3 py-1.5 rounded-xl text-sm font-medium text-slate-600 flex items-center gap-2">
                            <Package className="w-4 h-4 text-primary" />
                            {items.length} Productos
                        </div>
                        <div className="bg-slate-50 px-3 py-1.5 rounded-xl text-sm font-medium text-slate-600 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            {bookings.length} Alquileres
                        </div>
                    </div>
                </div>

                <Button variant="outline" onClick={handleSignOut} className="rounded-2xl border-slate-200 text-slate-600 hover:bg-slate-50 gap-2">
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Mis Productos */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Package className="w-6 h-6 text-primary" />
                            Mis Productos
                        </h2>
                        <Link to="/publish">
                            <Button size="sm" className="rounded-xl">Añadir</Button>
                        </Link>
                    </div>

                    {items.length === 0 ? (
                        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200">
                            <p className="text-slate-400 mb-4">Aún no has subido productos.</p>
                            <Link to="/publish">
                                <Button variant="outline" size="sm">Empezar a publicar</Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {items.map(item => (
                                <Link key={item.id} to={`/item/${item.id}`}>
                                    <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 hover:shadow-md transition-shadow group">
                                        <div className="aspect-video relative overflow-hidden">
                                            <img src={item.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-primary">
                                                {item.price_day}€/día
                                            </div>
                                        </div>
                                        <div className="p-3">
                                            <h3 className="font-semibold text-slate-800 truncate">{item.title}</h3>
                                            <p className="text-xs text-slate-400">{item.city}</p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                {/* Mis Alquileres */}
                <section>
                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Calendar className="w-6 h-6 text-primary" />
                        Mis Alquileres
                    </h2>

                    {bookings.length === 0 ? (
                        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200">
                            <p className="text-slate-400 mb-4">No tienes alquileres activos.</p>
                            <Link to="/">
                                <Button variant="outline" size="sm">Explorar productos</Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {bookings.map(booking => (
                                <div key={booking.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex gap-4">
                                    <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                                        <img src={booking.items?.image_url} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-800 leading-tight mb-1">{booking.items?.title}</h3>
                                        <p className="text-sm text-slate-500 mb-2">
                                            {new Date(booking.start_date).toLocaleDateString()} - {new Date(booking.end_date).toLocaleDateString()}
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-primary font-bold">{booking.total_price}€</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${booking.status === 'accepted' ? 'bg-green-100 text-green-600' :
                                                booking.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
                                                }`}>
                                                {booking.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};
