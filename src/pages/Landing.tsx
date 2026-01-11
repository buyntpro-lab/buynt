import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Shield, Users, TrendingUp, ArrowRight, Smartphone, Lock, Star } from 'lucide-react';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';

export const Landing: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    const categories = [
        { name: 'Deportes', icon: '⚽', count: 1240 },
        { name: 'Electrónica', icon: '💻', count: 856 },
        { name: 'Herramientas', icon: '🔧', count: 623 },
        { name: 'Moda', icon: '👕', count: 1095 },
        { name: 'Hogar', icon: '🏠', count: 742 },
        { name: 'Viajes', icon: '✈️', count: 534 },
    ];

    const steps = [
        {
            number: 1,
            title: 'Busca lo que necesitas',
            description: 'Explora miles de productos disponibles en tu ciudad. Filtra por categoría, precio y fechas.',
            icon: ShoppingBag,
        },
        {
            number: 2,
            title: 'Solicita y contacta',
            description: 'Envía una solicitud de alquiler y comunícate directamente con el propietario.',
            icon: Users,
        },
        {
            number: 3,
            title: 'Alquila con confianza',
            description: 'Recoge el producto y disfruta. Transacciones seguras y sin complicaciones.',
            icon: Shield,
        },
    ];

    const trustPoints = [
        {
            icon: Lock,
            title: 'Pagos seguros',
            description: 'Todas las transacciones están protegidas y aseguradas.',
        },
        {
            icon: Star,
            title: 'Sistema de reseñas',
            description: 'Lee opiniones reales de usuarios verificados.',
        },
        {
            icon: Smartphone,
            title: 'Soporte 24/7',
            description: 'Estamos aquí para ayudarte cuando lo necesites.',
        },
    ];

    return (
        <div className="min-h-screen bg-white">
            {/* HERO SECTION */}
            <section className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center pt-20 pb-10 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    {/* Logo grande */}
                    <div className="mb-8 flex justify-center">
                        <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-teal-600 rounded-3xl flex items-center justify-center">
                            <ShoppingBag className="w-10 h-10 text-white" />
                        </div>
                    </div>

                    {/* Headline */}
                    <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
                        Alquila lo que necesitas.{' '}
                        <span className="bg-gradient-to-r from-indigo-600 to-teal-600 bg-clip-text text-transparent">
                            Rentabiliza lo que no usas.
                        </span>
                    </h1>

                    {/* Subheadline */}
                    <p className="text-xl md:text-2xl text-slate-600 mb-12 max-w-2xl mx-auto">
                        Buynt es el marketplace peer-to-peer donde alquilas artículos a otros usuarios. Deportes, electrónica, herramientas y mucho más en tu ciudad.
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
                        <Button
                            onClick={() => navigate('/')}
                            className="px-8 py-4 rounded-2xl text-lg font-bold shadow-lg shadow-indigo-600/20 hover:shadow-xl hover:shadow-indigo-600/30 transition-all"
                        >
                            <span className="flex items-center gap-2">
                                Explorar productos <ArrowRight className="w-5 h-5" />
                            </span>
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => navigate(isAuthenticated ? '/publish' : '/login')}
                            className="px-8 py-4 rounded-2xl text-lg font-bold"
                        >
                            <span className="flex items-center gap-2">
                                {isAuthenticated ? 'Publicar ahora' : 'Publicar artículo'} <TrendingUp className="w-5 h-5" />
                            </span>
                        </Button>
                    </div>

                    {/* Hero Image Placeholder */}
                    <div className="relative h-96 md:h-[500px] bg-gradient-to-b from-slate-200 to-slate-100 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <ShoppingBag className="w-24 h-24 text-slate-400 mx-auto mb-4" />
                                <p className="text-slate-500 text-lg">Galería de productos destacados</p>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-8 mt-16 pt-16 border-t border-slate-200">
                        <div>
                            <p className="text-3xl md:text-4xl font-bold text-indigo-600">45K+</p>
                            <p className="text-slate-600 mt-2">Productos activos</p>
                        </div>
                        <div>
                            <p className="text-3xl md:text-4xl font-bold text-teal-600">12K+</p>
                            <p className="text-slate-600 mt-2">Usuarios activos</p>
                        </div>
                        <div>
                            <p className="text-3xl md:text-4xl font-bold text-indigo-600">$2.3M</p>
                            <p className="text-slate-600 mt-2">En transacciones</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CÓMO FUNCIONA */}
            <section className="py-20 px-4 bg-white">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-4xl md:text-5xl font-bold text-center text-slate-900 mb-16">
                        Cómo funciona
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
                        {steps.map((step, idx) => {
                            const IconComponent = step.icon;
                            return (
                                <div key={idx} className="relative">
                                    {/* Número */}
                                    <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-teal-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-6">
                                        {step.number}
                                    </div>

                                    {/* Icon */}
                                    <IconComponent className="w-12 h-12 text-indigo-600 mb-4" />

                                    {/* Título */}
                                    <h3 className="text-2xl font-bold text-slate-900 mb-3">{step.title}</h3>

                                    {/* Descripción */}
                                    <p className="text-slate-600 leading-relaxed">{step.description}</p>

                                    {/* Conector */}
                                    {idx < steps.length - 1 && (
                                        <div className="hidden md:block absolute top-14 -right-12 w-24 h-1 bg-gradient-to-r from-indigo-600 to-transparent"></div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* CATEGORÍAS DESTACADAS */}
            <section className="py-20 px-4 bg-slate-50">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-4xl md:text-5xl font-bold text-center text-slate-900 mb-16">
                        Explora por categorías
                    </h2>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                        {categories.map((cat, idx) => (
                            <Link
                                key={idx}
                                to={`/?category=${cat.name.toLowerCase()}`}
                                className="group bg-white rounded-2xl p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer border border-slate-200 hover:border-indigo-300"
                            >
                                <div className="text-4xl mb-3">{cat.icon}</div>
                                <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                    {cat.name}
                                </h3>
                                <p className="text-sm text-slate-500 mt-2">{cat.count} productos</p>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* SEGURIDAD Y CONFIANZA */}
            <section className="py-20 px-4 bg-white">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-4xl md:text-5xl font-bold text-center text-slate-900 mb-16">
                        Alquila con confianza
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {trustPoints.map((point, idx) => {
                            const IconComponent = point.icon;
                            return (
                                <div key={idx} className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-8 border border-slate-200 hover:border-indigo-300 transition-all">
                                    <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-6">
                                        <IconComponent className="w-6 h-6 text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-3">{point.title}</h3>
                                    <p className="text-slate-600">{point.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* TESTIMONIOS PLACEHOLDER */}
            <section className="py-20 px-4 bg-slate-50">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-4xl md:text-5xl font-bold text-center text-slate-900 mb-16">
                        Qué dicen nuestros usuarios
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                name: 'María García',
                                role: 'Usuario desde 2024',
                                text: '"Alquilé una cámara profesional a mitad de precio. ¡Excelente experiencia!"',
                                avatar: '👩',
                            },
                            {
                                name: 'Juan López',
                                role: 'Propietario activo',
                                text: '"Monetizo mis herramientas que no uso. Buynt es muy fácil de usar."',
                                avatar: '👨',
                            },
                            {
                                name: 'Sofia Martinez',
                                role: 'Usuario desde 2023',
                                text: '"Seguridad y confianza. La mejor plataforma de alquileres entre particulares."',
                                avatar: '👩‍🦰',
                            },
                        ].map((testimonial, idx) => (
                            <div key={idx} className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="text-4xl">{testimonial.avatar}</span>
                                    <div>
                                        <p className="font-bold text-slate-900">{testimonial.name}</p>
                                        <p className="text-sm text-slate-500">{testimonial.role}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1 mb-3">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                    ))}
                                </div>
                                <p className="text-slate-600 italic">{testimonial.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA FINAL */}
            <section className="py-20 px-4 bg-gradient-to-r from-indigo-600 to-teal-600">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                        ¿Listo para empezar?
                    </h2>
                    <p className="text-xl text-white/90 mb-12 max-w-2xl mx-auto">
                        Únete a miles de usuarios que ya alquilan y ganan dinero en Buynt.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button
                            onClick={() => navigate('/')}
                            variant="outline"
                            className="px-8 py-4 rounded-2xl text-lg font-bold text-indigo-600 hover:bg-white/20"
                        >
                            Explorar
                        </Button>
                        <Button
                            onClick={() => navigate(isAuthenticated ? '/publish' : '/login')}
                            className="px-8 py-4 rounded-2xl text-lg font-bold bg-white text-indigo-600 hover:bg-slate-100 shadow-lg"
                        >
                            Publicar ahora
                        </Button>
                    </div>
                </div>
            </section>
        </div>
    );
};
