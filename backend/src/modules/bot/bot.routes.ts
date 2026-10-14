import { Router } from 'express';
import * as botController from './bot.controller';

const router = Router();

// ⚠️ Essas rotas NÃO têm authMiddleware
// porque simulam o WhatsApp (webhook público)
//
// No futuro:
// - POST /bot/webhook  → Evolution API chama
// - POST /bot/simulate → só pra DEV

router.post('/simulate', botController.simulate);

export default router;