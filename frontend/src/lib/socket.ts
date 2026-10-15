import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket) {
    socket.disconnect();
  }

  // Em produção: variável de ambiente
  // Em dev: localhost:3000
  const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

  socket = io(socketUrl, {
    auth: { token },
    transports: ['websocket'],
  });

  // ... resto igual
}