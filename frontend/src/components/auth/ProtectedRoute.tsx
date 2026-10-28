import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useIsAuthenticated } from '@/stores/auth.store';
import { withRedirect } from '@/utils/redirect';

export const ProtectedRoute = () => {
  const isAuthenticated = useIsAuthenticated();
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to={withRedirect('/login', `${location.pathname}${location.search}`)}
        replace
      />
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
