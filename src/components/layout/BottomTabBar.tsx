import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, PlusCircle, MessageSquare, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface TabBarItem {
    label: string;
    path: string;
    icon: React.ReactNode;
    badge?: number;
}

export const BottomTabBar: React.FC = () => {
    const location = useLocation();
    const { isAuthenticated } = useAuth();

    // Esconder tab bar en landing y login/register
    if (location.pathname === '/landing' || location.pathname === '/login' || location.pathname === '/register') {
        return null;
    }

    const tabs: TabBarItem[] = [
        { label: 'Inicio', path: '/', icon: <Home className="w-6 h-6" /> },
        { label: 'Buscar', path: '/?tab=search', icon: <Search className="w-6 h-6" /> },
        { label: 'Publicar', path: isAuthenticated ? '/publish' : '/login', icon: <PlusCircle className="w-6 h-6" /> },
        { label: 'Mensajes', path: isAuthenticated ? '/inbox' : '/login', icon: <MessageSquare className="w-6 h-6" /> },
        { label: 'Perfil', path: isAuthenticated ? '/profile' : '/login', icon: <User className="w-6 h-6" /> },
    ];

    const isActive = (path: string) => {
        if (path.includes('?')) {
            return location.pathname === path.split('?')[0];
        }
        return location.pathname === path;
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-slate-200 shadow-2xl z-40">
            <div className="flex justify-around items-center h-20">
                {tabs.map((tab) => (
                    <Link
                        key={tab.path}
                        to={tab.path}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 px-2 transition-all duration-200 relative ${
                            isActive(tab.path)
                                ? 'text-primary'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {tab.icon}
                        <span className="text-xs font-medium whitespace-nowrap">{tab.label}</span>
                        {tab.badge && tab.badge > 0 && (
                            <span className="absolute top-2 right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                                {tab.badge}
                            </span>
                        )}
                        {isActive(tab.path) && (
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full"></div>
                        )}
                    </Link>
                ))}
            </div>
        </div>
    );
};
