// One Socket.IO connection for the whole app while a user is logged in.
// Components subscribe to events with useSocketEvent('event', handler).
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { connectSocket } from './socket';

const SocketContext = createContext({ socket: null, status: 'offline' });

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState('offline');
  const userId = user?._id;

  // Connect after login, disconnect on logout
  useEffect(() => {
    if (!userId) return;
    const s = connectSocket();
    setStatus('connecting...');
    s.on('connect', () => setStatus('live'));
    s.on('disconnect', () => setStatus('disconnected'));
    s.on('connect_error', (err) => setStatus(`offline: ${err.message}`));
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
      setStatus('offline');
    };
  }, [userId]);

  return <SocketContext.Provider value={{ socket, status }}>{children}</SocketContext.Provider>;
}

export const useSocketStatus = () => useContext(SocketContext).status;

// Calls handler(data) every time the server emits this event
export function useSocketEvent(event, handler) {
  const { socket } = useContext(SocketContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler; // always call the latest handler without re-subscribing

  useEffect(() => {
    if (!socket) return;
    const listener = (data) => handlerRef.current(data);
    socket.on(event, listener);
    return () => socket.off(event, listener);
  }, [socket, event]);
}
