import { Router } from 'express';
import * as ticketController from './ticket.controller';
import { authMiddleware } from '../../middlewares/auth';
import messageRoutes from '../messages/message.routes';

const router = Router();

router.use(authMiddleware);

// Tickets
router.post('/', ticketController.create);
router.get('/', ticketController.list);
router.get('/:id', ticketController.getById);
router.patch('/:id/assign', ticketController.assign);
router.patch('/:id/status', ticketController.updateStatus);
router.patch('/:id/priority', ticketController.updatePriority);

// Mensagens aninhadas em /tickets/:ticketId/messages
router.use('/:ticketId/messages', messageRoutes);

export default router;