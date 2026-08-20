import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { disconnectPrisma } from './config/prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 API listening on http://localhost:${env.PORT}  [${env.NODE_ENV}]`);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.warn(`${signal} received — shutting down`);
  server.close(async () => {
    await disconnectPrisma();
    logger.info('HTTP server closed');
    process.exit(0);
  });
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
