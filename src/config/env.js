import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env files based on NODE_ENV or environment context
if (process.env.VERCEL) {
  // On Vercel, use .env.production if available, but Vercel env vars take precedence
  dotenv.config({ path: '.env.production' });
} else if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: '.env.production' });
} else {
  dotenv.config();
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  CLIENT_URL: z
    .string()
    .min(1)
    .refine((value) => {
      if (value === '*') {
        return true;
      }

      const origins = value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

      if (origins.length === 0) {
        return false;
      }

      return origins.every((origin) => {
        try {
          const parsed = new URL(origin);
          return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
          return false;
        }
      });
    }, 'CLIENT_URL must be * or one/more comma-separated http(s) URLs')
    .default('http://localhost:5173,https://blood-donaction-clint.vercel.app,https://blood-donaction-client.vercel.app'),
  IMGBB_API_KEY: z.string().optional().default(''),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  DB_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(200),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  console.error('Invalid environment variables:', fieldErrors);

  const envError = new Error('Invalid environment variables');
  envError.name = 'EnvValidationError';
  envError.details = fieldErrors;

  if (process.env.VERCEL) {
    throw envError;
  }

  process.exit(1);
}

export const env = parsed.data;
