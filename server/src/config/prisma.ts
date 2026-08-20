import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env, isProd } from './env';

/**
 * Prisma 7 runtime client.
 *
 * Prisma 7 uses the Query Compiler + a driver adapter instead of a bundled
 * query-engine binary, so we construct the client with `@prisma/adapter-pg`
 * (node-postgres). This works with any PostgreSQL provider — Neon, Supabase,
 * Render, or a local instance — no vendor lock-in.
 *
 * A single instance is cached on `globalThis` so `tsx watch` hot-reloads in
 * development don't open a new connection pool on every file change.
 */
function createPrismaClient(): PrismaClient {
  if (!env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Paste your PostgreSQL connection string into ' +
        'server/.env before running anything that touches the database.',
    );
  }

  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    log: isProd ? ['error'] : ['warn', 'error'],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!isProd) {
  globalForPrisma.prisma = prisma;
}

/** Close the pool cleanly on shutdown (called from server.ts signal handlers). */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
