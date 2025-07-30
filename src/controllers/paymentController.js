import { razorpayService } from '../services/razorpayService.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

export const createOrder = async (req, res, next) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;
    
    const order = await razorpayService.createOrder({
      amount: amount * 100, // Convert to paise
      currency,
      receipt
    });
    
    logger.info(`Order created: ${order.id}`);
    res.json({ success: true, order });
  } catch (error) {
    logger.error('Error creating order:', error);
    next(error);
  }
};

export const capturePayment = async (req, res, next) => {
  try {
    const { paymentId, amount } = req.body;
    
    const payment = await razorpayService.capturePayment(paymentId, amount * 100);
    
    logger.info(`Payment captured: ${paymentId}`);
    res.json({ success: true, payment });
  } catch (error) {
    logger.error('Error capturing payment:', error);
    next(error);
  }
};

export const verifyWebhook = async (req, res, next) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      logger.error('Webhook secret not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    
    // Handle both raw and JSON body
    const body = Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');
    
    // Use timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(webhookSignature || '', 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
    
    if (isValid) {
      logger.info('Webhook verified successfully');
      
      // Parse body if it's a buffer
      const parsedBody = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
      const event = parsedBody.event;
      const paymentEntity = parsedBody.payload?.payment?.entity;
      
      logger.info(`Webhook event: ${event}`, paymentEntity);
      
      res.json({ status: 'ok' });
    } else {
      logger.error('Webhook signature verification failed', {
        received: webhookSignature,
        expected: expectedSignature
      });
      res.status(400).json({ error: 'Invalid signature' });
    }
  } catch (error) {
    logger.error('Error processing webhook:', error);
    next(error);
  }
};