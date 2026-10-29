import type { Request, Response, NextFunction } from 'express';
import { getRouteParam } from '../../utils/routeParams';
import {
  createQuickReplySchema,
  updateQuickReplySchema,
} from './quickReply.schemas';
import * as quickReplyService from './quickReply.service';

export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(await quickReplyService.listQuickReplies());
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
    const data = createQuickReplySchema.parse(req.body);
    return res.status(201).json(await quickReplyService.createQuickReply(data));
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
    const data = updateQuickReplySchema.parse(req.body);
    return res.json(
      await quickReplyService.updateQuickReply(
        getRouteParam(req, 'id'),
        data
      )
    );
  } catch (error) {
    return next(error);
  }
}

export async function remove(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    return res.json(
      await quickReplyService.deleteQuickReply(getRouteParam(req, 'id'))
    );
  } catch (error) {
    return next(error);
  }
}
