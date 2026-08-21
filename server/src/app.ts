import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { CLIENT_ORIGINS, isProd } from './config/env';
import { prisma } from './config/prisma';
import { asyncHandler } from './utils/asyncHandler';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';
import { csrfGuard } from './middleware/csrf';
import { requestLog } from './middleware/requestLog';
import { publicCache, noStore } from './middleware/cacheControl';
import authRouter from './routes/auth.routes';
import productRouter from './routes/product.routes';
import categoryRouter from './routes/category.routes';
import adminProductRouter from './routes/admin.product.routes';
import adminInventoryRouter from './routes/admin.inventory.routes';
import adminOrderRouter from './routes/admin.order.routes';
import adminShipmentRouter from './routes/admin.shipment.routes';
import adminReportRouter from './routes/admin.report.routes';
import adminBranchRouter from './routes/admin.branch.routes';
import adminTradeInRouter from './routes/admin.tradein.routes';
import adminInstallmentRouter from './routes/admin.installment.routes';
import orderRouter from './routes/order.routes';
import branchRouter from './routes/branch.routes';
import tradeInRouter from './routes/tradein.routes';
import installmentRouter from './routes/installment.routes';

/**
 * Build the Express application. Kept as a factory so tests can create isolated
 * instances. Route modules are mounted here as they are implemented per phase.
 */
export function createApp(): Application {
  const app = express();

  // Security & platform middleware
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // correct client IPs behind a proxy (Render/Railway/Vercel)

  // Assign/echo a request id and log one line per request. Registered first so
  // every response — including health checks and rate-limited ones — is covered.
  app.use(requestLog);

  // Security headers. CSP is left at Helmet's defaults — this is a JSON API, not
  // an HTML origin, so a page CSP adds little. HSTS only means anything over
  // HTTPS, so it's enabled in production only.
  app.use(
    helmet({
      hsts: isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  // CORS: reflect only allow-listed origins (never a wildcard — we send
  // credentials). Requests with no Origin (curl, same-origin, health probes) are
  // allowed; a disallowed browser origin simply gets no CORS headers back and is
  // blocked by the browser.
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || CLIENT_ORIGINS.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true, // allow the admin auth cookie
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // Gzip/deflate responses (JSON payloads compress well) before they hit routers.
  app.use(compression());

  // Baseline rate limit for the whole API (auth routes get a stricter one later)
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Health check — also pings the database so orchestrators can detect DB loss.
  app.get(
    '/api/health',
    asyncHandler(async (_req, res) => {
      res.setHeader('Cache-Control', 'no-store'); // liveness must never be cached
      let db: 'up' | 'down' = 'down';
      try {
        await prisma.$queryRaw`SELECT 1`;
        db = 'up';
      } catch {
        db = 'down';
      }
      res.status(db === 'up' ? 200 : 503).json({
        status: db === 'up' ? 'ok' : 'degraded',
        service: 'iphone-ecommerce-api',
        db,
        time: new Date().toISOString(),
      });
    }),
  );

  // CSRF: reject cross-origin state-changing requests before they reach any
  // router (safe methods and origin-matching requests pass through).
  app.use('/api', csrfGuard);

  // Cache policy: everything authed or PII-bearing is never stored; public
  // catalog reads are briefly cacheable (the error handler downgrades any
  // failed response back to no-store, so 404s/500s are never cached).
  app.use(['/api/admin', '/api/orders', '/api/trade-ins', '/api/installments'], noStore);

  // ── Feature routers ──
  // Auth is mounted first so /api/admin/auth/* resolves before the catch-all
  // /api/admin catalog router below. Likewise /inventory, /orders and /reports
  // are mounted before /api/admin so their specific paths win over the catalog router.
  app.use('/api/admin/auth', authRouter);
  app.use('/api/admin/inventory', adminInventoryRouter);
  app.use('/api/admin/orders', adminOrderRouter);
  app.use('/api/admin/shipments', adminShipmentRouter);
  app.use('/api/admin/reports', adminReportRouter);
  app.use('/api/admin/branches', adminBranchRouter);
  app.use('/api/admin/trade-ins', adminTradeInRouter);
  app.use('/api/admin/installments', adminInstallmentRouter);
  app.use('/api/admin', adminProductRouter);
  app.use('/api/products', publicCache(), productRouter);
  app.use('/api/categories', publicCache(), categoryRouter);
  app.use('/api/branches', publicCache(), branchRouter);
  app.use('/api/orders', orderRouter);
  app.use('/api/trade-ins', tradeInRouter);
  app.use('/api/installments', installmentRouter);

  // 404 + centralized error handling (must be last)
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
