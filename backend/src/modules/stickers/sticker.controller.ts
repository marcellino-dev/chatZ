import type { Request, Response, NextFunction } from 'express';
import { getRouteParam } from '../../utils/routeParams';
import * as stickerService from './sticker.service';
import {
  createStickerSchema,
  saveIncomingStickerSchema,
} from './sticker.schemas';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(await stickerService.listStickers(req.user!));
  } catch (error) {
    return next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Selecione uma imagem para a figurinha' });
    }

    const data = createStickerSchema.parse(req.body);
    return res.status(201).json(
      await stickerService.createSticker(req.user!, data, req.file)
    );
  } catch (error) {
    return next(error);
  }
}

export async function saveIncoming(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = saveIncomingStickerSchema.parse(req.body);
    return res.status(201).json(
      await stickerService.saveIncomingSticker(req.user!, data)
    );
  } catch (error) {
    return next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(
      await stickerService.deleteSticker(req.user!, getRouteParam(req, 'id'))
    );
  } catch (error) {
    return next(error);
  }
}
