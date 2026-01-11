import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { HomeLanding } from './pages/HomeLanding';
import { Explore } from './pages/Explore';
import { ItemDetail } from './pages/ItemDetail';
import { Publish } from './pages/Publish';
import { EditItem } from './pages/EditItem';
import { MyItems } from './pages/MyItems';
import { MyRequests } from './pages/MyRequests';
import { Inbox } from './pages/Inbox';
import { Chat } from './pages/Chat';
import { Messages } from './pages/Messages';
import { MessageDetail } from './pages/MessageDetail';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Profile } from './pages/Profile';
import { AuthProvider } from './context/AuthContext';
import { 
  PrivacyPolicy, 
  TermsOfUse, 
  CookiesPolicy, 
  HowItWorks, 
  Security, 
  HelpCenter, 
  Contact 
} from './pages/LegalPages';

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" reverseOrder={false} />
      <BrowserRouter>
        <Routes>
          {/* Landing - HOME */}
          <Route path="/" element={<HomeLanding />} />

          {/* Routes with Layout (Header) */}
          <Route element={<Layout />}>
            {/* Public Routes */}
            <Route path="explorar" element={<Explore />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="item/:id" element={<ItemDetail />} />

            {/* Protected Routes */}
            <Route path="publish" element={<ProtectedRoute><Publish /></ProtectedRoute>} />
            <Route path="item/:id/editar" element={<ProtectedRoute><EditItem /></ProtectedRoute>} />
            <Route path="my-items" element={<ProtectedRoute><MyItems /></ProtectedRoute>} />
            <Route path="my-requests" element={<ProtectedRoute><MyRequests /></ProtectedRoute>} />
            <Route path="inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
            <Route path="chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
            <Route path="messages/:conversationId" element={<ProtectedRoute><MessageDetail /></ProtectedRoute>} />
            <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          </Route>

          {/* Legal / Info Pages */}
          <Route path="/legal/privacidad" element={<PrivacyPolicy />} />
          <Route path="/legal/terminos" element={<TermsOfUse />} />
          <Route path="/legal/cookies" element={<CookiesPolicy />} />
          <Route path="/como-funciona" element={<HowItWorks />} />
          <Route path="/seguridad" element={<Security />} />
          <Route path="/ayuda" element={<HelpCenter />} />
          <Route path="/contacto" element={<Contact />} />

          {/* Legacy redirects */}
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/feed" element={<Navigate to="/explorar" replace />} />
          <Route path="/landing" element={<Navigate to="/" replace />} />

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
