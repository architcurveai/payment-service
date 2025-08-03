import Razorpay from 'razorpay';
import { logger } from '../utils/logger.js';

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

export const razorpayService = {
  async createOrder(options) {
    try {
      const rzp = initializeRazorpay();
      if (!rzp) {
        throw new Error('Razorpay not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
      }
      
      const order = await rzp.orders.create(options);
      logger.info(`Razorpay order created: ${order.id}`);
      return order;
    } catch (error) {
      logger.error('Razorpay order creation failed:', error);
      throw error;
    }
  },

  async capturePayment(paymentId, amount) {
    try {
      const rzp = initializeRazorpay();
      if (!rzp) {
        throw new Error('Razorpay not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
      }
      
      const payment = await rzp.payments.capture(paymentId, amount);
      logger.info(`Razorpay payment captured: ${paymentId}`);
      return payment;
    } catch (error) {
      logger.error('Razorpay payment capture failed:', error);
      throw error;
    }
  },

  async fetchPayment(paymentId) {
    try {
      const rzp = initializeRazorpay();
      if (!rzp) {
        throw new Error('Razorpay not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
      }
      
      const payment = await rzp.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      logger.error('Razorpay payment fetch failed:', error);
      throw error;
    }
  },

  async refundPayment(paymentId, options = {}) {
    try {
      const rzp = initializeRazorpay();
      if (!rzp) {
        throw new Error('Razorpay not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
      }
      
      const refund = await rzp.payments.refund(paymentId, options);
      logger.info(`Razorpay refund created: ${refund.id}`);
      return refund;
    } catch (error) {
      logger.error('Razorpay refund failed:', error);
      throw error;
    }
  },

  async fetchOrder(orderId) {
    try {
      const rzp = initializeRazorpay();
      if (!rzp) {
        throw new Error('Razorpay not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
      }
      
      const order = await rzp.orders.fetch(orderId);
      return order;
    } catch (error) {
      logger.error('Razorpay order fetch failed:', error);
      throw error;
    }
  },

  async fetchRefund(refundId) {
    try {
      const rzp = initializeRazorpay();
      if (!rzp) {
        throw new Error('Razorpay not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
      }
      
      const refund = await rzp.refunds.fetch(refundId);
      return refund;
    } catch (error) {
      logger.error('Razorpay refund fetch failed:', error);
      throw error;
    }
  }
};