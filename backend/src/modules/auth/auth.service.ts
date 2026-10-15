import bcrypt from 'bcryptjs';
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

  const token = signToken({ sub: user.id, role: user.role });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
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