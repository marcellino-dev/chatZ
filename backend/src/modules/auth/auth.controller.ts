import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { loginSchema, createUserSchema } from './auth.schemas';

// ==========================
// LOGIN
// ==========================
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

// ==========================
// ME
// ==========================
export async function me(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await authService.me(req.user!.id);
    return res.json(user);
  } catch (err) {
    return next(err);
  }
}

// ==========================
// CRIAR USUÁRIO (só ADMIN)
// ==========================
export async function createUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = createUserSchema.parse(req.body);
    const user = await authService.createUser(data);
    return res.status(201).json(user);
  } catch (err) {
    return next(err);
  }
}