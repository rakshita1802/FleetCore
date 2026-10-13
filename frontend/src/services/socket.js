import { io } from 'socket.io-client';

let socket = null;
let currentToken = null;

export const connectSocket = (token) => {
  const authToken = token || localStorage.getItem('accessToken');
  
  if (socket && currentToken === authToken) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = authToken;
  const rawUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
  const serverUrl = rawUrl.replace(/\/api\/?$/, '');

  socket = io(serverUrl, {
    auth: { token: authToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  currentToken = null;
};
