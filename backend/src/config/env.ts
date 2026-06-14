import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  STORAGE_PATH: z.string().default('./storage/invoices'),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  // Admin seed configuration (production only)
  ADMIN_SEED_USERNAME: z.string().min(1).optional(),
  ADMIN_SEED_PASSWORD: z.string().min(10).optional(),
  ADMIN_SEED_EMAIL: z.string().email().optional(),
});

export const env = envSchema.parse(process.env);
