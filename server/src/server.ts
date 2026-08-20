import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { disconnectPrisma } from './config/prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 API listening on http://localhost:${env.PORT}  [${env.NODE_ENV}]`);
});

// Fail fast on listen errors (e.g. the port is already in use).
server.on('error', (err) => {
  logger.error('HTTP server error', err);
  process.exit(1);
});

let shuttingDown = false;

/** Close the HTTP server + DB pool, then exit. Forces exit if close() hangs. */
const shutdown = (reason: string, code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn(`${reason} — shutting down`);

  // Safety net: if graceful close stalls on keep-alive sockets, force-exit.
  const forced = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(code || 1);
  }, 10_000);
  forced.unref();

  server.close(async () => {
    await disconnectPrisma();
    logger.info('HTTP server closed');
    clearTimeout(forced);
    process.exit(code);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Never leave the process in an undefined state after an unhandled async error.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
  shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', err);
  shutdown('uncaughtException', 1);
});
