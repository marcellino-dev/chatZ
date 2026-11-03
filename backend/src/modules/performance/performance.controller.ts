import { Request, Response } from 'express';
import { z } from 'zod';
import { getMyPerformance } from './performance.service';

const periodSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export async function mine(req: Request, res: Response) {
  const { from, to } = periodSchema.parse(req.query);
  const user = req.user!;
  const metrics = await getMyPerformance(user.id, from, to);
  return res.json(metrics);
}
