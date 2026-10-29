import type { Request } from 'express';
import { AppError } from '../middlewares/errorHandler';

export function getRouteParam(req: Request, name: string): string {
  const value = req.params[name];

  if (typeof value !== 'string') {
    throw new AppError(`Parâmetro inválido: ${name}`);
  }

  return value;
}
