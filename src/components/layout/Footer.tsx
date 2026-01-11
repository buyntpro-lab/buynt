import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
    return (
        <footer className="bg-white border-t border-slate-200">
            <div className="max-w-7xl mx-auto px-4 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
                    {/* Brand Column */}
                    <div className="lg:col-span-1">
                        <Link to="/" className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-lg">
                                B
                            </div>
                            <span className="text-xl font-bold text-slate-900">Buynt</span>
                        </Link>
                        <p className="text-slate-600 text-sm leading-relaxed">
                            El marketplace de alquiler entre particulares.
                            <br />
                            Alquila lo que necesitas, rentabiliza lo que no usas.
                        </p>
                    </div>

                    {/* Explorar Column */}
                    <div>
                        <h4 className="font-semibold text-slate-900 mb-4">Explorar</h4>
                        <ul className="space-y-3">
                            <li>
                                <Link to="/explorar" className="text-slate-600 hover:text-primary text-sm transition-colors">
                                    Todos los artículos
                                </Link>
                            </li>
                            <li>
                                <Link to="/explorar?category=Fotografía" className="text-slate-600 hover:text-primary text-sm transition-colors">
                                    Fotografía
                                </Link>
                            </li>
                            <li>
                                <Link to="/explorar?category=Deportes" className="text-slate-600 hover:text-primary text-sm transition-colors">
                                    Deportes
                                </Link>
                            </li>
                            <li>
                                <Link to="/explorar?category=Herramientas" className="text-slate-600 hover:text-primary text-sm transition-colors">
                                    Herramientas
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Información Column */}
                    <div>
                        <h4 className="font-semibold text-slate-900 mb-4">Información</h4>
                        <ul className="space-y-3">
                            <li>
                                <Link to="/como-funciona" className="text-slate-600 hover:text-primary text-sm transition-colors">
                                    Cómo funciona
                                </Link>
                            </li>
                            <li>
                                <Link to="/seguridad" className="text-slate-600 hover:text-primary text-sm transition-colors">
                                    Seguridad
                                </Link>
                            </li>
                            <li>
                                <Link to="/ayuda" className="text-slate-600 hover:text-primary text-sm transition-colors">
                                    Centro de ayuda
                                </Link>
                            </li>
                            <li>
                                <Link to="/contacto" className="text-slate-600 hover:text-primary text-sm transition-colors">
                                    Contacto
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Legal Column */}
                    <div>
                        <h4 className="font-semibold text-slate-900 mb-4">Legal</h4>
                        <ul className="space-y-3">
                            <li>
                                <Link to="/legal/privacidad" className="text-slate-600 hover:text-primary text-sm transition-colors">
                                    Política de privacidad
                                </Link>
                            </li>
                            <li>
                                <Link to="/legal/terminos" className="text-slate-600 hover:text-primary text-sm transition-colors">
                                    Términos de uso
                                </Link>
                            </li>
                            <li>
                                <Link to="/legal/cookies" className="text-slate-600 hover:text-primary text-sm transition-colors">
                                    Política de cookies
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Copyright */}
                <div className="border-t border-slate-200 mt-12 pt-8">
                    <p className="text-center text-slate-500 text-sm">
                        © 2026 Buynt. Todos los derechos reservados.
                    </p>
                </div>
            </div>
        </footer>
    );
};
