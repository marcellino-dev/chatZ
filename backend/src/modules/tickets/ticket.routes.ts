import { Router } from 'express';
import * as ticketController from './ticket.controller';
import { authMiddleware } from '../../middlewares/auth';
import messageRoutes from '../messages/message.routes';
import transferRoutes from '../transfers/transfer.routes';

const router = Router();

router.use(authMiddleware);

// Tickets
router.post('/', ticketController.create);
router.get('/', ticketController.list);
router.get('/:id', ticketController.getById);
router.patch('/:id/assign', ticketController.assign);
router.patch('/:id/status', ticketController.updateStatus);
router.patch('/:id/priority', ticketController.updatePriority);

// Participantes
router.get('/:id/participants', ticketController.listParticipants);
router.post('/:id/participants', ticketController.addParticipant);
router.delete('/:id/participants/:userId', ticketController.removeParticipant);

// Aninhados
router.use('/:ticketId/messages', messageRoutes);
router.use('/:ticketId/transfers', transferRoutes);

export default router;