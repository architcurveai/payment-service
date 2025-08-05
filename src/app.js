import express from 'express';
import helmet from 'helmet'; 
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from './middleware/rateLimit.js';
import routes from './routes.js';
import { logger } from './utils/logger.js';
import morgan from 'morgan';
import { setupBullBoard } from './services/bullBoardService.js';
import { gracefulShutdown } from './utils/gracefulShutdown.js';
import { ErrorSanitizer } from './utils/errorSanitizer.js';

// Load environment variables
dotenv.config();

const app = express();

// Security Headers
app.use(helmet());
app.use(helmet.hsts({ maxAge: 63072000 })); // 2 years

// CORS (restrict origins)
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'];
app.use(cors({ origin: allowedOrigins, methods: ['POST','GET'] }));

// Body Parsing
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '100kb' }));

// Request Logging
app.use(morgan('combined', { stream: logger.stream }));

// Rate Limiting
app.use(rateLimit);

// Graceful shutdown middleware (reject requests during shutdown)
app.use(gracefulShutdown.middleware());

// Routes
app.use('/api/payments', routes);

// Initialize Bull Board Dashboard (after routes to ensure queue is initialized)
async function initializeBullBoard() {
  try {
    const { queueService } = await import('./services/queueService.js');
    const queue = await queueService.waitForQueue(); 
    if (queue) {
      setupBullBoard(app, [queue]);
      logger.info('Bull Board dashboard initialized successfully');
    } 
  } catch (error) {
    logger.warn('Bull Board initialization failed:', error.message);
  }
}

// Initialize with proper async handling
initializeBullBoard();

// Global Error Handler with sanitization
app.use(ErrorSanitizer.middleware());

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Start server with graceful shutdown support
const server = app.listen(PORT, HOST, () => {
  logger.info(`Payment service running on ${HOST}:${PORT}`);
  const dashboardUrl = `http://${HOST}:${PORT}/admin/queues`;
  logger.info(`Bull Board dashboard will be available at: ${dashboardUrl}`);
});

// Initialize graceful shutdown
gracefulShutdown.init();

// Register services for graceful shutdown
gracefulShutdown.registerService('http-server', async () => {
  logger.info('Closing HTTP server...');
  return new Promise((resolve) => {
    server.close(() => {
      logger.info('HTTP server closed');
      resolve();
    });
  });
}, 100); // High priority

gracefulShutdown.registerService('database-connections', async () => {
  logger.info('Closing database connections...');
  try {
    const { supabaseService } = await import('./services/supabaseService.js');
    // Supabase handles connection cleanup automatically
    logger.info('Database connections closed');
  } catch (error) {
    logger.warn('Error closing database connections:', error);
  }
}, 90);

gracefulShutdown.registerService('queue-workers', async () => {
  logger.info('Stopping queue workers...');
  try {
    const { queueService } = await import('./services/queueService.js');
    await queueService.shutdown();
    logger.info('Queue workers stopped');
  } catch (error) {
    logger.warn('Error stopping queue workers:', error);
  }
}, 80);

gracefulShutdown.registerService('redis-connections', async () => {
  logger.info('Closing Redis connections...');
  try {
    const { queueService } = await import('./services/queueService.js');
    await queueService.closeRedisConnections();
    logger.info('Redis connections closed');
  } catch (error) {
    logger.warn('Error closing Redis connections:', error);
  }
}, 70);
