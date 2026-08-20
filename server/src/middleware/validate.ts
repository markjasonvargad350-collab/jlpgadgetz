import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodType } from 'zod';

interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Replace a request property with the parsed value.
 *
 * In Express 5 `req.query` is a getter that RE-PARSES the URL on every access,
 * so mutating it in place (or `req.query = x`) does not stick. We install an
 * own data property that shadows the prototype getter, so downstream handlers
 * read the validated/coerced object. `req.params` is treated the same way for
 * consistency; `req.body` is a plain writable property.
 */
function setParsed(req: Request, key: 'query' | 'params', value: unknown): void {
  Object.defineProperty(req, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

/**
 * Validate request parts against Zod schemas. On success the parsed (typed,
 * coerced, default-filled) values replace the originals; on failure the
 * ZodError is forwarded to the central error handler (→ 422).
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        setParsed(req, 'query', schemas.query.parse(req.query));
      }
      if (schemas.params) {
        setParsed(req, 'params', schemas.params.parse(req.params));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
