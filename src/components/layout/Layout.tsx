import React from 'react';
import { Header } from './Header';
import { Outlet } from 'react-router-dom';

export const Layout: React.FC = () => {
    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <Header />
            {/* Added top padding compensation if needed, but flex-1 handles it. Main container ensures centering. */}
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Outlet />
            </main>
            <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
                <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
                    <p>© {new Date().getFullYear()} Buynt. La mejor marketplace de alquileres.</p>
                </div>
            </footer>
        </div>
    );
};
