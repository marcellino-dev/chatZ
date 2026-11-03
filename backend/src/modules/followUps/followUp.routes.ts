import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middlewares/auth';
import * as followUpController from './followUp.controller';

const router = Router();

router.use(authMiddleware, requireRole('ADMIN', 'AGENT'));
router.get('/mine/overdue-count', followUpController.overdueCount);
router.get('/mine', followUpController.list);
router.post('/', followUpController.create);
router.patch('/:id', followUpController.update);
router.post('/:id/complete', followUpController.complete);
router.post('/:id/cancel', followUpController.cancel);

export default router;
