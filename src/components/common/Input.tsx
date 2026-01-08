import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
    return (
        <div className="flex flex-col gap-2">
            {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
            <input
                className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow ${error ? 'border-red-500 focus:ring-red-200' : 'border-slate-300 focus:ring-indigo-200'
                    } ${className}`}
                {...props}
            />
            {error && <span className="text-sm text-red-500">{error}</span>}
        </div>
    );
};
