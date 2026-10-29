import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middlewares/auth';
import * as quickReplyController from './quickReply.controller';

const router = Router();

router.use(authMiddleware, requireRole('ADMIN', 'AGENT'));
router.get('/', quickReplyController.list);
router.post('/', quickReplyController.create);
router.patch('/:id', quickReplyController.update);
router.delete('/:id', quickReplyController.remove);

export default router;
