import { BrowserRouter, Routes, Route, Navigate, Link, NavLink } from 'react-router-dom';
import { AuthProvider, useAuth, homeFor } from './AuthContext';
import { SocketProvider, useSocketStatus } from './SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import AlertToasts from './components/AlertToasts';
import Login from './pages/Login';
import Register from './pages/Register';
import TouristHome from './pages/TouristHome';
import AdminHome from './pages/AdminHome';
import ZoneManager from './pages/ZoneManager';
import IncidentsPage from './pages/IncidentsPage';
import VerifyPage from './pages/VerifyPage';

function NavBar() {
  const { user, logout } = useAuth();
  const socketStatus = useSocketStatus();

  return (
    <header className="navbar">
      <Link to="/" className="brand">Tourist Safety</Link>
      {user?.role === 'admin' && (
        <nav className="nav-links">
          <NavLink to="/admin" end>Live Map</NavLink>
          <NavLink to="/admin/incidents">Incidents</NavLink>
          <NavLink to="/admin/zones">Zones</NavLink>
          <NavLink to="/admin/verify">Verify ID</NavLink>
        </nav>
      )}
      {user && (
        <div className="nav-right">
          <span className={`badge ${socketStatus === 'live' ? 'badge-ok' : 'badge-off'}`} title="Socket.IO connection">
            {socketStatus}
          </span>
          <span>
            {user.name} <span className={`role role-${user.role}`}>{user.role}</span>
          </span>
          <button className="btn-secondary" onClick={logout}>Logout</button>
        </div>
      )}
    </header>
  );
}

// "/" and unknown URLs: send the user to their home page or to login
function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <p className="center">Loading...</p>;
  return <Navigate to={user ? homeFor(user) : '/login'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <NavBar />
          <AlertToasts />
          <main>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/tourist" element={<ProtectedRoute role="tourist"><TouristHome /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute role="admin"><AdminHome /></ProtectedRoute>} />
              <Route path="/admin/incidents" element={<ProtectedRoute role="admin"><IncidentsPage /></ProtectedRoute>} />
              <Route path="/admin/zones" element={<ProtectedRoute role="admin"><ZoneManager /></ProtectedRoute>} />
              <Route path="/admin/verify" element={<ProtectedRoute role="admin"><VerifyPage /></ProtectedRoute>} />
              <Route path="*" element={<HomeRedirect />} />
            </Routes>
          </main>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
