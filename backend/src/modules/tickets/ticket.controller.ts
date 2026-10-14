import { Request, Response, NextFunction } from 'express';
import * as ticketService from './ticket.service';
import {
  createTicketSchema,
  updateStatusSchema,
  updatePrioritySchema,
  listTicketsSchema,
} from './ticket.schemas';

export async function create(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = createTicketSchema.parse(req.body);
    const ticket = await ticketService.createTicket(req.user!, data);
    return res.status(201).json(ticket);
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
    const query = listTicketsSchema.parse(req.query);
    const tickets = await ticketService.listTickets(req.user!, query);
    return res.json(tickets);
  } catch (err) {
    return next(err);
  }
}

export async function getById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const ticket = await ticketService.getTicketById(req.user!, req.params.id);
    return res.json(ticket);
  } catch (err) {
    return next(err);
  }
}

export async function assign(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const ticket = await ticketService.assignTicket(req.user!, req.params.id);
    return res.json(ticket);
  } catch (err) {
    return next(err);
  }
}

export async function updateStatus(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = updateStatusSchema.parse(req.body);
    const ticket = await ticketService.updateStatus(
      req.user!,
      req.params.id,
      data
    );
    return res.json(ticket);
  } catch (err) {
    return next(err);
  }
}

export async function updatePriority(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = updatePrioritySchema.parse(req.body);
    const ticket = await ticketService.updatePriority(
      req.user!,
      req.params.id,
      data
    );
    return res.json(ticket);
  } catch (err) {
    return next(err);
  }
}