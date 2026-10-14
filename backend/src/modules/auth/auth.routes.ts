import { Router } from 'express';
import * as authController from './auth.controller';
import { authMiddleware, requireRole } from '../../middlewares/auth';

const router = Router();

// ==========================
// PÚBLICAS
// ==========================
router.post('/login', authController.login);

// ==========================
// AUTENTICADAS
// ==========================
router.get('/me', authMiddleware, authController.me);

// ==========================
// SÓ ADMIN
// ==========================
router.post(
  '/users',
  authMiddleware,
  requireRole('ADMIN'),
  authController.createUser
);

export default router;