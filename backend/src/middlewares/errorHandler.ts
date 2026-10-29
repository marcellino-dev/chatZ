import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(public message: string, public statusCode = 400) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Erros de validação do Zod
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Dados inválidos',
      issues: err.flatten().fieldErrors,
    });
  }

  // Erros da aplicação (esperados)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  const clientErrorStatus = getClientErrorStatus(err);
  if (clientErrorStatus) {
    return res.status(clientErrorStatus).json({
      error:
        clientErrorStatus === 413
          ? 'Requisição muito grande'
          : 'Requisição inválida',
    });
  }

  // Erro inesperado
  console.error('💥 Erro inesperado:', err);
  return res.status(500).json({ error: 'Erro interno do servidor' });
}

function getClientErrorStatus(err: Error): number | undefined {
  if (!('status' in err)) return undefined;
  const { status } = err;
  return typeof status === 'number' && status >= 400 && status < 500
    ? status
    : undefined;
}