import { Router } from 'express';
import * as ticketController from './ticket.controller';
import { authMiddleware } from '../../middlewares/auth';

const router = Router();

// Todas as rotas exigem autenticação
router.use(authMiddleware);

// Criar ticket (só CLIENT — validado no service)
router.post('/', ticketController.create);

// Listar (filtrado por role no service)
router.get('/', ticketController.list);

// Detalhes de um ticket
router.get('/:id', ticketController.getById);

// Assumir ticket (AGENT/ADMIN)
router.patch('/:id/assign', ticketController.assign);

// Atualizar status (AGENT dono ou ADMIN)
router.patch('/:id/status', ticketController.updateStatus);

// Atualizar prioridade (AGENT dono ou ADMIN)
router.patch('/:id/priority', ticketController.updatePriority);

export default router;