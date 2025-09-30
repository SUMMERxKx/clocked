import { createApp } from './app';
import { config } from './config';
import { logger } from './lib/logger';

async function start() {
  try {
    const app = await createApp();
    
    const address = await app.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });
    
    logger.info(`🚀 Server listening at ${address}`);
    logger.info(`📊 Health check: ${address}/health`);
    logger.info(`🔧 API status: ${address}/api/status`);
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

start();