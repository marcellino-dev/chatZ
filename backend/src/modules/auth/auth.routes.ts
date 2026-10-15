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

router.get(
  '/users',
  authMiddleware,
  requireRole('ADMIN'),
  authController.listUsers
);

router.patch(
  '/users/:id',
  authMiddleware,
  requireRole('ADMIN'),
  authController.updateUser
);

router.delete(
  '/users/:id',
  authMiddleware,
  requireRole('ADMIN'),
  authController.deleteUser
);

export default router;