// Wraps a page so only logged-in users with the right role can open it.
import { Navigate } from 'react-router-dom';
import { useAuth, homeFor } from '../AuthContext';

export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) return <p className="center">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />; // wrong role -> own home

  return children;
}
