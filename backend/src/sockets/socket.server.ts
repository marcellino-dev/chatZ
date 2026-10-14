import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { prisma } from '../config/prisma';

let io: Server | null = null;

// ==========================
// INICIALIZAR SOCKET.IO
// ==========================
export function initSocketServer(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: 'http://localhost:5173', // frontend
      credentials: true,
    },
  });

  // ==========================
  // AUTENTICAÇÃO NO HANDSHAKE
  // ==========================
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error('Token não fornecido'));
      }

      const payload = verifyToken(token);

      // Busca user no banco (pra ter sectorId atualizado)
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, role: true, sectorId: true, active: true },
      });

      if (!user || !user.active) {
        return next(new Error('Usuário inativo ou não encontrado'));
      }

      // Guarda o user no socket
      socket.data.user = user;

      next();
    } catch {
      next(new Error('Token inválido ou expirado'));
    }
  });

  // ==========================
  // CONEXÃO
  // ==========================
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as {
      id: string;
      name: string;
      role: string;
      sectorId: string | null;
    };

    console.log(`🔌 Conectado: ${user.name} (${user.role})`);

    // Sala pessoal (notificações específicas)
    socket.join(`user:${user.id}`);

    // Sala do setor (só pra AGENT)
    if (user.role === 'AGENT' && user.sectorId) {
      socket.join(`sector:${user.sectorId}`);
      console.log(`   └─ Entrou na sala sector:${user.sectorId}`);
    }

    // ADMIN entra em todas as salas de setor
    if (user.role === 'ADMIN') {
      prisma.sector
        .findMany({ where: { active: true }, select: { id: true } })
        .then((sectors) => {
          sectors.forEach((s) => socket.join(`sector:${s.id}`));
          console.log(`   └─ Admin entrou em ${sectors.length} salas de setor`);
        });
    }

    // Entrar na sala de um ticket específico (pra chat futuro)
    socket.on('ticket:join', (ticketId: string) => {
      socket.join(`ticket:${ticketId}`);
    });

    socket.on('ticket:leave', (ticketId: string) => {
      socket.leave(`ticket:${ticketId}`);
    });

    // Desconexão
    socket.on('disconnect', () => {
      console.log(`🔌 Desconectado: ${user.name}`);
    });
  });

  console.log('🔌 Socket.IO inicializado');
  return io;
}

// ==========================
// HELPERS DE EMISSÃO
// ==========================
export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO não foi inicializado');
  }
  return io;
}

// Emitir pra sala de um setor
export function emitToSector(sectorId: string, event: string, data: any) {
  if (!io) return;
  io.to(`sector:${sectorId}`).emit(event, data);
}

// Emitir pra um usuário específico
export function emitToUser(userId: string, event: string, data: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

// Emitir pra um ticket (chat)
export function emitToTicket(ticketId: string, event: string, data: any) {
  if (!io) return;
  io.to(`ticket:${ticketId}`).emit(event, data);
}