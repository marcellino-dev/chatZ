import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { authMiddleware, requireRole } from '../../middlewares/auth';

const router = Router();

router.use(authMiddleware, requireRole('ADMIN', 'AGENT'));
router.get('/', async (_req, res, next) => {
  try {
    return res.json(
      await prisma.tag.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
    );
  } catch (error) {
    return next(error);
  }
});

export default router;
