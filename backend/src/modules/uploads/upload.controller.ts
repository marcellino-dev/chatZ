import { Request, Response, NextFunction } from 'express';
import * as uploadService from './upload.service';

export async function upload(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const saved = uploadService.saveUploadedFile(req.file);
    return res.status(201).json(saved);
  } catch (err) {
    return next(err);
  }
}