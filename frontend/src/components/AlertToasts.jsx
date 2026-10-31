// Pop-up notifications in the top-right corner for every "alert" pushed by the server.
// Admins receive every alert; a tourist receives only alerts about themselves.
import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useSocketEvent } from '../SocketContext';

const SHOW_FOR_MS = { critical: 20000, high: 8000, medium: 8000, info: 6000 }; // SOS stays longest

export default function AlertToasts() {
  const { user } = useAuth();
  const [toasts, setToasts] = useState([]);

  const dismiss = (id) => setToasts((list) => list.filter((t) => t.id !== id));

  useSocketEvent('alert', (alert) => {
    setToasts((list) => [alert, ...list].slice(0, 4)); // at most 4 on screen
    setTimeout(() => dismiss(alert.id), SHOW_FOR_MS[alert.severity] || 8000);
  });

  if (!user) return null;
  return (
    <div className="toasts">
      {toasts.map((a) => (
        <div key={a.id} className={`toast toast-${a.severity}`} onClick={() => dismiss(a.id)}>
          <b>{a.title}</b>
          <div>{user.role === 'tourist' ? a.touristMessage : a.message}</div>
        </div>
      ))}
    </div>
  );
}
