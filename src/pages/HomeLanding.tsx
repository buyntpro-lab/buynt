import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ArrowRight, Calendar, Handshake, Shield, Star, Clock, PlusCircle, User, Menu, X, MessageSquare } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Footer } from '../components/layout/Footer';
import { useAuth } from '../context/AuthContext';
import { itemsService } from '../services/supabaseDb';
import type { Item } from '../services/types';

// Category images - using Unsplash placeholders
const CATEGORY_IMAGES = {
    'Fotografía': 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80',
    'Deportes': 'https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=800&q=80',
    'Herramientas': 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80',
    'Electrónica': 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=800&q=80',
    'Outdoor': 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80',
    'Música': 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=800&q=80',
};

const CATEGORIES = [
    { name: 'Fotografía', count: 156, slug: 'Fotografía' },
    { name: 'Deportes', count: 243, slug: 'Deportes' },
    { name: 'Herramientas', count: 89, slug: 'Herramientas' },
    { name: 'Electrónica', count: 178, slug: 'Electrónica' },
    { name: 'Outdoor', count: 112, slug: 'Outdoor' },
    { name: 'Música', count: 67, slug: 'Música' },
];

export const HomeLanding: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [recentItems, setRecentItems] = useState<Item[]>([]);
    const [loadingItems, setLoadingItems] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // Load recent items
    useEffect(() => {
        const fetchRecentItems = async () => {
            try {
                const items = await itemsService.getAll();
                // Sort by created_at desc and take first 8
                const sorted = (items || [])
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .slice(0, 8);
                setRecentItems(sorted);
            } catch (err) {
                console.error('Error fetching items:', err);
            }
            setLoadingItems(false);
        };
        fetchRecentItems();
    }, []);

    // Load unread count
    useEffect(() => {
        const checkMessages = async () => {
            if (user?.email) {
                const { messagesService } = await import('../services/messagesService');
                const count = await messagesService.getUnreadCount(user.email);
                setUnreadCount(count);
            }
        };
        if (isAuthenticated) {
            checkMessages();
        }
    }, [user, isAuthenticated]);

    const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            navigate(`/explorar?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    const handlePublishClick = () => {
        if (isAuthenticated) {
            navigate('/publish');
        } else {
            navigate('/login');
        }
    };

    return (
        <div className="min-h-screen bg-white">
            {/* ==================== NAVBAR ==================== */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 h-16">
                <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2 group flex-shrink-0">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-lg group-hover:scale-110 transition-transform">
                            B
                        </div>
                        <span className="text-xl font-bold text-slate-900">Buynt</span>
                    </Link>

                    {/* Search Bar - Desktop */}
                    <div className="hidden md:flex flex-1 max-w-xl relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Buscar artículos..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleSearch}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-full border-transparent focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                        />
                    </div>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-6">
                        <Link to="/explorar" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">
                            Explorar
                        </Link>
                        
                        {isAuthenticated ? (
                            <>
                                <Link to="/messages" className="relative p-2 text-gray-500 hover:text-primary transition-colors">
                                    <MessageSquare className="w-5 h-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full">
                                            {unreadCount}
                                        </span>
                                    )}
                                </Link>
                                <Link to="/profile" className="flex items-center gap-2 p-1 pl-3 border border-slate-100 rounded-full hover:bg-slate-50 transition-all">
                                    <span className="text-sm font-medium text-slate-700 max-w-[80px] truncate">
                                        {user?.full_name?.split(' ')[0] || 'Usuario'}
                                    </span>
                                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                        {user?.avatar_url ? (
                                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                                        ) : (
                                            <User className="w-4 h-4 text-primary" />
                                        )}
                                    </div>
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">
                                    Iniciar sesión
                                </Link>
                                <Link to="/register">
                                    <Button size="sm" className="rounded-full px-5">
                                        Registrarse
                                    </Button>
                                </Link>
                            </>
                        )}
                        
                        <Button onClick={handlePublishClick} className="rounded-full gap-2 px-5">
                            <PlusCircle className="w-4 h-4" />
                            <span className="font-semibold">Subir producto</span>
                        </Button>
                    </nav>

                    {/* Mobile Menu Toggle */}
                    <button
                        className="md:hidden p-2 text-gray-600"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>

                {/* Mobile Menu */}
                {isMenuOpen && (
                    <div className="md:hidden absolute top-16 left-0 w-full bg-white border-b shadow-lg p-4 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Buscar artículos..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={handleSearch}
                                className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-xl text-sm outline-none"
                            />
                        </div>
                        <Link to="/explorar" className="block py-2 text-gray-700 font-medium" onClick={() => setIsMenuOpen(false)}>
                            Explorar
                        </Link>
                        {isAuthenticated ? (
                            <>
                                <Link to="/messages" className="block py-2 text-gray-700 font-medium" onClick={() => setIsMenuOpen(false)}>
                                    Mensajes {unreadCount > 0 && `(${unreadCount})`}
                                </Link>
                                <Link to="/profile" className="block py-2 text-gray-700 font-medium" onClick={() => setIsMenuOpen(false)}>
                                    Mi Perfil
                                </Link>
                            </>
                        ) : (
                            <Link to="/login" className="block py-2 text-primary font-bold" onClick={() => setIsMenuOpen(false)}>
                                Iniciar Sesión
                            </Link>
                        )}
                        <Button onClick={() => { handlePublishClick(); setIsMenuOpen(false); }} className="w-full justify-center">
                            <PlusCircle className="w-5 h-5 mr-2" /> Subir producto
                        </Button>
                    </div>
                )}
            </header>

            {/* ==================== HERO SECTION ==================== */}
            <section className="relative bg-gradient-to-b from-[#e8f5f0] via-[#f0faf7] to-white py-16 md:py-24">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-5">
                        <span className="text-slate-900">Alquila lo que necesitas.</span>
                        <br />
                        <span className="text-primary">Rentabiliza lo que no usas.</span>
                    </h1>
                    
                    <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
                        El marketplace de alquiler entre particulares. Encuentra cámaras, herramientas, material deportivo y mucho más cerca de ti.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button
                            onClick={() => navigate('/explorar')}
                            className="px-8 py-3 rounded-full text-base font-semibold shadow-lg hover:shadow-xl transition-all gap-2"
                        >
                            Explorar artículos
                            <ArrowRight className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handlePublishClick}
                            className="px-8 py-3 rounded-full text-base font-semibold border-2"
                        >
                            Publicar artículo
                        </Button>
                    </div>
                </div>
            </section>

            {/* ==================== ¿CÓMO FUNCIONA? ==================== */}
            <section className="py-11 md:py-18 bg-white">
                <div className="max-w-6xl mx-auto px-4">
                    <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-12">
                        ¿Cómo funciona?
                    </h2>

                    <div className="grid md:grid-cols-3 gap-8 md:gap-12">
                        {/* Step 1 */}
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-6 bg-cyan-100 rounded-2xl flex items-center justify-center">
                                <Search className="w-8 h-8 text-cyan-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Encuentra</h3>
                            <p className="text-slate-600">
                                Busca el artículo que necesitas cerca de ti
                            </p>
                        </div>

                        {/* Step 2 */}
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-6 bg-violet-100 rounded-2xl flex items-center justify-center">
                                <Calendar className="w-8 h-8 text-violet-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Reserva</h3>
                            <p className="text-slate-600">
                                Elige las fechas y solicita el alquiler
                            </p>
                        </div>

                        {/* Step 3 */}
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-6 bg-amber-100 rounded-2xl flex items-center justify-center">
                                <Handshake className="w-8 h-8 text-amber-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Disfruta</h3>
                            <p className="text-slate-600">
                                Recoge el artículo y devuélvelo al terminar
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ==================== CATEGORÍAS DESTACADAS ==================== */}
            <section className="py-16 md:py-24 bg-slate-50">
                <div className="max-w-7xl mx-auto px-4">
                    <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-12">
                        Categorías destacadas
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {CATEGORIES.map((category) => (
                            <Link
                                key={category.slug}
                                to={`/explorar?category=${encodeURIComponent(category.slug)}`}
                                className="group relative h-48 md:h-56 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all"
                            >
                                <img
                                    src={CATEGORY_IMAGES[category.name as keyof typeof CATEGORY_IMAGES]}
                                    alt={category.name}
                                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                                <div className="absolute bottom-0 left-0 p-5">
                                    <h3 className="text-white font-bold text-xl mb-1">{category.name}</h3>
                                    <p className="text-white/80 text-sm">{category.count} artículos</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* ==================== ARTÍCULOS RECIENTES ==================== */}
            <section className="py-16 md:py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between mb-10">
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
                            Artículos recientes
                        </h2>
                        <Link 
                            to="/explorar" 
                            className="flex items-center gap-2 text-primary font-medium hover:underline"
                        >
                            Ver todos <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    {loadingItems ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="animate-pulse">
                                    <div className="bg-slate-200 rounded-2xl aspect-[4/3] mb-3" />
                                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                                </div>
                            ))}
                        </div>
                    ) : recentItems.length === 0 ? (
                        <div className="text-center py-16 bg-slate-50 rounded-2xl">
                            <p className="text-slate-500 mb-4">No hay artículos disponibles aún</p>
                            <Button onClick={handlePublishClick}>
                                Sé el primero en publicar
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                            {recentItems.map((item) => (
                                <Link
                                    key={item.id}
                                    to={`/item/${item.id}`}
                                    className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all"
                                >
                                    <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                                        <img
                                            src={item.image_url}
                                            alt={item.title}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            loading="lazy"
                                        />
                                        {item.category && (
                                            <span className="absolute top-3 left-3 bg-primary text-white text-xs font-medium px-2 py-1 rounded">
                                                {item.category}
                                            </span>
                                        )}
                                        {item.is_available === false && (
                                            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/90 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-full">
                                                No disponible
                                            </span>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-semibold text-slate-900 line-clamp-1 group-hover:text-primary transition-colors">
                                            {item.title}
                                        </h3>
                                        <div className="flex items-center gap-1 text-slate-500 text-sm mt-1">
                                            <span>📍</span>
                                            <span>{item.city}</span>
                                        </div>
                                        <div className="flex items-center justify-between mt-3">
                                            <span className="text-primary font-bold">
                                                {item.price_day}€<span className="text-slate-400 font-normal text-sm">/día</span>
                                            </span>
                                            <span className="flex items-center gap-1 text-sm text-slate-500">
                                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                                4.8
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* ==================== TRUST STRIP ==================== */}
            <section className="bg-primary py-12">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="grid md:grid-cols-3 gap-8 text-center">
                        <div className="flex flex-col items-center">
                            <Shield className="w-10 h-10 text-white mb-4" />
                            <h3 className="text-white font-bold text-lg mb-1">Pagos seguros</h3>
                            <p className="text-white/80 text-sm">Transacciones protegidas</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <Star className="w-10 h-10 text-white mb-4" />
                            <h3 className="text-white font-bold text-lg mb-1">Usuarios verificados</h3>
                            <p className="text-white/80 text-sm">Comunidad de confianza</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <Clock className="w-10 h-10 text-white mb-4" />
                            <h3 className="text-white font-bold text-lg mb-1">Soporte 24/7</h3>
                            <p className="text-white/80 text-sm">Estamos para ayudarte</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ==================== FOOTER ==================== */}
            <Footer />
        </div>
    );
};
