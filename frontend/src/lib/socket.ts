import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  // Se já tem socket ativo, desconecta antes de reconectar
  if (socket) {
    socket.disconnect();
  }

  socket = io('http://localhost:3000', {
    auth: { token },
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('🔌 Socket conectado');
  });

  socket.on('disconnect', () => {
    console.log('🔌 Socket desconectado');
  });

  socket.on('connect_error', (err) => {
    console.error('🔌 Erro de conexão:', err.message);
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