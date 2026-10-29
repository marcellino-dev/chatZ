import type { Request, Response, NextFunction } from 'express';
import { getRouteParam } from '../../utils/routeParams';
import {
  createContactSchema,
  listContactsSchema,
  startConversationSchema,
  updateContactSchema,
} from './contact.schemas';
import * as contactService from './contact.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { q } = listContactsSchema.parse(req.query);
    return res.json(await contactService.listContacts(q));
  } catch (error) {
    return next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createContactSchema.parse(req.body);
    const contact = await contactService.createContact(data);
    return res.status(201).json(contact);
  } catch (error) {
    return next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateContactSchema.parse(req.body);
    const contact = await contactService.updateContact(
      getRouteParam(req, 'id'),
      data
    );
    return res.json(contact);
  } catch (error) {
    return next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(
      await contactService.deleteContact(getRouteParam(req, 'id'))
    );
  } catch (error) {
    return next(error);
  }
}

export async function startConversation(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { sectorId } = startConversationSchema.parse(req.body);
    const ticket = await contactService.startConversation(
      req.user!,
      getRouteParam(req, 'id'),
      sectorId
    );
    return res.status(201).json(ticket);
  } catch (error) {
    return next(error);
  }
}
