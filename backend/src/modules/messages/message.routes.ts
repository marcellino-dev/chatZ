import { Router } from 'express';
import * as messageController from './message.controller';
import { authMiddleware } from '../../middlewares/auth';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

// GET /tickets/:ticketId/messages
router.get('/', messageController.list);

// POST /tickets/:ticketId/messages
router.post('/', messageController.send);

export default router;