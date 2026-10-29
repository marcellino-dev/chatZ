import { Router } from 'express';
import multer from 'multer';
import * as uploadController from './upload.controller';
import { authMiddleware } from '../../middlewares/auth';

const router = Router();

// Multer em memória — sem limite de tamanho
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB só pra segurança
  },
});

// POST /uploads
router.post(
  '/',
  authMiddleware,
  upload.single('file'),
  uploadController.upload
);

export default router;