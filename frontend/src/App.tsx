import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Chat } from './pages/Chat';
import { Settings } from './pages/Settings';
import { Sectors } from './pages/Sectors';
import { Users } from './pages/Users';
import { Contacts } from './pages/Contacts';
import { QuickReplies } from './pages/QuickReplies';
import { FollowUps } from './pages/FollowUps';
import { History } from './pages/History';
import { Performance } from './pages/Performance';
import { ProtectedRoute } from './components/ProtectedRoute';
import { GlobalNotifications } from './components/GlobalNotifications';
import { useAuthStore } from './stores/auth';
import { setBaseTitle, setupVisibilityListener } from './lib/notifications';
import { prepareAudio } from './lib/sounds';

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrateSocket = useAuthStore((s) => s.hydrateSocket);

  useEffect(() => {
    void hydrateSocket().catch((error: unknown) => {
      console.error('Não foi possível sincronizar a sessão do atendente:', error);
    });
    setBaseTitle('chatZ — Real-time support');
    setupVisibilityListener();

    const handleFirstClick = () => {
      prepareAudio();
      document.removeEventListener('click', handleFirstClick);
    };
    document.addEventListener('click', handleFirstClick);
  }, [hydrateSocket]);

  return (
    <BrowserRouter>
      {isAuthenticated && <GlobalNotifications />}
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/chat" replace /> : <Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:id" element={<Chat />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/quick-replies" element={<QuickReplies />} />
          <Route element={<ProtectedRoute roles={['ADMIN', 'AGENT']} />}>
            <Route path="/follow-ups" element={<FollowUps />} />
          </Route>
          <Route element={<ProtectedRoute roles={['ADMIN', 'AGENT']} />}>
            <Route path="/history" element={<History />} />
          </Route>
          <Route element={<ProtectedRoute roles={['AGENT']} />}>
            <Route path="/performance" element={<Performance />} />
          </Route>
          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="/sectors" element={<Sectors />} />
            <Route path="/users" element={<Users />} />
          </Route>
        </Route>
        <Route path="/" element={<Navigate to={isAuthenticated ? '/chat' : '/login'} replace />} />
        <Route path="*" element={<Navigate to={isAuthenticated ? '/chat' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}