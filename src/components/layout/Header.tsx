import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, PlusCircle, Menu, X, MessageCircle, User as UserIcon, LogIn } from 'lucide-react';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';

export const Header: React.FC = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const handlePublishClick = () => {
        navigate('/publish');
        setIsMenuOpen(false);
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        if (term) {
            navigate(`/?q=${encodeURIComponent(term)}`);
        } else {
            navigate('/');
        }
    };

    return (
        <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
            <div className="container mx-auto h-20 flex items-center justify-between gap-4">

                {/* Logo */}
                <Link to="/" className="flex-shrink-0 flex items-center gap-2 group">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xl">
                        B
                    </div>
                    <span className="text-2xl font-bold text-primary tracking-tight">Buynt</span>
                </Link>

                {/* Desktop Search Bar - Expanding */}
                <div className="hidden md:flex flex-1 max-w-2xl px-8">
                    <div className="relative w-full group">
                        <input
                            type="text"
                            placeholder="¿Qué estás buscando?"
                            onChange={handleSearch}
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-full focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-gray-700 placeholder-gray-400"
                        />
                        <Search className="absolute left-4 top-3.5 text-gray-400 w-5 h-5 group-focus-within:text-primary transition-colors" />
                    </div>
                </div>

                {/* Desktop Actions */}
                <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                    {isAuthenticated ? (
                        <>
                            <Link to="/inbox" className="flex flex-col items-center text-gray-500 hover:text-primary transition-colors gap-1">
                                <MessageCircle className="w-6 h-6" />
                                <span className="text-xs font-medium">Mensajes</span>
                            </Link>
                            <Link to="/my-items" className="flex flex-col items-center text-gray-500 hover:text-primary transition-colors gap-1">
                                <UserIcon className="w-6 h-6" />
                                <span className="text-xs font-medium">Tú</span>
                            </Link>
                        </>
                    ) : (
                        <Link to="/login" className="text-gray-600 font-medium hover:text-primary transition-colors">
                            Inicia sesión
                        </Link>
                    )}

                    <Button
                        onClick={handlePublishClick}
                        className="rounded-full px-6 bg-primary hover:bg-primary-dark text-white font-semibold shadow-md hover:shadow-lg transform active:scale-95 transition-all gap-2"
                    >
                        <PlusCircle className="w-5 h-5" />
                        <span>Subir producto</span>
                    </Button>
                </div>

                {/* Mobile Menu Toggle */}
                <button
                    className="md:hidden p-2 text-gray-600"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                    {isMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
                </button>
            </div>

            {/* Mobile Nav Drawer */}
            {isMenuOpen && (
                <div className="md:hidden absolute top-20 left-0 w-full bg-white border-b border-gray-100 shadow-xl p-4 flex flex-col gap-4 animate-in slide-in-from-top-2">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="¿Qué buscas?"
                            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full outline-none"
                        />
                        <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                    </div>

                    <div className="flex flex-col gap-1">
                        {isAuthenticated ? (
                            <>
                                <Link to="/my-items" onClick={() => setIsMenuOpen(false)} className="px-4 py-3 hover:bg-gray-50 rounded-lg text-gray-700 font-medium flex items-center gap-3">
                                    <UserIcon className="w-5 h-5" /> Mis Anuncios
                                </Link>
                                <Link to="/inbox" onClick={() => setIsMenuOpen(false)} className="px-4 py-3 hover:bg-gray-50 rounded-lg text-gray-700 font-medium flex items-center gap-3">
                                    <MessageCircle className="w-5 h-5" /> Mensajes
                                </Link>
                            </>
                        ) : (
                            <Link to="/login" onClick={() => setIsMenuOpen(false)} className="px-4 py-3 hover:bg-gray-50 rounded-lg text-gray-700 font-medium flex items-center gap-3">
                                <LogIn className="w-5 h-5" /> Iniciar Sesión
                            </Link>
                        )}
                    </div>

                    <Button onClick={handlePublishClick} className="w-full justify-center rounded-full py-3">
                        <PlusCircle className="w-5 h-5 mr-2" /> Subir producto
                    </Button>
                </div>
            )}
        </header>
    );
};
