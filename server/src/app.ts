import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { asyncHandler } from './utils/asyncHandler';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './routes/auth.routes';
import productRouter from './routes/product.routes';
import categoryRouter from './routes/category.routes';
import adminProductRouter from './routes/admin.product.routes';
import adminInventoryRouter from './routes/admin.inventory.routes';
import adminOrderRouter from './routes/admin.order.routes';
import adminReportRouter from './routes/admin.report.routes';
import orderRouter from './routes/order.routes';

/**
 * Build the Express application. Kept as a factory so tests can create isolated
 * instances. Route modules are mounted here as they are implemented per phase.
 */
export function createApp(): Application {
  const app = express();

  // Security & platform middleware
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // correct client IPs behind a proxy (Render/Railway/Vercel)
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true, // allow the admin auth cookie
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

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
        env: env.NODE_ENV,
        db,
        time: new Date().toISOString(),
      });
    }),
  );

  // ── Feature routers ──
  // Auth is mounted first so /api/admin/auth/* resolves before the catch-all
  // /api/admin catalog router below. Likewise /inventory, /orders and /reports
  // are mounted before /api/admin so their specific paths win over the catalog router.
  app.use('/api/admin/auth', authRouter);
  app.use('/api/admin/inventory', adminInventoryRouter);
  app.use('/api/admin/orders', adminOrderRouter);
  app.use('/api/admin/reports', adminReportRouter);
  app.use('/api/admin', adminProductRouter);
  app.use('/api/products', productRouter);
  app.use('/api/categories', categoryRouter);
  app.use('/api/orders', orderRouter);

  // 404 + centralized error handling (must be last)
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
