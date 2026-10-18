import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URL: z.string().min(1).default('mongodb://localhost:27017/voting'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  ADMIN_NAME: z.string().min(1).default('Administrator'),
  ADMIN_EMAIL: z.email().default('admin@example.com'),
  ADMIN_PASSWORD: z.string().min(8).default('admin12345'),
  SEED_DEMO: z.stringbool().default(false),
});

export const config = envSchema.parse(process.env);
