import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Home } from './pages/Home';
import { ItemDetail } from './pages/ItemDetail';
import { Publish } from './pages/Publish';
import { MyItems } from './pages/MyItems';
import { MyRequests } from './pages/MyRequests';
import { Inbox } from './pages/Inbox';
import { Chat } from './pages/Chat';
import { Login } from './pages/Login';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="item/:id" element={<ItemDetail />} />
            <Route path="publish" element={<Publish />} />
            <Route path="my-items" element={<MyItems />} />
            <Route path="my-requests" element={<MyRequests />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="chat" element={<Chat />} />
            <Route path="login" element={<Login />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
