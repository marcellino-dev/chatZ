import { Request, Response, NextFunction } from 'express';
import * as transferService from './transfer.service';
import { transferTicketSchema } from './transfer.schemas';
import { getRouteParam } from '../../utils/routeParams';

export async function transfer(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = transferTicketSchema.parse(req.body);
    const result = await transferService.transferTicket(
      req.user!,
      getRouteParam(req, 'ticketId'),
      data
    );
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function list(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const transfers = await transferService.listTransfers(
      req.user!,
      getRouteParam(req, 'ticketId')
    );
    return res.json(transfers);
  } catch (err) {
    return next(err);
  }
}