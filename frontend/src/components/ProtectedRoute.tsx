import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import type { Role } from '../types';

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && (!user || !roles.includes(user.role))) {
    return <Navigate to="/chat" replace />;
  }

  return <Outlet />;
}