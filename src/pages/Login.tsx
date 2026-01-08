import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email) {
            login(email);
            navigate('/');
        }
    };

    return (
        <div className="max-w-md mx-auto py-12 px-4">
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 text-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
                    <LogIn className="w-6 h-6" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 mb-2">Bienvenido a Buynt</h1>
                <p className="text-slate-500 mb-8">Ingresa tu email para continuar (Demo)</p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Input
                        placeholder="tu@email.com"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoFocus
                    />
                    <Button type="submit" className="w-full">
                        Entrar
                    </Button>
                    <p className="text-xs text-slate-400 mt-2">
                        No necesitas contraseña para esta demo.
                    </p>
                </form>
            </div>
        </div>
    );
};
