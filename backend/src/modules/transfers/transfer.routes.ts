import { Router } from 'express';
import * as transferController from './transfer.controller';
import { authMiddleware } from '../../middlewares/auth';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

// POST /tickets/:ticketId/transfers
router.post('/', transferController.transfer);

// GET /tickets/:ticketId/transfers
router.get('/', transferController.list);

export default router;