import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Chat } from './pages/Chat';
import { Sectors } from './pages/Sectors';
import { Users } from './pages/Users';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuthStore } from './stores/auth';

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrateSocket = useAuthStore((s) => s.hydrateSocket);

  useEffect(() => {
    hydrateSocket();
  }, [hydrateSocket]);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/chat" replace /> : <Login />}
        />

        <Route element={<ProtectedRoute />}>
          {/* Chat (tela cheia, sem Layout) */}
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:id" element={<Chat />} />

          {/* Admin pages com layout simples */}
          <Route path="/sectors" element={<Sectors />} />
          <Route path="/users" element={<Users />} />
        </Route>

        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? '/chat' : '/login'} replace />}
        />
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? '/chat' : '/login'} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}