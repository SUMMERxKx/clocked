import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().default('your-secret-key-change-in-production'),
  REDIS_URL: z.string().optional(),
});

export const config = configSchema.parse(process.env);