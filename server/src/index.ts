import { createApp } from './app';
import { config } from './config';

async function start() {
  try {
    const app = await createApp();
    
    const address = await app.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });
    
    console.log(`🚀 Server listening at ${address}`);
    console.log(`📊 Health check: ${address}/health`);
    console.log(`🔧 API status: ${address}/api/status`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();