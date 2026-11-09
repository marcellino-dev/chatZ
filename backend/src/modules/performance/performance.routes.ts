import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middlewares/auth';
import * as performanceController from './performance.controller';

const router = Router();

router.get('/mine', authMiddleware, requireRole('AGENT'), performanceController.mine);
router.get('/mine/summary', authMiddleware, requireRole('AGENT'), performanceController.summary);
router.get('/mine/daily', authMiddleware, requireRole('AGENT'), performanceController.daily);
router.get('/mine/recent', authMiddleware, requireRole('AGENT'), performanceController.recent);

export default router;
