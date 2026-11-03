import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middlewares/auth';
import * as knowledgeBaseController from './knowledgeBase.controller';

const router = Router();

router.use(authMiddleware, requireRole('ADMIN', 'AGENT'));
router.get('/', knowledgeBaseController.list);
router.post('/', requireRole('ADMIN'), knowledgeBaseController.create);
router.patch('/:id', requireRole('ADMIN'), knowledgeBaseController.update);

export default router;
