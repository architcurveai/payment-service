import express from 'express';
import helmet from 'helmet'; 
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from './middleware/rateLimit.js';
import routes from './routes.js';
import { logger } from './utils/logger.js';
import morgan from 'morgan';
import { setupBullBoard } from './services/bullBoardService.js';

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

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(err.status || 500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

app.listen(PORT, HOST, () => {
  logger.info(`Payment service running on ${HOST}:${PORT}`);
  const dashboardUrl = `http://${HOST}:${PORT}/admin/queues`;
  logger.info(`Bull Board dashboard will be available at: ${dashboardUrl}`);
});
