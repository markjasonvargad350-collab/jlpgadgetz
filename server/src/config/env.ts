import 'dotenv/config';
import { z } from 'zod';

/**
 * Validate and type environment variables at startup. The app refuses to boot
 * with an invalid config, so the rest of the codebase can trust `env`.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    CLIENT_URL: z.string().default('http://localhost:5173'),
    JWT_SECRET: z.string().min(16).default('dev-insecure-secret-change-me-please-0123456789'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    ADMIN_EMAIL: z.string().default('admin@istore.test'),
    ADMIN_PASSWORD: z.string().min(8).default('ChangeMe123!'),
    // A seeded STAFF demo account so the role system is real & demoable: STAFF
    // may browse + advance fulfillment, but cancellation/refund is ADMIN-only.
    STAFF_EMAIL: z.string().default('staff@istore.test'),
    STAFF_PASSWORD: z.string().min(8).default('StaffPass123!'),
    DATABASE_URL: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    // Production must never run on insecure defaults.
    if (val.NODE_ENV === 'production') {
      if (val.JWT_SECRET.startsWith('dev-insecure')) {
        ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'A real JWT_SECRET is required in production' });
      }
      if (!val.DATABASE_URL) {
        ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'DATABASE_URL is required in production' });
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
