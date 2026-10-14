import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { registerSchema, loginSchema } from './auth.schemas';

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

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

export async function me(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await authService.me(req.user!.sub);
    return res.json(user);
  } catch (err) {
    return next(err);
  }
}