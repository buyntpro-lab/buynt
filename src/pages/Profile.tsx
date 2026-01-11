import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { itemsService, bookingsService } from '../services/supabaseDb';
import { Button } from '../components/common/Button';
import { Package, Calendar, LogOut, CheckCircle, Edit2, Trash2, Settings, Upload, Phone, FileText } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import type { Item } from '../services/types';
import toast from 'react-hot-toast';

type TabType = 'rentals' | 'articles' | 'settings';

interface ProfileData {
    full_name: string;
    phone?: string;
    dni_verified: boolean;
    avatar_url?: string;
}

export const Profile: React.FC = () => {
    const { user, signOut, isAuthenticated, loading: authLoading } = useAuth();
    const [items, setItems] = useState<Item[]>([]);
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('rentals');
    const [editingProfile, setEditingProfile] = useState(false);
    const [profileData, setProfileData] = useState<ProfileData>({
        full_name: '',
        phone: '',
        dni_verified: false
    });
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingDNI, setUploadingDNI] = useState(false);
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
            try {
                console.log('👤 Loading profile data for user:', user.id);
                console.log('📧 User email:', user.email);
                
                const [myItems, myBookings] = await Promise.all([
                    itemsService.getByUserId(user.id),
                    bookingsService.getByUserId(user.id)
                ]);
                
                console.log('✅ Loaded items:', myItems?.length || 0);
                console.log('✅ Loaded bookings:', myBookings?.length || 0);
                
                setItems(myItems);
                setBookings(myBookings);
                
                // Initialize profile data
                setProfileData({
                    full_name: user.full_name || '',
                    phone: user.phone || '',
                    dni_verified: user.dni_verified || false,
                    avatar_url: user.avatar_url
                });
            } catch (error) {
                console.error('❌ Error loading profile data:', error);
                toast.error('Error al cargar los datos del perfil');
            }
        }
        setLoading(false);
    };

    const handleSignOut = async () => {
        try {
            console.log('👋 Logging out user...');
            await signOut();
            console.log('✅ Sign out successful, redirecting...');
            toast.success('Sesión cerrada correctamente');
            setTimeout(() => {
                navigate('/');
            }, 300);
        } catch (error: any) {
            console.error('❌ Sign out error:', error);
            toast.error('Error al cerrar sesión');
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        if (confirm('¿Estás seguro de que quieres eliminar este producto?')) {
            const success = await itemsService.delete(itemId);
            if (success) {
                setItems(items.filter(i => i.id !== itemId));
                toast.success('Producto eliminado correctamente');
            } else {
                toast.error('Error al eliminar el producto');
            }
        }
    };

    const handleUpdateProfile = async () => {
        if (!user) return;
        
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: profileData.full_name,
                    phone: profileData.phone
                })
                .eq('id', user.id);

            if (error) throw error;
            
            toast.success('Perfil actualizado correctamente');
            setEditingProfile(false);
        } catch (error: any) {
            toast.error(error.message || 'Error al actualizar el perfil');
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!user || !e.target.files?.[0]) {
            console.warn('⚠️ Avatar upload: No user or file selected');
            return;
        }
        
        setUploadingAvatar(true);
        const file = e.target.files[0];
        const fileName = `${user.id}-avatar-${Date.now()}`;

        try {
            console.log('📤 Uploading avatar:', fileName, 'Size:', file.size);
            
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file, { upsert: true });

            if (uploadError) {
                console.error('❌ Avatar upload failed:', uploadError);
                throw uploadError;
            }

            console.log('✅ Avatar uploaded, getting public URL...');
            
            const { data } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            if (!data?.publicUrl) {
                throw new Error('No se pudo obtener la URL pública del avatar');
            }

            console.log('📝 Updating profile with avatar URL:', data.publicUrl);
            
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: data.publicUrl })
                .eq('id', user.id);

            if (updateError) {
                console.error('❌ Profile update failed:', updateError);
                throw updateError;
            }

            setProfileData(prev => ({ ...prev, avatar_url: data.publicUrl }));
            console.log('✅ Avatar updated successfully');
            toast.success('Avatar actualizado correctamente');
        } catch (error: any) {
            console.error('❌ Avatar upload error:', error);
            toast.error(error.message || 'Error al subir el avatar');
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleDNIUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!user || !e.target.files?.[0]) {
            console.warn('⚠️ DNI upload: No user or file selected');
            return;
        }
        
        setUploadingDNI(true);
        const file = e.target.files[0];
        const fileName = `${user.id}-dni-${Date.now()}`;

        try {
            console.log('📤 Uploading DNI document:', fileName, 'Size:', file.size);
            
            const { error: uploadError } = await supabase.storage
                .from('dni-documents')
                .upload(fileName, file, { upsert: true });

            if (uploadError) {
                console.error('❌ DNI upload failed:', uploadError);
                throw uploadError;
            }

            console.log('✅ DNI document uploaded successfully');
            toast.success('DNI enviado para verificación. Nos pondremos en contacto pronto.');
        } catch (error: any) {
            console.error('❌ DNI upload error:', error);
            toast.error(error.message || 'Error al subir el DNI');
        } finally {
            setUploadingDNI(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-slate-500">Cargando perfil...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            {/* HEADER DEL PERFIL */}
            <div className="bg-gradient-to-r from-primary/5 to-indigo-100/20 rounded-[24px] p-8 mb-8 border border-primary/10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    {/* Avatar con opción de cambiar */}
                    <div className="relative group">
                        <img
                            src={profileData.avatar_url || `https://ui-avatars.com/api/?name=${user?.full_name}&background=5C40F2&color=fff&size=96`}
                            alt="Profile"
                            className="w-28 h-28 rounded-[16px] object-cover ring-4 ring-primary/10 group-hover:ring-primary/30 transition-all"
                        />
                        <label className="absolute bottom-2 right-2 bg-primary text-white p-2 rounded-full cursor-pointer hover:bg-primary/90 transition-colors shadow-lg opacity-0 group-hover:opacity-100">
                            <Upload className="w-4 h-4" />
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarUpload}
                                disabled={uploadingAvatar}
                                className="hidden"
                            />
                        </label>
                        {profileData.dni_verified && (
                            <div className="absolute -bottom-2 -right-2 bg-green-500 text-white p-1.5 rounded-full border-2 border-white shadow-md" title="DNI Verificado">
                                <CheckCircle className="w-5 h-5" />
                            </div>
                        )}
                    </div>

                    {/* Información del usuario */}
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-1">{user?.full_name}</h1>
                                <p className="text-slate-500 mb-4">{user?.email}</p>
                                {profileData.dni_verified && (
                                    <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                                        ✓ Usuario Verificado
                                    </span>
                                )}
                            </div>
                            <Button 
                                variant="outline" 
                                onClick={handleSignOut} 
                                className="rounded-[12px] border-slate-300 text-slate-700 hover:bg-slate-100 gap-2 self-start sm:self-center"
                            >
                                <LogOut className="w-4 h-4" />
                                Cerrar Sesión
                            </Button>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-primary/10">
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Productos Activos</p>
                                <p className="text-2xl font-bold text-primary">{items.length}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Alquileres</p>
                                <p className="text-2xl font-bold text-primary">{bookings.length}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Miembro Desde</p>
                                <p className="text-sm font-semibold text-slate-700">{user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Verificación</p>
                                <p className="text-sm font-semibold text-slate-700">{profileData.dni_verified ? '✓ Verificado' : '⏳ Pendiente'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* NAVIGATION TABS */}
            <div className="flex gap-2 mb-8 border-b border-slate-200 overflow-x-auto">
                {[
                    { id: 'rentals' as TabType, label: 'Mis Alquileres', icon: Calendar },
                    { id: 'articles' as TabType, label: 'Mis Artículos', icon: Package },
                    { id: 'settings' as TabType, label: 'Ajustes', icon: Settings }
                ].map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-6 py-4 font-semibold text-sm flex items-center gap-2 whitespace-nowrap transition-all border-b-2 ${
                                activeTab === tab.id
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* TAB CONTENT */}
            <div className="min-h-[400px]">
                {/* MIS ALQUILERES */}
                {activeTab === 'rentals' && (
                    <div className="space-y-6">
                        {bookings.length === 0 ? (
                            <div className="bg-white rounded-[20px] p-16 text-center border border-dashed border-slate-200">
                                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500 text-lg mb-4">No tienes alquileres activos</p>
                                <Link to="/">
                                    <Button variant="outline" className="rounded-[12px]">
                                        Explorar productos
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {bookings.map(booking => (
                                    <div key={booking.id} className="bg-white rounded-[20px] overflow-hidden border border-slate-100 hover:shadow-lg transition-shadow">
                                        <div className="flex flex-col sm:flex-row">
                                            <div className="w-full sm:w-40 h-40 sm:h-auto flex-shrink-0 overflow-hidden bg-slate-100">
                                                <img 
                                                    src={booking.items?.image_url} 
                                                    alt={booking.items?.title}
                                                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                                                />
                                            </div>
                                            <div className="p-6 flex-1">
                                                <h3 className="font-bold text-slate-900 mb-2 line-clamp-2">{booking.items?.title}</h3>
                                                <div className="space-y-2 mb-4">
                                                    <p className="text-sm text-slate-600 flex items-center gap-2">
                                                        <Calendar className="w-4 h-4 text-primary" />
                                                        {new Date(booking.start_date).toLocaleDateString()} - {new Date(booking.end_date).toLocaleDateString()}
                                                    </p>
                                                    <p className="text-sm text-slate-600 flex items-center gap-2">
                                                        <span className="text-lg font-bold text-primary">{booking.total_price}€</span>
                                                        <span className="text-slate-400">total</span>
                                                    </p>
                                                </div>
                                                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                                    <span className={`text-[11px] px-3 py-1.5 rounded-full font-bold uppercase tracking-wide ${
                                                        booking.status === 'accepted' ? 'bg-green-100 text-green-700' :
                                                        booking.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                        {booking.status === 'accepted' ? '✓ Confirmado' : 
                                                         booking.status === 'pending' ? '⏳ Pendiente' : '✗ Rechazado'}
                                                    </span>
                                                    <Link to={`/chat?booking=${booking.id}`}>
                                                        <Button size="sm" variant="ghost" className="rounded-[12px]">
                                                            Contactar
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* MIS ARTÍCULOS */}
                {activeTab === 'articles' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-slate-900">Productos para Alquilar</h2>
                            <Link to="/publish">
                                <Button className="rounded-[12px] gap-2">
                                    <Package className="w-4 h-4" />
                                    Subir Nuevo
                                </Button>
                            </Link>
                        </div>

                        {items.length === 0 ? (
                            <div className="bg-white rounded-[20px] p-16 text-center border border-dashed border-slate-200">
                                <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500 text-lg mb-4">Aún no has subido productos</p>
                                <Link to="/publish">
                                    <Button className="rounded-[12px]">Empezar a publicar</Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {items.map(item => (
                                    <div key={item.id} className="bg-white rounded-[20px] overflow-hidden border border-slate-100 hover:shadow-lg transition-shadow group">
                                        <div className="relative aspect-video overflow-hidden bg-slate-100">
                                            <img 
                                                src={item.image_url} 
                                                alt={item.title}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            />
                                            <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-[12px] text-sm font-bold text-primary">
                                                {item.price_day}€/día
                                            </div>
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <Link to={`/item/${item.id}`} className="flex-1">
                                                    <Button size="sm" variant="secondary" className="w-full rounded-[12px]">
                                                        Ver
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                        <div className="p-5">
                                            <h3 className="font-bold text-slate-900 mb-1 line-clamp-2">{item.title}</h3>
                                            <p className="text-xs text-slate-500 mb-4">{item.city} • {item.category}</p>
                                            <p className="text-sm text-slate-600 mb-4 line-clamp-2">{item.description}</p>
                                            <div className="flex gap-2">
                                                <Link to={`/item/${item.id}/editar`} className="flex-1">
                                                    <Button size="sm" variant="outline" className="w-full rounded-[12px] gap-2">
                                                        <Edit2 className="w-3 h-3" />
                                                        Editar
                                                    </Button>
                                                </Link>
                                                <button
                                                    onClick={() => handleDeleteItem(item.id)}
                                                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-[12px] transition-colors font-medium text-sm flex items-center gap-1"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* AJUSTES */}
                {activeTab === 'settings' && (
                    <div className="max-w-2xl">
                        <div className="bg-white rounded-[20px] p-8 border border-slate-100">
                            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <Settings className="w-6 h-6 text-primary" />
                                Configuración de Perfil
                            </h2>

                            {!editingProfile ? (
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-sm font-semibold text-slate-700 block mb-2">Nombre Completo</label>
                                        <p className="text-slate-900 py-3 px-4 bg-slate-50 rounded-[12px]">{profileData.full_name}</p>
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-slate-700 block mb-2">Email</label>
                                        <p className="text-slate-900 py-3 px-4 bg-slate-50 rounded-[12px]">{user?.email}</p>
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-slate-700 block mb-2">Teléfono</label>
                                        <p className="text-slate-900 py-3 px-4 bg-slate-50 rounded-[12px]">{profileData.phone || 'No especificado'}</p>
                                    </div>

                                    <Button 
                                        onClick={() => setEditingProfile(true)}
                                        className="rounded-[12px] w-full gap-2"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                        Editar Información
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-sm font-semibold text-slate-700 block mb-2">Nombre Completo</label>
                                        <input
                                            type="text"
                                            value={profileData.full_name}
                                            onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-slate-700 block mb-2">Teléfono</label>
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-5 h-5 text-slate-400" />
                                            <input
                                                type="tel"
                                                value={profileData.phone || ''}
                                                onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                                                placeholder="+34 600 123 456"
                                                className="flex-1 px-4 py-3 border border-slate-200 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <Button 
                                            onClick={handleUpdateProfile}
                                            className="flex-1 rounded-[12px]"
                                        >
                                            Guardar Cambios
                                        </Button>
                                        <Button 
                                            onClick={() => setEditingProfile(false)}
                                            variant="outline"
                                            className="flex-1 rounded-[12px]"
                                        >
                                            Cancelar
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* DNI Verification Section */}
                            <div className="mt-8 pt-8 border-t border-slate-200">
                                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-primary" />
                                    Verificación de Identidad
                                </h3>

                                {profileData.dni_verified ? (
                                    <div className="bg-green-50 border border-green-200 rounded-[12px] p-4 flex items-center gap-3">
                                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                        <div>
                                            <p className="font-semibold text-green-900">DNI Verificado</p>
                                            <p className="text-sm text-green-700">Tu identidad ha sido verificada exitosamente.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-slate-600 text-sm mb-4">
                                            Verifica tu identidad subiendo una foto clara de tu DNI (frente y reverso).
                                            Esto nos ayuda a mantener la plataforma segura.
                                        </p>
                                        <label className="block">
                                            <input
                                                type="file"
                                                accept="image/*,.pdf"
                                                onChange={handleDNIUpload}
                                                disabled={uploadingDNI}
                                                className="hidden"
                                            />
                                            <div className="border-2 border-dashed border-slate-300 rounded-[12px] p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                                                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                                <p className="font-semibold text-slate-700 mb-1">
                                                    {uploadingDNI ? 'Subiendo...' : 'Haz clic para subir tu DNI'}
                                                </p>
                                                <p className="text-sm text-slate-500">PNG, JPG o PDF (máx. 10MB)</p>
                                            </div>
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
