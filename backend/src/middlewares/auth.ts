import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { prisma } from '../config/prisma';

export interface AuthUser {
  id: string;
  role: string;
  sectorId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Formato de token inválido' });
  }

  try {
    const payload = verifyToken(token);

    // Busca dados atuais do usuário (sectorId pode ter mudado)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, sectorId: true, active: true },
    });

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuário inativo ou não encontrado' });
    }

    req.user = {
      id: user.id,
      role: user.role,
      sectorId: user.sectorId,
    };

    return next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    return next();
  };
}