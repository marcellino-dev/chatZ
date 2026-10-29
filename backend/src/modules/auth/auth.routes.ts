import { Router } from 'express';
import multer from 'multer';
import * as authController from './auth.controller';
import { authMiddleware, requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/errorHandler';

const router = Router();
const profilePictureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(new AppError('Use uma imagem JPG, PNG ou WEBP', 400));
    }
    return callback(null, true);
  },
}).single('file');

function parseProfilePicture(req: Parameters<typeof profilePictureUpload>[0], res: Parameters<typeof profilePictureUpload>[1], next: Parameters<typeof profilePictureUpload>[2]) {
  profilePictureUpload(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('A imagem deve ter no máximo 5 MB', 413));
    }
    if (error) return next(error);
    return next();
  });
}

// ==========================
// PÚBLICAS
// ==========================
router.post('/login', authController.login);

// ==========================
// AUTENTICADAS
// ==========================
router.get('/me', authMiddleware, authController.me);
router.post(
  '/me/profile-picture',
  authMiddleware,
  parseProfilePicture,
  authController.updateProfilePicture
);
router.delete(
  '/me/profile-picture',
  authMiddleware,
  authController.removeProfilePicture
);

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