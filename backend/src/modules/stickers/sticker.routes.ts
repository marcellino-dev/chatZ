import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, requireRole } from '../../middlewares/auth';
import { AppError } from '../../middlewares/errorHandler';
import * as stickerController from './sticker.controller';

const router = Router();
const stickerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(new AppError('Use uma imagem JPG, PNG ou WEBP', 400));
    }
    return callback(null, true);
  },
});

function parseStickerUpload(
  req: Parameters<ReturnType<typeof stickerUpload.single>>[0],
  res: Parameters<ReturnType<typeof stickerUpload.single>>[1],
  next: Parameters<ReturnType<typeof stickerUpload.single>>[2]
) {
  stickerUpload.single('file')(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('A figurinha deve ter no máximo 5 MB', 413));
    }
    if (error) return next(error);
    return next();
  });
}

router.use(authMiddleware, requireRole('ADMIN', 'AGENT'));
router.get('/', stickerController.list);
router.post('/from-message', stickerController.saveIncoming);
router.post('/', parseStickerUpload, stickerController.create);
router.delete('/:id', stickerController.remove);

export default router;
