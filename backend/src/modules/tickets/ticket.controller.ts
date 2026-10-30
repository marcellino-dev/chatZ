import { Request, Response, NextFunction } from 'express';
import * as ticketService from './ticket.service';
import {
  createTicketSchema,
  updateStatusSchema,
  updatePrioritySchema,
  listTicketsSchema,
  addParticipantSchema,
  ticketNoteSchema,
  ticketTagSchema,
} from './ticket.schemas';
import { getRouteParam } from '../../utils/routeParams';
import * as ticketNotesService from './ticket.notes.service';

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createTicketSchema.parse(req.body);
    const ticket = await ticketService.createTicket(req.user!, data);
    return res.status(201).json(ticket);
  } catch (err) {
    return next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listTicketsSchema.parse(req.query);
    const tickets = await ticketService.listTickets(req.user!, query);
    return res.json(tickets);
  } catch (err) {
    return next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const ticket = await ticketService.getTicketById(req.user!, getRouteParam(req, 'id'));
    return res.json(ticket);
  } catch (err) {
    return next(err);
  }
}

export async function assign(req: Request, res: Response, next: NextFunction) {
  try {
    const ticket = await ticketService.assignTicket(req.user!, getRouteParam(req, 'id'));
    return res.json(ticket);
  } catch (err) {
    return next(err);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateStatusSchema.parse(req.body);
    const ticket = await ticketService.updateStatus(req.user!, getRouteParam(req, 'id'), data);
    return res.json(ticket);
  } catch (err) {
    return next(err);
  }
}

export async function updatePriority(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updatePrioritySchema.parse(req.body);
    const ticket = await ticketService.updatePriority(req.user!, getRouteParam(req, 'id'), data);
    return res.json(ticket);
  } catch (err) {
    return next(err);
  }
}

export async function addParticipant(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = addParticipantSchema.parse(req.body);
    const participant = await ticketService.addParticipant(
      req.user!,
      getRouteParam(req, 'id'),
      userId
    );
    return res.status(201).json(participant);
  } catch (err) {
    return next(err);
  }
}

export async function removeParticipant(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await ticketService.removeParticipant(
      req.user!,
      getRouteParam(req, 'id'),
      getRouteParam(req, 'userId')
    );
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function listParticipants(req: Request, res: Response, next: NextFunction) {
  try {
    const participants = await ticketService.listParticipants(
      req.user!,
      getRouteParam(req, 'id')
    );
    return res.json(participants);
  } catch (err) {
    return next(err);
  }
}

export async function listNotes(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(
      await ticketNotesService.listTicketNotes(req.user!, getRouteParam(req, 'id'))
    );
  } catch (error) {
    return next(error);
  }
}

export async function createNote(req: Request, res: Response, next: NextFunction) {
  try {
    const data = ticketNoteSchema.parse(req.body);
    const note = await ticketNotesService.createTicketNote(
      req.user!,
      getRouteParam(req, 'id'),
      data
    );
    return res.status(201).json(note);
  } catch (error) {
    return next(error);
  }
}

export async function updateNote(req: Request, res: Response, next: NextFunction) {
  try {
    const data = ticketNoteSchema.parse(req.body);
    const note = await ticketNotesService.updateTicketNote(
      req.user!,
      getRouteParam(req, 'id'),
      getRouteParam(req, 'noteId'),
      data
    );
    return res.json(note);
  } catch (error) {
    return next(error);
  }
}

export async function deleteNote(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(
      await ticketNotesService.deleteTicketNote(
        req.user!,
        getRouteParam(req, 'id'),
        getRouteParam(req, 'noteId')
      )
    );
  } catch (error) {
    return next(error);
  }
}

export async function addTag(req: Request, res: Response, next: NextFunction) {
  try {
    const { tagId } = ticketTagSchema.parse(req.body);
    return res.json(
      await ticketService.addTicketTag(
        req.user!,
        getRouteParam(req, 'id'),
        tagId
      )
    );
  } catch (error) {
    return next(error);
  }
}

export async function removeTag(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(
      await ticketService.removeTicketTag(
        req.user!,
        getRouteParam(req, 'id'),
        getRouteParam(req, 'tagId')
      )
    );
  } catch (error) {
    return next(error);
  }
}