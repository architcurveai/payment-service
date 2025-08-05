import Razorpay from 'razorpay';
import { logger } from '../utils/logger.js';
import { razorpayCircuitBreaker } from '../utils/circuitBreaker.js';
import { ErrorSanitizer } from '../utils/errorSanitizer.js';

let razorpay = null;

const initializeRazorpay = () => {
  if (!razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      logger.warn('Razorpay credentials not found. Payment functionality will be limited.');
      return null;
    }
    
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    
    logger.info('Razorpay initialized successfully');
  }
  return razorpay;
};

const executeRazorpayOperation = async (operationName, operation) => {
  return await razorpayCircuitBreaker.execute(async () => {
    try {
      const rzp = initializeRazorpay();
      if (!rzp) {
        throw new Error('Razorpay not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
      }
      
      const result = await operation(rzp);
      logger.info(`Razorpay ${operationName} successful`);
      return result;
    } catch (error) {
      // Log the full error internally
      ErrorSanitizer.logError(error, { operation: operationName });
      
      // Re-throw with sanitized message for client
      const sanitized = ErrorSanitizer.sanitizeError(error);
      const razorpayError = new Error(sanitized.message);
      razorpayError.statusCode = sanitized.statusCode;
      razorpayError.code = sanitized.code;
      razorpayError.originalError = error; // Keep for internal use
      
      throw razorpayError;
    }
  }, async () => {
    // Fallback when circuit breaker is open
    logger.warn(`Razorpay ${operationName} failed - circuit breaker open, using fallback`);
    throw new Error('Payment service temporarily unavailable. Please try again later.');
  });
};

export const razorpayService = {
  async createOrder(options) {
    if (!options) {
      throw new Error('Order options are required');
    }

    return executeRazorpayOperation('order creation', async (rzp) => {
      const order = await rzp.orders.create(options);
      logger.info(`Razorpay order created: ${order.id}`);
      return order;
    });
  },

  async capturePayment(paymentId, amount) {
    if (!paymentId || !amount) {
      throw new Error('Payment ID and amount are required');
    }

    return executeRazorpayOperation('payment capture', async (rzp) => {
      const payment = await rzp.payments.capture(paymentId, amount);
      logger.info(`Razorpay payment captured: ${paymentId}`);
      return payment;
    });
  },

  async fetchPayment(paymentId) {
    if (!paymentId) {
      throw new Error('Payment ID is required');
    }

    return executeRazorpayOperation('payment fetch', rzp => rzp.payments.fetch(paymentId));
  },

  async refundPayment(paymentId, options = {}) {
    if (!paymentId) {
      throw new Error('Payment ID is required');
    }

    return executeRazorpayOperation('refund creation', async (rzp) => {
      const refund = await rzp.payments.refund(paymentId, options);
      logger.info(`Razorpay refund created: ${refund.id}`);
      return refund;
    });
  },

  async fetchOrder(orderId) {
    if (!orderId) {
      throw new Error('Order ID is required');
    }

    return executeRazorpayOperation('order fetch', rzp => rzp.orders.fetch(orderId));
  },

  async fetchRefund(refundId) {
    if (!refundId) {
      throw new Error('Refund ID is required');
    }

    return executeRazorpayOperation('refund fetch', rzp => rzp.refunds.fetch(refundId));
  },

  // Health check for circuit breaker monitoring
  async healthCheck() {
    return executeRazorpayOperation('health check', async (rzp) => {
      // Simple API call to verify connectivity
      try {
        await rzp.orders.all({ count: 1 });
        return { status: 'OK', service: 'razorpay' };
      } catch (error) {
        throw new Error('Razorpay API connectivity check failed');
      }
    });
  },

  // Get circuit breaker status
  getCircuitBreakerStatus() {
    return razorpayCircuitBreaker.getState();
  }
};