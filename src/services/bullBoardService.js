import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { logger } from '../utils/logger.js';

let serverAdapter = null;
let bullBoard = null;

export const setupBullBoard = (app, queues = [], basePath = process.env.BULL_BOARD_BASE_PATH || '/admin/queues') => {
  try {
    // Create server adapter for Express
    serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath(basePath);

    // Create Bull Board with queue adapters
    const queueAdapters = queues.map(queue => new BullMQAdapter(queue));
    
    bullBoard = createBullBoard({
      queues: queueAdapters,
      serverAdapter: serverAdapter,
      options: {
        uiConfig: {
          boardTitle: 'Payment Service - Queue Dashboard',
          boardLogo: {
            path: 'https://cdn.jsdelivr.net/npm/bullmq@4/docs/gitbook/assets/logo.png',
            width: '100px',
            height: 'auto'
          },
          miscLinks: [
            { text: 'API Health', url: '/api/payments/health' },
            { text: 'API Docs', url: '/api/payments' }
          ],
          favIcon: {
            default: 'static/images/logo.svg',
            alternative: 'static/images/logo.png'
          }
        }
      }
    });

    // Add authentication middleware for Bull Board
    const bullBoardAuth = (req, res, next) => {
      // In development, allow access without auth
      if (process.env.NODE_ENV === 'development') {
        return next();
      }

      // In production, require authentication
      const authHeader = req.headers.authorization;
      const adminToken = process.env.BULL_BOARD_TOKEN || process.env.JWT_SECRET;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          error: 'Unauthorized', 
          message: 'Bull Board access requires authentication' 
        });
      }

      const token = authHeader.split(' ')[1];
      if (token !== adminToken) {
        return res.status(401).json({ 
          error: 'Unauthorized', 
          message: 'Invalid Bull Board token' 
        });
      }

      next();
    };

    // Mount Bull Board with authentication
    app.use(basePath, bullBoardAuth, serverAdapter.getRouter());

    logger.info('Bull Board dashboard initialized successfully');
    const host = process.env.HOST || 'localhost';
    const port = process.env.PORT || 3000;
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const domain = process.env.NODE_ENV === 'production' ? (process.env.DOMAIN || 'your-domain.com') : `${host}:${port}`;
    const fullUrl = `${protocol}://${domain}${basePath}`;
    logger.info(`Bull Board available at: ${fullUrl}`);

    return { serverAdapter, bullBoard };
  } catch (error) {
    logger.error('Failed to initialize Bull Board:', error);
    throw error;
  }
};

export const addQueueToBullBoard = (queue) => {
  try {
    if (bullBoard && queue) {
      const adapter = new BullMQAdapter(queue);
      bullBoard.addQueue(adapter);
      logger.info(`Queue "${queue.name}" added to Bull Board dashboard`);
    }
  } catch (error) {
    logger.error('Failed to add queue to Bull Board:', error);
  }
};

export const removeQueueFromBullBoard = (queueName) => {
  try {
    if (!queueName || typeof queueName !== 'string') {
      throw new Error('Invalid queueName parameter - must be a non-empty string');
    }

    if (bullBoard) {
      bullBoard.removeQueue(queueName);
      logger.info(`Queue "${queueName}" removed from Bull Board dashboard`);
    } else {
      logger.warn('Bull Board not initialized - cannot remove queue');
    }
  } catch (error) {
    logger.error('Failed to remove queue from Bull Board:', error);
    throw error; // Re-throw to allow caller to handle
  }
};

export const getBullBoardStats = () => {
  try {
    if (bullBoard && serverAdapter) {
      return {
        queues: bullBoard.queues.length,
        queueNames: bullBoard.queues.map(q => q.name),
        serverAdapter: true,
        basePath: serverAdapter.getBasePath(),
        initialized: true
      };
    }
    return {
      queues: 0,
      queueNames: [],
      serverAdapter: false,
      basePath: null,
      initialized: false
    };
  } catch (error) {
    logger.error('Failed to get Bull Board stats:', error);
    throw error; // Re-throw to allow caller to handle
  }
};