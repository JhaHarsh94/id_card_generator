import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import '../styles/auth.css';

/**
 * ProtectedRoute
 * ---------------------------------------------------------------------------
 * Gates every admin route. While the session is still being resolved it shows
 * a neutral loading screen rather than redirecting - otherwise a page refresh
 * on a slow connection would bounce a signed-in admin to the login page.
 *
 * The attempted path is remembered so login can return them to it.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="auth-boot">
        <span className="spinner spinner-lg" style={{ color: 'var(--brand-blue)' }} />
        <p className="text-muted text-sm">Checking your session…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return children;
}
