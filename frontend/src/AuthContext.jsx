// Keeps the logged-in user in one place so every page can read it with useAuth().
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

// Where each role lands after login
export const homeFor = (user) => (user.role === 'admin' ? '/admin' : '/tourist');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On page load/refresh: if a token is saved, ask the backend who it belongs to
  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setLoading(false);
      return;
    }
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => localStorage.removeItem('token')) // expired or invalid token
      .finally(() => setLoading(false));
  }, []);

  // Called after a successful login or register
  function saveSession({ token, user }) {
    localStorage.setItem('token', token);
    setUser(user);
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, saveSession, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
