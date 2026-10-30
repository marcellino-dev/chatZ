import { Router } from 'express';
import * as ticketController from './ticket.controller';
import { authMiddleware, requireRole } from '../../middlewares/auth';
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
router.get('/:id/notes', requireRole('ADMIN', 'AGENT'), ticketController.listNotes);
router.post('/:id/notes', requireRole('ADMIN', 'AGENT'), ticketController.createNote);
router.patch('/:id/notes/:noteId', requireRole('ADMIN', 'AGENT'), ticketController.updateNote);
router.delete('/:id/notes/:noteId', requireRole('ADMIN', 'AGENT'), ticketController.deleteNote);
router.post('/:id/tags', requireRole('ADMIN', 'AGENT'), ticketController.addTag);
router.delete('/:id/tags/:tagId', requireRole('ADMIN', 'AGENT'), ticketController.removeTag);

// Aninhados
router.use('/:ticketId/messages', messageRoutes);
router.use('/:ticketId/transfers', transferRoutes);

export default router;