import { Request, Response, NextFunction } from 'express';
import * as messageService from './message.service';
import { sendMessageSchema } from './message.schemas';
import { getRouteParam } from '../../utils/routeParams';

export async function list(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const messages = await messageService.listMessages(
      req.user!,
      getRouteParam(req, 'ticketId')
    );
    return res.json(messages);
  } catch (err) {
    return next(err);
  }
}

export async function send(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = sendMessageSchema.parse(req.body);
    const message = await messageService.sendMessage(
      req.user!,
      getRouteParam(req, 'ticketId'),
      data
    );
    return res.status(201).json(message);
  } catch (err) {
    return next(err);
  }
}