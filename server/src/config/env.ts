import 'dotenv/config';
import { z } from 'zod';

/**
 * Validate and type environment variables at startup. The app refuses to boot
 * with an invalid config, so the rest of the codebase can trust `env`.
 */

// Insecure defaults that are fine for local dev but must never reach production.
const DEV_JWT_SECRET = 'dev-insecure-secret-change-me-please-0123456789';
const DEFAULT_ADMIN_PASSWORD = 'ChangeMe123!';
const DEFAULT_STAFF_PASSWORD = 'StaffPass123!';

/** Split a comma-separated origin list and normalize each to its bare origin. */
function parseOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      try {
        return new URL(s).origin;
      } catch {
        return s; // left as-is; prod validation below rejects anything invalid
      }
    });
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    // One or more allowed browser origins for the SPA, comma-separated
    // (e.g. "https://istore.app,https://www.istore.app"). Drives both the CORS
    // allowlist and the CSRF Origin check.
    CLIENT_URL: z.string().default('http://localhost:5173'),
    JWT_SECRET: z.string().min(32).default(DEV_JWT_SECRET),
    JWT_EXPIRES_IN: z.string().default('7d'),
    ADMIN_EMAIL: z.string().default('admin@istore.test'),
    ADMIN_PASSWORD: z.string().min(8).default(DEFAULT_ADMIN_PASSWORD),
    // A seeded STAFF demo account so the role system is real & demoable: STAFF
    // may browse + advance fulfillment, but cancellation/refund is ADMIN-only.
    STAFF_EMAIL: z.string().default('staff@istore.test'),
    STAFF_PASSWORD: z.string().min(8).default(DEFAULT_STAFF_PASSWORD),
    DATABASE_URL: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    // Production must never run on insecure defaults.
    if (val.NODE_ENV !== 'production') return;

    if (val.JWT_SECRET === DEV_JWT_SECRET || val.JWT_SECRET.startsWith('dev-insecure')) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'A real JWT_SECRET (≥32 chars) is required in production' });
    }
    if (!val.DATABASE_URL) {
      ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'DATABASE_URL is required in production' });
    }
    if (val.ADMIN_PASSWORD === DEFAULT_ADMIN_PASSWORD) {
      ctx.addIssue({ code: 'custom', path: ['ADMIN_PASSWORD'], message: 'Set a non-default ADMIN_PASSWORD in production' });
    }
    if (val.STAFF_PASSWORD === DEFAULT_STAFF_PASSWORD) {
      ctx.addIssue({ code: 'custom', path: ['STAFF_PASSWORD'], message: 'Set a non-default STAFF_PASSWORD in production' });
    }
    // Every CLIENT_URL entry must be a real http(s) origin, not localhost.
    const origins = parseOrigins(val.CLIENT_URL);
    if (origins.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['CLIENT_URL'], message: 'CLIENT_URL must list at least one origin in production' });
    }
    for (const o of origins) {
      let url: URL | null = null;
      try {
        url = new URL(o);
      } catch {
        /* handled below */
      }
      const isLocal = url && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
      if (!url || !/^https?:$/.test(url.protocol) || isLocal) {
        ctx.addIssue({ code: 'custom', path: ['CLIENT_URL'], message: `Invalid production origin: ${o}` });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:\n', JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';

/** Allowed browser origins (normalized) for CORS + the CSRF Origin allowlist. */
export const CLIENT_ORIGINS = parseOrigins(env.CLIENT_URL);
