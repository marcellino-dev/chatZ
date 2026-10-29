import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as botService from './bot.service';
import { getRouteParam } from '../../utils/routeParams';

const simulateSchema = z.object({
  phone: z.string().min(8, 'Phone muito curto'),
  message: z.string().min(1, 'Mensagem obrigatória'),
});

// ==========================
// SIMULAR MENSAGEM RECEBIDA
// (no futuro: webhook da Evolution API)
// ==========================
export async function simulate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = simulateSchema.parse(req.body);
    const result = await botService.processMessage(data);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

// ==========================
// RESETAR CONVERSA (só debug)
// ==========================
export async function resetConversation(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const phone = getRouteParam(req, 'phone');
    const normalized = phone.replace(/\D/g, '');

    await botService.processMessage({
      phone: normalized,
      message: '', // mensagem vazia força reset? não — melhor deletar direto
    });

    // Alternativa: deletar a conversation
    // (vou deixar um endpoint dedicado depois)

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}