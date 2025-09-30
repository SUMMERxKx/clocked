import { z } from 'zod';

const configSchema = z.object({
  // API
  apiUrl: z.string().url().default('http://localhost:3000'),
  wsUrl: z.string().url().default('ws://localhost:3000'),
  
  // App
  appName: z.string().default('Clocked'),
  appVersion: z.string().default('1.0.0'),
  
  // Features
  enableNotifications: z.coerce.boolean().default(true),
  enableLocation: z.coerce.boolean().default(false),
  enableAnalytics: z.coerce.boolean().default(false),
  
  // OAuth
  googleClientId: z.string().optional(),
  appleClientId: z.string().optional(),
  
  // Push Notifications
  fcmSenderId: z.string().optional(),
  
  // Development
  isDevelopment: z.coerce.boolean().default(__DEV__),
});

const parseConfig = () => {
  try {
    return configSchema.parse({
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      wsUrl: process.env.EXPO_PUBLIC_WS_URL,
      appName: process.env.EXPO_PUBLIC_APP_NAME,
      appVersion: process.env.EXPO_PUBLIC_APP_VERSION,
      enableNotifications: process.env.EXPO_PUBLIC_ENABLE_NOTIFICATIONS,
      enableLocation: process.env.EXPO_PUBLIC_ENABLE_LOCATION,
      enableAnalytics: process.env.EXPO_PUBLIC_ENABLE_ANALYTICS,
      googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
      appleClientId: process.env.EXPO_PUBLIC_APPLE_CLIENT_ID,
      fcmSenderId: process.env.EXPO_PUBLIC_FCM_SENDER_ID,
      isDevelopment: __DEV__,
    });
  } catch (error) {
    console.error('Configuration validation failed:', error);
    // Return default config in case of error
    return configSchema.parse({});
  }
};

export const config = parseConfig();

export type Config = z.infer<typeof configSchema>;
