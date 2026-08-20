import { z } from 'zod';

/**
 * Login payload. Email is normalized (trimmed + lowercased) before it reaches
 * the service. Zod 4 dropped `.email()`, so we validate the shape with a regex.
 * Password length is bounded to avoid unbounded bcrypt input.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Email is required')
    .max(254)
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Enter a valid email address'),
  password: z.string().min(1, 'Password is required').max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;
