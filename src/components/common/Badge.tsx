import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'success' | 'warning' | 'error';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default' }) => {
    const variantStyles = {
        default: 'bg-indigo-600 text-white',
        success: 'bg-emerald-500 text-white',
        warning: 'bg-amber-500 text-white',
        error: 'bg-red-500 text-white',
    };

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold leading-none ${variantStyles[variant]}`}>
            {children}
        </span>
    );
};
