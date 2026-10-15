import { Router } from 'express';
import * as whatsappController from './whatsapp.controller';

const router = Router();

// Webhook público (Evolution chama)
router.post('/webhook', whatsappController.webhook);
router.get('/webhook', whatsappController.verify);

export default router;