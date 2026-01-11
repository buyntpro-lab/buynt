import React from 'react';
import { Header } from './Header';
import { BottomTabBar } from './BottomTabBar';
import { Outlet, useLocation } from 'react-router-dom';

export const Layout: React.FC = () => {
    const location = useLocation();
    
    // No mostrar header en landing
    const showHeader = location.pathname !== '/landing';
    
    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            {showHeader && <Header />}
            {/* Main content con padding bottom para tab bar en móvil */}
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8 w-full">
                <Outlet />
            </main>
            {showHeader && (
                <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
                    <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
                        <p>© {new Date().getFullYear()} Buynt. La mejor marketplace de alquileres.</p>
                    </div>
                </footer>
            )}
            <BottomTabBar />
        </div>
    );
};
