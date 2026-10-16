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
      origin: [
        'http://localhost:5173',
        'https://chat-z-two.vercel.app',
        /\.vercel\.app$/,
      ],
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

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, role: true, sectorId: true, active: true },
      });

      if (!user || !user.active) {
        return next(new Error('Usuário inativo ou não encontrado'));
      }

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

    // ==========================
    // ENTRAR NA SALA DE UM TICKET (chat)
    // ==========================
    socket.on('ticket:join', (ticketId: string) => {
      socket.join(`ticket:${ticketId}`);
      console.log(`   └─ ${user.name} entrou na sala ticket:${ticketId}`);

      // Confirma pro cliente que entrou
      socket.emit('ticket:joined', { ticketId });
    });

    socket.on('ticket:leave', (ticketId: string) => {
      socket.leave(`ticket:${ticketId}`);
      console.log(`   └─ ${user.name} saiu da sala ticket:${ticketId}`);
    });

    // ==========================
    // DESCONEXÃO
    // ==========================
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
  console.log(`📡 emitToSector → sector:${sectorId} → ${event}`);
}

// Emitir pra um usuário específico
export function emitToUser(userId: string, event: string, data: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
  console.log(`📡 emitToUser → user:${userId} → ${event}`);
}

// Emitir pra um ticket (chat)
export function emitToTicket(ticketId: string, event: string, data: any) {
  if (!io) {
    console.warn('⚠️ Socket.IO não inicializado — emit ignorado');
    return;
  }

  const room = `ticket:${ticketId}`;
  const socketsInRoom = io.sockets.adapter.rooms.get(room);

  console.log(
    `📡 emitToTicket → ${room} → ${event} (${socketsInRoom?.size ?? 0} clientes na sala)`
  );

  io.to(room).emit(event, data);
}