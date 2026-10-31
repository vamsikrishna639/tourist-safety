// Opens a Socket.IO connection that sends our JWT. The backend rejects the connection if the token is invalid.
import { io } from 'socket.io-client';

export function connectSocket() {
  // No URL = same origin (localhost:5173); the Vite proxy forwards /socket.io to the backend on port 5000
  return io({ auth: { token: localStorage.getItem('token') } });
}
