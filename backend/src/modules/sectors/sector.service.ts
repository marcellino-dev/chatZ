import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { CreateSectorInput, UpdateSectorInput } from './sector.schemas';

// ==========================
// LISTAR SETORES
// ==========================
export async function listSectors(options: { onlyActive?: boolean } = {}) {
  const sectors = await prisma.sector.findMany({
    where: options.onlyActive ? { active: true } : {},
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          users: true,     // atendentes do setor
          tickets: true,   // tickets do setor
        },
      },
    },
  });

  return sectors;
}

// ==========================
// BUSCAR POR ID
// ==========================
export async function getSectorById(id: string) {
  const sector = await prisma.sector.findUnique({
    where: { id },
    include: {
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
        },
      },
      _count: {
        select: { tickets: true },
      },
    },
  });

  if (!sector) {
    throw new AppError('Setor não encontrado', 404);
  }

  return sector;
}

// ==========================
// CRIAR SETOR
// ==========================
export async function createSector(data: CreateSectorInput) {
  const existingSlug = await prisma.sector.findUnique({
    where: { slug: data.slug },
  });

  if (existingSlug) {
    throw new AppError('Já existe um setor com esse slug', 409);
  }

  const sector = await prisma.sector.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description,
    },
  });

  return sector;
}

// ==========================
// ATUALIZAR SETOR
// ==========================
export async function updateSector(id: string, data: UpdateSectorInput) {
  const sector = await prisma.sector.findUnique({ where: { id } });

  if (!sector) {
    throw new AppError('Setor não encontrado', 404);
  }

  const updated = await prisma.sector.update({
    where: { id },
    data,
  });

  return updated;
}

// ==========================
// DELETAR SETOR (soft delete)
// ==========================
export async function deleteSector(id: string) {
  const sector = await prisma.sector.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true, tickets: true } },
    },
  });

  if (!sector) {
    throw new AppError('Setor não encontrado', 404);
  }

  // Impede deletar se tiver atendentes ou tickets ativos
  if (sector._count.users > 0) {
    throw new AppError(
      'Não é possível deletar: setor tem atendentes vinculados',
      409
    );
  }

  // Soft delete: só desativa
  const updated = await prisma.sector.update({
    where: { id },
    data: { active: false },
  });

  return updated;
}