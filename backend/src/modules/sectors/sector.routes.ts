import { Router } from 'express';
import * as sectorController from './sector.controller';
import { authMiddleware, requireRole } from '../../middlewares/auth';

const router = Router();

// Todas as rotas exigem autenticação
router.use(authMiddleware);

// ==========================
// LEITURA (qualquer autenticado)
// ==========================
// GET /sectors           → lista todos
// GET /sectors?active=true → só ativos
// GET /sectors/:id        → detalhes
router.get('/', sectorController.list);
router.get('/:id', sectorController.getById);

// ==========================
// ESCRITA (só ADMIN)
// ==========================
router.post('/', requireRole('ADMIN'), sectorController.create);
router.patch('/:id', requireRole('ADMIN'), sectorController.update);
router.delete('/:id', requireRole('ADMIN'), sectorController.remove);

export default router;