import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface LegalPageProps {
    title: string;
    children: React.ReactNode;
}

const LegalPageLayout: React.FC<LegalPageProps> = ({ title, children }) => (
    <div className="min-h-screen bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 py-12">
            <Link to="/" className="inline-flex items-center gap-2 text-primary mb-8 hover:underline">
                <ArrowLeft className="w-4 h-4" />
                Volver al inicio
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 mb-8">{title}</h1>
            <div className="bg-white rounded-2xl shadow-sm p-8 prose prose-slate max-w-none">
                {children}
            </div>
        </div>
    </div>
);

export const PrivacyPolicy: React.FC = () => (
    <LegalPageLayout title="Política de privacidad">
        <p className="text-slate-600 mb-4">
            Última actualización: Enero 2026
        </p>
        <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-3">1. Información que recopilamos</h2>
        <p className="text-slate-600 mb-4">
            En Buynt, recopilamos información personal que nos proporcionas directamente, como tu nombre, dirección de correo electrónico, y datos de perfil cuando te registras en nuestra plataforma.
        </p>
        <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-3">2. Uso de la información</h2>
        <p className="text-slate-600 mb-4">
            Utilizamos tu información para facilitar las transacciones de alquiler, mejorar nuestros servicios, y comunicarnos contigo sobre tu cuenta y actividad en la plataforma.
        </p>
        <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-3">3. Protección de datos</h2>
        <p className="text-slate-600 mb-4">
            Implementamos medidas de seguridad técnicas y organizativas para proteger tu información personal contra acceso no autorizado, pérdida o alteración.
        </p>
    </LegalPageLayout>
);

export const TermsOfUse: React.FC = () => (
    <LegalPageLayout title="Términos de uso">
        <p className="text-slate-600 mb-4">
            Última actualización: Enero 2026
        </p>
        <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-3">1. Aceptación de términos</h2>
        <p className="text-slate-600 mb-4">
            Al acceder y utilizar Buynt, aceptas estar sujeto a estos términos de uso. Si no estás de acuerdo con alguna parte de estos términos, no debes utilizar nuestra plataforma.
        </p>
        <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-3">2. Uso de la plataforma</h2>
        <p className="text-slate-600 mb-4">
            Buynt es un marketplace que conecta a personas que desean alquilar artículos con propietarios de dichos artículos. No somos parte de las transacciones entre usuarios.
        </p>
        <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-3">3. Responsabilidades del usuario</h2>
        <p className="text-slate-600 mb-4">
            Los usuarios son responsables de mantener la confidencialidad de sus credenciales de acceso y de toda la actividad que ocurra bajo su cuenta.
        </p>
    </LegalPageLayout>
);

export const CookiesPolicy: React.FC = () => (
    <LegalPageLayout title="Política de cookies">
        <p className="text-slate-600 mb-4">
            Última actualización: Enero 2026
        </p>
        <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-3">¿Qué son las cookies?</h2>
        <p className="text-slate-600 mb-4">
            Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitas nuestra web. Nos ayudan a recordar tus preferencias y mejorar tu experiencia.
        </p>
        <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-3">Cookies que utilizamos</h2>
        <p className="text-slate-600 mb-4">
            Utilizamos cookies esenciales para el funcionamiento de la plataforma, cookies de análisis para entender cómo usas Buynt, y cookies de preferencias para recordar tu configuración.
        </p>
    </LegalPageLayout>
);

export const HowItWorks: React.FC = () => (
    <LegalPageLayout title="Cómo funciona">
        <div className="space-y-8">
            <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Encuentra lo que necesitas</h2>
                <p className="text-slate-600">
                    Explora nuestra amplia selección de artículos disponibles para alquilar. Usa los filtros para encontrar exactamente lo que buscas en tu zona.
                </p>
            </div>
            <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-3">2. Reserva las fechas</h2>
                <p className="text-slate-600">
                    Selecciona las fechas que necesitas el artículo y envía una solicitud de alquiler al propietario. Podrás chatear directamente para coordinar los detalles.
                </p>
            </div>
            <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-3">3. Recoge y disfruta</h2>
                <p className="text-slate-600">
                    Una vez confirmada la reserva, recoge el artículo en el punto acordado. Disfrútalo durante el período de alquiler y devuélvelo en las mismas condiciones.
                </p>
            </div>
        </div>
    </LegalPageLayout>
);

export const Security: React.FC = () => (
    <LegalPageLayout title="Seguridad">
        <h2 className="text-xl font-semibold text-slate-900 mb-3">Tu seguridad es nuestra prioridad</h2>
        <p className="text-slate-600 mb-6">
            En Buynt trabajamos constantemente para crear un entorno seguro para todos nuestros usuarios.
        </p>
        <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-3">Verificación de usuarios</h2>
        <p className="text-slate-600 mb-4">
            Todos los usuarios pueden verificar su identidad para aumentar la confianza en la comunidad.
        </p>
        <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-3">Pagos protegidos</h2>
        <p className="text-slate-600 mb-4">
            Todas las transacciones están protegidas por sistemas de pago seguros y encriptados.
        </p>
        <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-3">Sistema de valoraciones</h2>
        <p className="text-slate-600 mb-4">
            Las valoraciones y reseñas de otros usuarios te ayudan a tomar decisiones informadas.
        </p>
    </LegalPageLayout>
);

export const HelpCenter: React.FC = () => (
    <LegalPageLayout title="Centro de ayuda">
        <h2 className="text-xl font-semibold text-slate-900 mb-3">Preguntas frecuentes</h2>
        <div className="space-y-6">
            <div>
                <h3 className="font-medium text-slate-900 mb-2">¿Cómo publico un artículo?</h3>
                <p className="text-slate-600">
                    Haz clic en "Subir producto" en la barra de navegación, completa el formulario con los detalles de tu artículo y publica.
                </p>
            </div>
            <div>
                <h3 className="font-medium text-slate-900 mb-2">¿Cómo contacto con un propietario?</h3>
                <p className="text-slate-600">
                    Desde la página del artículo, haz clic en "Contactar" para enviar un mensaje directo al propietario.
                </p>
            </div>
            <div>
                <h3 className="font-medium text-slate-900 mb-2">¿Qué hago si hay un problema con un alquiler?</h3>
                <p className="text-slate-600">
                    Contacta con nuestro equipo de soporte a través del formulario de contacto y te ayudaremos a resolver cualquier incidencia.
                </p>
            </div>
        </div>
    </LegalPageLayout>
);

export const Contact: React.FC = () => (
    <LegalPageLayout title="Contacto">
        <p className="text-slate-600 mb-6">
            ¿Tienes alguna pregunta o sugerencia? Nos encantaría escucharte.
        </p>
        <div className="space-y-4">
            <div>
                <h3 className="font-medium text-slate-900 mb-1">Email</h3>
                <p className="text-primary">soporte@buynt.com</p>
            </div>
            <div>
                <h3 className="font-medium text-slate-900 mb-1">Horario de atención</h3>
                <p className="text-slate-600">Lunes a Viernes: 9:00 - 18:00</p>
            </div>
            <div className="pt-4">
                <p className="text-slate-600">
                    Para consultas urgentes, nuestro equipo de soporte está disponible 24/7 a través del chat de la aplicación.
                </p>
            </div>
        </div>
    </LegalPageLayout>
);
