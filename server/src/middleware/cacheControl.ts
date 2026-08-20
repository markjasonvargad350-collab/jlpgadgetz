import type { Request, Response, NextFunction } from 'express';

/**
 * Cache-Control policy helpers.
 *
 * `publicCache` is for anonymous, cacheable catalog reads: a short max-age plus
 * stale-while-revalidate lets a browser/CDN serve instantly and refresh in the
 * background. It only sets the header on GET/HEAD, and the central error handler
 * forces `no-store` on any errored response — so a 404/500 on a public route is
 * never cached.
 *
 * `noStore` is for anything tied to a session or containing PII (admin, auth,
 * orders) so no intermediary ever retains it.
 */
export function publicCache(maxAge = 60, staleWhileRevalidate = 300) {
  const value = `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      res.setHeader('Cache-Control', value);
    }
    next();
  };
}

export function noStore(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}
