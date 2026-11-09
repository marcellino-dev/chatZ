import { Request, Response } from 'express';
import { z } from 'zod';
import {
  getMyDailyPerformance,
  getMyPerformance,
  getMyPerformanceSummary,
  getMyRecentPerformance,
} from './performance.service';

const periodSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

const dailyQuerySchema = periodSchema.extend({
  timeZone: z.string().min(1).max(100).default('UTC').refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Fuso horário inválido'),
});

const recentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

export async function mine(req: Request, res: Response) {
  const { from, to } = periodSchema.parse(req.query);
  const user = req.user!;
  const metrics = await getMyPerformance(user.id, from, to);
  return res.json(metrics);
}

export async function summary(req: Request, res: Response) {
  const user = req.user!;
  const metrics = await getMyPerformanceSummary(user.id);
  return res.json(metrics);
}

export async function daily(req: Request, res: Response) {
  const { from, to, timeZone } = dailyQuerySchema.parse(req.query);
  const user = req.user!;
  const metrics = await getMyDailyPerformance(user.id, from, to, timeZone);
  return res.json(metrics);
}

export async function recent(req: Request, res: Response) {
  const { limit } = recentQuerySchema.parse(req.query);
  const user = req.user!;
  const activity = await getMyRecentPerformance(user.id, limit);
  return res.json(activity);
}
