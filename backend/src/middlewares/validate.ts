import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny } from 'zod';

export interface ValidationSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

export const validate = (schemas: ValidationSchemas) => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (schemas.body) req.body = await schemas.body.parseAsync(req.body);
    if (schemas.params) req.params = (await schemas.params.parseAsync(req.params)) as Request['params'];
    if (schemas.query) req.query = (await schemas.query.parseAsync(req.query)) as Request['query'];
    next();
  } catch (error) {
    next(error);
  }
};

export default validate;
