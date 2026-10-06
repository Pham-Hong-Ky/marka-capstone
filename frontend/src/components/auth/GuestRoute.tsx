import { Navigate, Outlet } from 'react-router-dom';
import { useIsAuthenticated } from '@/stores/auth.store';

export const GuestRoute = () => {
  const isAuthenticated = useIsAuthenticated();

  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />;
};

export default GuestRoute;
