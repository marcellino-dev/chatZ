import { Request, Response, NextFunction } from 'express';
import * as sectorService from './sector.service';
import { createSectorSchema, updateSectorSchema } from './sector.schemas';
import { getRouteParam } from '../../utils/routeParams';

// ==========================
// LISTAR
// ==========================
export async function list(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // ?active=true → só ativos
    const onlyActive = req.query.active === 'true';
    const sectors = await sectorService.listSectors({ onlyActive });
    return res.json(sectors);
  } catch (err) {
    return next(err);
  }
}

// ==========================
// BUSCAR POR ID
// ==========================
export async function getById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const sector = await sectorService.getSectorById(getRouteParam(req, 'id'));
    return res.json(sector);
  } catch (err) {
    return next(err);
  }
}

// ==========================
// CRIAR
// ==========================
export async function create(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = createSectorSchema.parse(req.body);
    const sector = await sectorService.createSector(data);
    return res.status(201).json(sector);
  } catch (err) {
    return next(err);
  }
}

// ==========================
// ATUALIZAR
// ==========================
export async function update(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = updateSectorSchema.parse(req.body);
    const sector = await sectorService.updateSector(getRouteParam(req, 'id'), data);
    return res.json(sector);
  } catch (err) {
    return next(err);
  }
}

// ==========================
// DELETAR (soft delete)
// ==========================
export async function remove(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const sector = await sectorService.deleteSector(getRouteParam(req, 'id'));
    return res.json(sector);
  } catch (err) {
    return next(err);
  }
}