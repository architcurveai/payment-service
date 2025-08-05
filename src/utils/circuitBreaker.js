/**
 * Circuit Breaker Pattern Implementation
 * Provides fault tolerance for external service calls
 */

import { logger } from './logger.js';

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    this.expectedErrors = options.expectedErrors || [];
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    this.requestCount = 0;
    
    // Monitoring
    this.metrics = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      lastReset: Date.now()
    };
  }

  async execute(operation, fallback = null) {
    this.metrics.totalRequests++;
    this.requestCount++;

    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker transitioning to HALF_OPEN state');
      } else {
        logger.warn('Circuit breaker is OPEN, rejecting request');
        if (fallback) {
          return await fallback();
        }
        throw new Error('Circuit breaker is OPEN - service temporarily unavailable');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.successCount++;
    this.metrics.totalSuccesses++;

    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      logger.info('Circuit breaker reset to CLOSED state after successful request');
    }
  }

  onFailure(error) {
    this.failureCount++;
    this.metrics.totalFailures++;
    this.lastFailureTime = Date.now();

    // Don't count expected errors as failures
    if (this.isExpectedError(error)) {
      logger.debug('Expected error, not counting towards circuit breaker failure', { error: error.message });
      return;
    }

    logger.warn(`Circuit breaker failure ${this.failureCount}/${this.failureThreshold}`, {
      error: error.message,
      state: this.state
    });

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.error('Circuit breaker opened due to repeated failures', {
        failureCount: this.failureCount,
        threshold: this.failureThreshold
      });
    }
  }

  isExpectedError(error) {
    return this.expectedErrors.some(expectedError => {
      if (typeof expectedError === 'string') {
        return error.message.includes(expectedError);
      }
      if (expectedError instanceof RegExp) {
        return expectedError.test(error.message);
      }
      if (typeof expectedError === 'function') {
        return expectedError(error);
      }
      return false;
    });
  }

  shouldAttemptReset() {
    return Date.now() - this.lastFailureTime >= this.resetTimeout;
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      metrics: this.metrics,
      lastFailureTime: this.lastFailureTime
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.lastFailureTime = null;
    logger.info('Circuit breaker manually reset');
  }
}

// Circuit breaker instances for different services
export const razorpayCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  expectedErrors: [
    'BAD_REQUEST_ERROR', // Razorpay validation errors
    'Invalid payment ID',
    'Invalid order ID'
  ]
});

export const supabaseCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000, // 30 seconds
  expectedErrors: [
    'Row not found',
    'Duplicate key value'
  ]
});

export const redisCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 15000, // 15 seconds
  expectedErrors: []
});

export { CircuitBreaker };