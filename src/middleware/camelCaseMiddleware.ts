import { NextFunction, Response } from 'express';
import { toCamelCase } from '../utils/toCamelCase';

export const camelCaseMiddleware = (_, res: Response, next: NextFunction) => {
  const originalJson = res.json;
  res.json = function (data) {
    return originalJson.call(this, toCamelCase(data));
  };
  next();
};
