import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { prisma } from '../config/prisma';
import { hasTicketAccess } from '../modules/tickets/ticket.access';
import { canViewTicket } from '../modules/tickets/ticket.permissions';

let io: Server | null = null;

// ==========================
// INICIALIZAR
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

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Token não fornecido'));

      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, role: true, sectorId: true, active: true },
      });

      if (!user || !user.active) return next(new Error('Usuário inativo'));

      socket.data.user = user;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as {
      id: string;
      name: string;
      role: string;
      sectorId: string | null;
    };

    console.log(`🔌 Conectado: ${user.name} (${user.role})`);

    socket.join(`user:${user.id}`);

    if (user.role === 'AGENT' && user.sectorId) {
      socket.join(`sector:${user.sectorId}`);
      console.log(`   └─ Entrou na sala sector:${user.sectorId}`);
    }

    if (user.role === 'ADMIN') {
      prisma.sector
        .findMany({ where: { active: true }, select: { id: true } })
        .then((sectors) => {
          sectors.forEach((s) => socket.join(`sector:${s.id}`));
          console.log(`   └─ Admin entrou em ${sectors.length} salas de setor`);
        });
    }

    // Ticket rooms
    socket.on('ticket:join', async (ticketId: unknown) => {
      if (typeof ticketId !== 'string' || !ticketId.trim()) return;
      try {
        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket || !(await hasTicketAccess(user, ticket))) {
          socket.emit('ticket:join-error', { ticketId });
          return;
        }

        socket.join(`ticket:${ticketId}`);
        console.log(`   └─ ${user.name} entrou na sala ticket:${ticketId}`);
        socket.emit('ticket:joined', { ticketId });
      } catch (error) {
        console.error(`Erro ao validar acesso à sala ticket:${ticketId}`, error);
        socket.emit('ticket:join-error', { ticketId });
      }
    });

    socket.on('ticket:leave', (ticketId: string) => {
      socket.leave(`ticket:${ticketId}`);
      console.log(`   └─ ${user.name} saiu da sala ticket:${ticketId}`);
    });

    // ==========================
    // TYPING INDICATOR
    // ==========================
    const updateTyping = async (data: unknown, typing: boolean) => {
      if (
        !data ||
        typeof data !== 'object' ||
        !('ticketId' in data) ||
        typeof data.ticketId !== 'string' ||
        !data.ticketId.trim()
      ) {
        return;
      }

      const ticketId = data.ticketId;
      const room = `ticket:${ticketId}`;
      if (!socket.rooms.has(room)) return;

      try {
        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket || !(await hasTicketAccess(user, ticket))) {
          socket.leave(room);
          socket.emit('ticket:access-revoked', { ticketId });
          return;
        }

        socket.to(room).emit('typing:update', {
          ticketId,
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          typing,
        });
      } catch (error) {
        console.error(`Erro ao validar acesso de digitação ao ticket:${ticketId}`, error);
      }
    };

    socket.on('typing:start', (data: unknown) => {
      void updateTyping(data, true);
    });

    socket.on('typing:stop', (data: unknown) => {
      void updateTyping(data, false);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Desconectado: ${user.name}`);
    });
  });

  console.log('🔌 Socket.IO inicializado');
  return io;
}

// ==========================
// HELPERS
// ==========================
export function getIO(): Server {
  if (!io) throw new Error('Socket.IO não inicializado');
  return io;
}

export function emitToSector(
  sectorId: string,
  event: string,
  data: { id: string } | { ticket: { id: string }; fromSectorId: string }
) {
  if (!io) return;
  io.to(`sector:${sectorId}`).emit(event, data);
  console.log(`📡 emitToSector → sector:${sectorId} → ${event}`);
}

export function emitToUser(userId: string, event: string, data: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
  console.log(`📡 emitToUser → user:${userId} → ${event}`);
}

export function emitToTicket(ticketId: string, event: string, data: any) {
  if (!io) {
    console.warn('⚠️ Socket.IO não inicializado');
    return;
  }
  const room = `ticket:${ticketId}`;
  const sockets = io.sockets.adapter.rooms.get(room);
  console.log(
    `📡 emitToTicket → ${room} → ${event} (${sockets?.size ?? 0} clientes)`
  );
  io.to(room).emit(event, data);
}

export async function emitToTicketStaff(
  ticketId: string,
  event: string,
  data: unknown
) {
  if (!io) return;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      agentId: true,
      requestedAgentId: true,
      sectorId: true,
      status: true,
      participants: { select: { userId: true } },
    },
  });
  if (!ticket) return;

  const recipientIds = new Set(
    ticket.participants.map(({ userId }) => userId)
  );
  if (ticket.agentId) recipientIds.add(ticket.agentId);

  if (!ticket.agentId && ticket.status === 'WAITING') {
    if (ticket.requestedAgentId) {
      recipientIds.add(ticket.requestedAgentId);
    } else {
      const agents = await prisma.user.findMany({
        where: {
          role: 'AGENT',
          active: true,
          sectorId: ticket.sectorId,
        },
        select: { id: true },
      });
      agents.forEach(({ id }) => recipientIds.add(id));
    }
  }

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', active: true },
    select: { id: true },
  });
  admins.forEach(({ id }) => recipientIds.add(id));

  recipientIds.forEach((userId) => {
    io?.to(`user:${userId}`).emit(event, data);
  });
}

export async function removeUnauthorizedTicketRoomMembers(ticketId: string) {
  if (!io) return;

  const room = `ticket:${ticketId}`;
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    await io.in(room).socketsLeave(room);
    return;
  }

  const participants = await prisma.ticketParticipant.findMany({
    where: { ticketId },
    select: { userId: true },
  });
  const participantIds = new Set(participants.map(({ userId }) => userId));
  const sockets = await io.in(room).fetchSockets();

  for (const socket of sockets) {
    const roomUser = socket.data.user as {
      id: string;
      role: string;
      sectorId: string | null;
    };
    if (!canViewTicket(roomUser, ticket) && !participantIds.has(roomUser.id)) {
      await socket.leave(room);
      socket.emit('ticket:access-revoked', { ticketId });
    }
  }
}