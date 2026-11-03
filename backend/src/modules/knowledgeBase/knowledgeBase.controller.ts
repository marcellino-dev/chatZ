import type { Request, Response, NextFunction } from 'express';
import { getRouteParam } from '../../utils/routeParams';
import {
  createArticleSchema,
  listArticlesSchema,
  updateArticleSchema,
} from './knowledgeBase.schemas';
import * as knowledgeBaseService from './knowledgeBase.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listArticlesSchema.parse(req.query);
    return res.json(
      await knowledgeBaseService.listArticles(req.user!.role, query)
    );
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
    const data = createArticleSchema.parse(req.body);
    return res.status(201).json(await knowledgeBaseService.createArticle(data));
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
    const data = updateArticleSchema.parse(req.body);
    return res.json(
      await knowledgeBaseService.updateArticle(getRouteParam(req, 'id'), data)
    );
  } catch (error) {
    return next(error);
  }
}
