import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth, homeFor } from '../AuthContext';

export default function Login() {
  const { user, saveSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />; // already logged in

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api('/auth/login', { method: 'POST', body: { email, password } });
      saveSession(data);
      navigate(homeFor(data.user));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card narrow">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="error">{error}</p>}
        <button disabled={busy}>{busy ? 'Logging in...' : 'Login'}</button>
      </form>
      <p>New tourist? <Link to="/register">Register here</Link></p>
      <p className="hint">Demo: admin@demo.com / Admin@123, tourist1@demo.com / Tourist@123</p>
    </div>
  );
}
