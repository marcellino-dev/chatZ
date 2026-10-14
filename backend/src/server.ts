import http from 'http';
import app from './app';
import { initSocketServer } from './sockets/socket.server';
import { env } from './config/env';

const server = http.createServer(app);

// Inicializa Socket.IO
initSocketServer(server);

server.listen(env.PORT, () => {
  console.log(`
  ╔══════════════════════════════╗
  ║        🚀  chatZ  🚀         ║
  ╠══════════════════════════════╣
  ║  Servidor: http://localhost:${env.PORT}  ║
  ║  Socket.IO: ativo 🔌         ║
  ╚══════════════════════════════╝
  `);
});