import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Home } from './pages/Home';
import { ItemDetail } from './pages/ItemDetail';
import { Publish } from './pages/Publish';
import { MyItems } from './pages/MyItems';
import { MyRequests } from './pages/MyRequests';
import { Inbox } from './pages/Inbox';
import { Chat } from './pages/Chat';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Profile } from './pages/Profile';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" reverseOrder={false} />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            {/* Public Routes - ONLY Login/Register */}
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />

            {/* Protected Routes - EVERYTHING ELSE */}
            <Route index element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="item/:id" element={<ProtectedRoute><ItemDetail /></ProtectedRoute>} />
            <Route path="publish" element={<ProtectedRoute><Publish /></ProtectedRoute>} />
            <Route path="my-items" element={<ProtectedRoute><MyItems /></ProtectedRoute>} />
            <Route path="my-requests" element={<ProtectedRoute><MyRequests /></ProtectedRoute>} />
            <Route path="inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
            <Route path="chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
