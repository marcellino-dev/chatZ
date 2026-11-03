import type { Request, Response, NextFunction } from 'express';
import { getRouteParam } from '../../utils/routeParams';
import {
  createFollowUpSchema,
  listFollowUpsSchema,
  updateFollowUpSchema,
} from './followUp.schemas';
import * as followUpService from './followUp.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listFollowUpsSchema.parse(req.query);
    return res.json(await followUpService.listFollowUps(req.user!, query));
  } catch (error) {
    return next(error);
  }
}

export async function overdueCount(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const count = await followUpService.countOverdueFollowUps(req.user!.id);
    return res.json({ count });
  } catch (error) {
    return next(error);
  }
}

export async function create(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = createFollowUpSchema.parse(req.body);
    const followUp = await followUpService.createFollowUp(req.user!, data);
    return res.status(201).json(followUp);
  } catch (error) {
    return next(error);
  }
}

export async function update(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = updateFollowUpSchema.parse(req.body);
    return res.json(
      await followUpService.updateFollowUp(
        req.user!,
        getRouteParam(req, 'id'),
        data
      )
    );
  } catch (error) {
    return next(error);
  }
}

export async function complete(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    return res.json(
      await followUpService.completeFollowUp(
        req.user!,
        getRouteParam(req, 'id')
      )
    );
  } catch (error) {
    return next(error);
  }
}

export async function cancel(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    return res.json(
      await followUpService.cancelFollowUp(
        req.user!,
        getRouteParam(req, 'id')
      )
    );
  } catch (error) {
    return next(error);
  }
}
