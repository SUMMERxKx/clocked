import { z } from 'zod';

const configSchema = z.object({
  // Server
  port: z.coerce.number().default(3000),
  host: z.string().default('0.0.0.0'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  
  // Database
  databaseUrl: z.string().url(),
  
  // JWT
  jwtSecret: z.string().min(32),
  jwtExpiresIn: z.string().default('15m'),
  refreshTokenExpiresIn: z.string().default('7d'),
  
  // CORS
  corsOrigin: z.string().transform(origins => origins.split(',')),
  
  // Redis
  redisUrl: z.string().url().optional(),
  
  // Email
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().optional(),
  
  // OAuth
  googleClientId: z.string().optional(),
  googleClientSecret: z.string().optional(),
  appleClientId: z.string().optional(),
  appleTeamId: z.string().optional(),
  appleKeyId: z.string().optional(),
  applePrivateKey: z.string().optional(),
  
  // Push Notifications
  fcmServerKey: z.string().optional(),
  apnsKeyId: z.string().optional(),
  apnsTeamId: z.string().optional(),
  apnsBundleId: z.string().optional(),
  
  // File Upload
  maxFileSize: z.coerce.number().default(5 * 1024 * 1024), // 5MB
  uploadDir: z.string().default('./uploads'),
  
  // Rate Limiting
  rateLimitMax: z.coerce.number().default(100),
  rateLimitWindow: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
  
  // Security
  bcryptRounds: z.coerce.number().default(12),
  sessionSecret: z.string().min(32),
  
  // Monitoring
  sentryDsn: z.string().url().optional(),
  prometheusPort: z.coerce.number().default(9090),
  
  // Feature Flags
  enableRegistration: z.coerce.boolean().default(true),
  enableOauth: z.coerce.boolean().default(true),
  enableMagicLinks: z.coerce.boolean().default(true),
});

const parseConfig = () => {
  try {
    return configSchema.parse(process.env);
  } catch (error) {
    console.error('Configuration validation failed:', error);
    process.exit(1);
  }
};

export const config = parseConfig();

export type Config = z.infer<typeof configSchema>;
