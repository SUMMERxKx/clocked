import { createApp } from './app';
import { config } from './config';
import { logger } from './lib/logger';

async function start() {
  try {
    const app = await createApp();
    
    await app.listen({
      port: config.port,
      host: config.host,
    });

    logger.info({
      port: config.port,
      host: config.host,
      env: config.nodeEnv,
    }, 'Server started successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

start();
