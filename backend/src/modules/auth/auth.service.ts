import bcrypt from 'bcryptjs';
import type { AgentStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { signToken } from '../../utils/jwt';
import { LoginInput, CreateUserInput } from './auth.schemas';

// ==========================
// LOGIN (admin/agent)
// ==========================
export async function login(data: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
    include: {
      sector: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  // Cliente não tem email/password — bloqueia login
  if (!user || !user.password || !user.active) {
    throw new AppError('Credenciais inválidas', 401);
  }

  const passwordMatch = await bcrypt.compare(data.password, user.password);

  if (!passwordMatch) {
    throw new AppError('Credenciais inválidas', 401);
  }

  let status = user.status;
  let statusChangedAt = user.statusChangedAt;
  if (user.role === 'AGENT' && status === 'OFFLINE') {
    const now = new Date();
    const activated = await prisma.user.updateMany({
      where: { id: user.id, status: 'OFFLINE' },
      data: { status: 'ONLINE', statusChangedAt: now },
    });

    if (activated.count > 0) {
      status = 'ONLINE';
      statusChangedAt = now;
    } else {
      const currentStatus = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { status: true, statusChangedAt: true },
      });
      status = currentStatus.status;
      statusChangedAt = currentStatus.statusChangedAt;
    }
  }

  const token = signToken({ sub: user.id, role: user.role });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      sectorId: user.sectorId,
      profilePictureUrl: user.profilePictureUrl,
      status,
      statusChangedAt,
      soundEnabled: user.soundEnabled,
      desktopNotifications: user.desktopNotifications,
      notificationSound: user.notificationSound,
      sector: user.sector,
    },
  };
}

// ==========================
// ME (usuário logado)
// ==========================
export async function me(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      active: true,
      sectorId: true,
      profilePictureUrl: true,
      status: true,
      statusChangedAt: true,
      soundEnabled: true,
      desktopNotifications: true,
      notificationSound: true,
      sector: {
        select: { id: true, name: true, slug: true },
      },
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError('Usuário não encontrado', 404);
  }

  return user;
}

export async function updateStatus(userId: string, status: AgentStatus) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });

  if (!user) {
    throw new AppError('Usuário não encontrado', 404);
  }

  if (user.status === status) {
    return prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { status: true, statusChangedAt: true },
    });
  }

  return prisma.user.update({
    where: { id: userId },
    data: { status, statusChangedAt: new Date() },
    select: { status: true, statusChangedAt: true },
  });
}

export async function updateProfilePicture(userId: string, url: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { profilePictureUrl: url },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      active: true,
      sectorId: true,
      profilePictureUrl: true,
      status: true,
      statusChangedAt: true,
      soundEnabled: true,
      desktopNotifications: true,
      notificationSound: true,
      sector: { select: { id: true, name: true, slug: true } },
      createdAt: true,
    },
  });

  return user;
}

export async function removeProfilePicture(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { profilePictureUrl: null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      active: true,
      sectorId: true,
      profilePictureUrl: true,
      status: true,
      statusChangedAt: true,
      soundEnabled: true,
      desktopNotifications: true,
      notificationSound: true,
      sector: { select: { id: true, name: true, slug: true } },
      createdAt: true,
    },
  });
}

// ==========================
// CRIAR USUÁRIO (só ADMIN)
// ==========================
export async function createUser(data: CreateUserInput) {
  // Email único
  const existingEmail = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingEmail) {
    throw new AppError('Email já cadastrado', 409);
  }

  // Se for AGENT, valida se o setor existe
  if (data.role === 'AGENT' && data.sectorId) {
    const sector = await prisma.sector.findUnique({
      where: { id: data.sectorId },
    });

    if (!sector) {
      throw new AppError('Setor não encontrado', 404);
    }
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: data.role,
      sectorId: data.role === 'AGENT' ? data.sectorId : null,
      statusChangedAt: new Date(),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      sectorId: true,
      sector: {
        select: { id: true, name: true, slug: true },
      },
      active: true,
      createdAt: true,
    },
  });

  return user;
}
// ==========================
// LISTAR USUÁRIOS (só ADMIN)
// ==========================
export async function listUsers() {
  const users = await prisma.user.findMany({
    where: { role: 'AGENT' },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      active: true,
      sectorId: true,
      sector: {
        select: { id: true, name: true, slug: true },
      },
      createdAt: true,
    },
  });

  return users;
}

// ==========================
// ATUALIZAR USUÁRIO (só ADMIN)
// ==========================
export async function updateUser(
  id: string,
  data: {
    name?: string;
    email?: string;
    password?: string;
    role?: 'ADMIN' | 'AGENT';
    sectorId?: string | null;
    active?: boolean;
  }
) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError('Usuário não encontrado', 404);

  const updateData: any = { ...data };

  // Se tem senha, hasheia
  if (data.password) {
    updateData.password = await bcrypt.hash(data.password, 10);
  }

  // Se mudou role pra ADMIN, limpa sectorId
  if (data.role === 'ADMIN') {
    updateData.sectorId = null;
  }

  // Se mudou sectorId, valida se existe
  if (data.sectorId) {
    const sector = await prisma.sector.findUnique({
      where: { id: data.sectorId },
    });
    if (!sector) throw new AppError('Setor não encontrado', 404);
  }

  // Se mudou email, valida duplicidade
  if (data.email && data.email !== user.email) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) throw new AppError('Email já cadastrado', 409);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      active: true,
      sectorId: true,
      sector: {
        select: { id: true, name: true, slug: true },
      },
      createdAt: true,
    },
  });

  return updated;
}

// ==========================
// DELETAR USUÁRIO (soft delete, só ADMIN)
// ==========================
export async function deleteUser(id: string, currentUserId: string) {
  if (id === currentUserId) {
    throw new AppError('Você não pode desativar a si mesmo', 400);
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError('Usuário não encontrado', 404);

  const updated = await prisma.user.update({
    where: { id },
    data: { active: false },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      sectorId: true,
    },
  });

  return updated;
}