import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, PlusCircle, User, Menu, X, MessageSquare } from 'lucide-react';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';

export const Header: React.FC = () => {
    const { isAuthenticated, user } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const navigate = useNavigate();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const checkMessages = async () => {
            if (user?.email) {
                const { messagesService } = await import('../../services/messagesService');
                const count = await messagesService.getUnreadCount(user.email);
                setUnreadCount(count);
            }
        };

        if (isAuthenticated) {
            checkMessages();
            const interval = setInterval(checkMessages, 60000);
            return () => clearInterval(interval);
        }
    }, [user, isAuthenticated]);

    const handlePublishClick = () => {
        if (!isAuthenticated) {
            navigate('/login');
        } else {
            navigate('/publish');
        }
    };

    return (
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 h-16 transition-all duration-300">
            <div className="h-full container mx-auto px-4 max-w-7xl flex items-center justify-between gap-4">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-2 group">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-lg group-hover:scale-110 transition-transform">B</div>
                    <span className="text-xl font-bold bg-gradient-to-r from-primary to-teal-600 bg-clip-text text-transparent">Buynt</span>
                </Link>

                {/* Search Bar - Hidden on mobile if needed, but keeping for now */}
                <div className="hidden md:flex flex-1 max-w-xl relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar artículos..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-full border-transparent focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-gray-400 text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && navigate(`/explorar?q=${e.currentTarget.value}`)}
                    />
                </div>

                {/* Actions */}
                <div className="hidden md:flex items-center gap-2 md:gap-6">
                    <Link to="/explorar" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">
                        Explorar
                    </Link>
                    
                    {isAuthenticated ? (
                        <>
                            <Link to="/messages" className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative group flex flex-col items-center transition-all">
                                <MessageSquare className="w-6 h-6 group-hover:text-primary" />
                                <span className="text-[10px] font-medium mt-0.5">Mensajes</span>
                                {unreadCount > 0 && (
                                    <span className="absolute top-1 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white">
                                        {unreadCount}
                                    </span>
                                )}
                            </Link>
                            <Link to="/profile" className="flex items-center gap-2 p-1 pl-3 border border-slate-100 rounded-full hover:bg-slate-50 transition-all group">
                                <span className="text-sm font-semibold text-slate-700 max-w-[100px] truncate">{user?.full_name?.split(' ')[0]}</span>
                                <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden border-2 border-transparent group-hover:border-primary/20 transition-all">
                                    {user?.avatar_url ? (
                                        <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="w-5 h-5 text-primary" />
                                    )}
                                </div>
                            </Link>
                        </>
                    ) : (
                        <div className="flex items-center gap-4">
                            <Link to="/login" className="text-sm font-bold text-gray-700 hover:text-primary transition-colors">
                                Inicia sesión
                            </Link>
                            <Link to="/register">
                                <Button variant="outline" size="sm" className="rounded-full border-primary/20 text-primary hover:bg-primary/5">
                                    Regístrate
                                </Button>
                            </Link>
                        </div>
                    )}

                    <Button
                        onClick={handlePublishClick}
                        className="rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-shadow gap-2 px-6"
                    >
                        <PlusCircle className="w-5 h-5" />
                        <span className="font-bold">Subir producto</span>
                    </Button>
                </div>

                {/* Mobile Menu Toggle */}
                <button
                    className="md:hidden p-2 text-gray-600"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                    {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {/* Mobile Nav Drawer */}
            {isMenuOpen && (
                <div className="md:hidden absolute top-16 left-0 w-full bg-white border-b border-gray-100 shadow-xl p-4 flex flex-col gap-4 animate-in slide-in-from-top-2">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-xl text-sm outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && navigate(`/explorar?q=${e.currentTarget.value}`)}
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    </div>

                    <Link to="/explorar" className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg text-gray-700 font-medium">
                        Explorar
                    </Link>

                    {isAuthenticated ? (
                        <>
                            <Link to="/messages" className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg text-gray-700">
                                <MessageSquare className="w-5 h-5" />
                                <span>Mensajes</span>
                                {unreadCount > 0 && (
                                    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount}</span>
                                )}
                            </Link>
                            <Link to="/profile" className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg text-gray-700">
                                <User className="w-5 h-5" />
                                <span>Mi Perfil</span>
                            </Link>
                        </>
                    ) : (
                        <Link to="/login" className="block w-full text-center py-2 font-bold text-primary">Inicia Sesión</Link>
                    )}

                    <Button onClick={handlePublishClick} className="w-full justify-center">
                        <PlusCircle className="w-5 h-5 mr-2" /> Subir producto
                    </Button>
                </div>
            )}
        </header>
    );
};
