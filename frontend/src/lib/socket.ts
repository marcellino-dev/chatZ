import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket) {
    socket.disconnect();
  }

  const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

  socket = io(socketUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket conectado');
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket desconectado:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('🔌 Erro de conexão:', err.message);
  });

  socket.on('reconnect', (attempt) => {
    console.log(`🔌 Reconectado após ${attempt} tentativas`);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}