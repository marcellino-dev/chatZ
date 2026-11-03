import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middlewares/auth';
import * as performanceController from './performance.controller';

const router = Router();

router.get('/mine', authMiddleware, requireRole('AGENT'), performanceController.mine);

export default router;
