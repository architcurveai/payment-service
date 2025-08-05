/**
 * Graceful Shutdown Handler
 * Ensures clean shutdown of all services and connections
 */

import { logger } from './logger.js';

class GracefulShutdown {
  constructor() {
    this.services = new Map();
    this.isShuttingDown = false;
    this.shutdownTimeout = 30000; // 30 seconds
    this.forceExitTimeout = 35000; // 35 seconds (force exit if graceful fails)
  }

  /**
   * Register a service for graceful shutdown
   */
  registerService(name, shutdownFunction, priority = 0) {
    this.services.set(name, {
      shutdown: shutdownFunction,
      priority,
      name
    });
    logger.info(`Service registered for graceful shutdown: ${name}`);
  }

  /**
   * Initialize graceful shutdown handlers
   */
  init() {
    // Handle different shutdown signals
    process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));
    process.on('SIGINT', () => this.handleShutdown('SIGINT'));
    process.on('SIGUSR2', () => this.handleShutdown('SIGUSR2')); // Nodemon restart
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.handleShutdown('UNCAUGHT_EXCEPTION', 1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.handleShutdown('UNHANDLED_REJECTION', 1);
    });

    logger.info('Graceful shutdown handlers initialized');
  }

  /**
   * Handle shutdown signal
   */
  async handleShutdown(signal, exitCode = 0) {
    if (this.isShuttingDown) {
      logger.warn(`Shutdown already in progress, ignoring ${signal}`);
      return;
    }

    this.isShuttingDown = true;
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    // Set force exit timeout
    const forceExitTimer = setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, this.forceExitTimeout);

    try {
      // Start shutdown process
      await this.performShutdown();
      
      clearTimeout(forceExitTimer);
      logger.info('Graceful shutdown completed successfully');
      process.exit(exitCode);
    } catch (error) {
      clearTimeout(forceExitTimer);
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Perform the actual shutdown
   */
  async performShutdown() {
    // Sort services by priority (higher priority shuts down first)
    const sortedServices = Array.from(this.services.values())
      .sort((a, b) => b.priority - a.priority);

    logger.info(`Shutting down ${sortedServices.length} services...`);

    // Shutdown services in order
    for (const service of sortedServices) {
      try {
        logger.info(`Shutting down service: ${service.name}`);
        
        const shutdownPromise = service.shutdown();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Timeout shutting down ${service.name}`)), 10000);
        });

        await Promise.race([shutdownPromise, timeoutPromise]);
        logger.info(`Service ${service.name} shut down successfully`);
      } catch (error) {
        logger.error(`Error shutting down service ${service.name}:`, error);
        // Continue with other services even if one fails
      }
    }
  }

  /**
   * Check if shutdown is in progress
   */
  isShutdownInProgress() {
    return this.isShuttingDown;
  }

  /**
   * Middleware to reject requests during shutdown
   */
  middleware() {
    return (req, res, next) => {
      if (this.isShuttingDown) {
        res.status(503).json({
          success: false,
          error: 'Service is shutting down',
          code: 'SERVICE_UNAVAILABLE'
        });
        return;
      }
      next();
    };
  }
}

// Create singleton instance
const gracefulShutdown = new GracefulShutdown();

export { gracefulShutdown, GracefulShutdown };