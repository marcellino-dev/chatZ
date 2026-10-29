import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middlewares/auth';
import * as contactController from './contact.controller';

const router = Router();

router.use(authMiddleware, requireRole('ADMIN', 'AGENT'));
router.get('/', contactController.list);
router.get('/from-ticket/:ticketId', contactController.getTicketContact);
router.get('/:id', contactController.getById);
router.post('/from-ticket/:ticketId', contactController.saveTicketClient);
router.post('/', contactController.create);
router.patch('/:id', contactController.update);
router.delete('/:id', contactController.remove);
router.post('/:id/start-conversation', contactController.startConversation);

export default router;
