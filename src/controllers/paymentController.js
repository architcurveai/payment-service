import { razorpayService } from '../services/razorpayService.js';
import { supabaseService } from '../services/supabaseService.js';
import { queueService } from '../services/queueService.js';
import { logger } from '../utils/logger.js';
import { PaymentError, ValidationError } from '../utils/errors.js';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export const createOrder = async (req, res, next) => {
  try {
    const { amount, currency = 'INR', receipt, notes = {} } = req.body;
    const userId = req.user.userId || req.user.sub;
    
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    // Generate unique receipt if not provided
    const orderReceipt = receipt || `order_${Date.now()}_${userId.slice(-8)}`;
    
    // Create order in Razorpay
    const razorpayOrder = await razorpayService.createOrder({
      amount: amount * 100, // Convert to paise
      currency,
      receipt: orderReceipt,
      notes: {
        user_id: userId,
        ...notes
      }
    });
    
    // Save order in database
    const dbOrder = await supabaseService.createPaymentOrder({
      user_id: userId,
      razorpay_order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      receipt: razorpayOrder.receipt,
      status: 'created',
      notes: razorpayOrder.notes,
      metadata: {
        created_via: 'api',
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      }
    });
    
    logger.info(`Order created: ${razorpayOrder.id}`, { userId, dbOrderId: dbOrder.id });
    
    res.status(201).json({ 
      success: true, 
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        status: razorpayOrder.status,
        created_at: razorpayOrder.created_at
      }
    });
  } catch (error) {
    logger.error('Error creating order:', error);
    next(error);
  }
};

export const capturePayment = async (req, res, next) => {
  try {
    const { paymentId, amount } = req.body;
    const userId = req.user.userId || req.user.sub;
    
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    // Verify payment belongs to user
    const dbPayment = await supabaseService.getPaymentTransaction(paymentId);
    if (!dbPayment || dbPayment.user_id !== userId) {
      throw new PaymentError('Payment not found or unauthorized', 404);
    }
    
    // Capture payment in Razorpay
    const payment = await razorpayService.capturePayment(paymentId, amount * 100);
    
    // Update payment in database
    await supabaseService.updatePaymentTransaction(paymentId, {
      status: 'captured',
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Payment captured: ${paymentId}`, { userId });
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
    
    if (!isValid) {
      logger.error('Webhook signature verification failed', {
        received: webhookSignature,
        expected: expectedSignature
      });
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Parse body if it's a buffer
    const parsedBody = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
    const event = parsedBody.event;
    const eventId = parsedBody.id || uuidv4();
    
    logger.info('Webhook verified successfully', { event, eventId });
    
    // Check for duplicate webhook events
    const existingEvent = await supabaseService.getWebhookEvent(eventId);
    if (existingEvent) {
      logger.warn('Duplicate webhook event received', { event, eventId });
      return res.json({ status: 'ok', message: 'duplicate event' });
    }
    
    // Store webhook event in database
    await supabaseService.createWebhookEvent({
      razorpay_event_id: eventId,
      event_type: event,
      entity_type: parsedBody.payload ? Object.keys(parsedBody.payload)[0] : 'unknown',
      entity_id: parsedBody.payload?.payment?.entity?.id || 
                 parsedBody.payload?.order?.entity?.id || 
                 parsedBody.payload?.refund?.entity?.id || 'unknown',
      payload: parsedBody,
      processed: false
    });
    
    // Add to processing queue for async handling
    await queueService.addWebhookEvent({
      event,
      payload: parsedBody.payload,
      eventId
    });
    
    // Respond immediately to Razorpay
    res.json({ status: 'ok' });
    
  } catch (error) {
    logger.error('Error processing webhook:', error);
    next(error);
  }
};

// Get payment status
export const getPaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId || req.user.sub;
    
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    // Get order from database
    const dbOrder = await supabaseService.getPaymentOrder(orderId);
    if (!dbOrder || dbOrder.user_id !== userId) {
      throw new PaymentError('Order not found or unauthorized', 404);
    }
    
    // Get latest order status from Razorpay
    const razorpayOrder = await razorpayService.fetchOrder(orderId);
    
    // Update order status in database if different
    if (dbOrder.status !== razorpayOrder.status) {
      await supabaseService.updatePaymentOrder(orderId, {
        status: razorpayOrder.status,
        updated_at: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        status: razorpayOrder.status,
        created_at: razorpayOrder.created_at,
        attempts: razorpayOrder.attempts,
        notes: razorpayOrder.notes
      }
    });
  } catch (error) {
    logger.error('Error getting payment status:', error);
    next(error);
  }
};

// Get user payment history
export const getUserPayments = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.sub;
    const { limit = 10, offset = 0 } = req.query;
    
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const payments = await supabaseService.getUserPaymentOrders(
      userId, 
      parseInt(limit), 
      parseInt(offset)
    );
    
    res.json({
      success: true,
      payments,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: payments.length
      }
    });
  } catch (error) {
    logger.error('Error getting user payments:', error);
    next(error);
  }
};

// Create refund
export const createRefund = async (req, res, next) => {
  try {
    const { paymentId, amount, reason, receipt } = req.body;
    const userId = req.user.userId || req.user.sub;
    
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    // Verify payment belongs to user
    const dbPayment = await supabaseService.getPaymentTransaction(paymentId);
    if (!dbPayment || dbPayment.user_id !== userId) {
      throw new PaymentError('Payment not found or unauthorized', 404);
    }
    
    // Create refund in Razorpay
    const refund = await razorpayService.refundPayment(paymentId, {
      amount: amount ? amount * 100 : undefined, // Convert to paise if partial refund
      receipt,
      notes: {
        reason,
        user_id: userId
      }
    });
    
    // Store refund in database
    await supabaseService.createRefund({
      user_id: userId,
      razorpay_refund_id: refund.id,
      razorpay_payment_id: paymentId,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status,
      speed: refund.speed,
      receipt: refund.receipt,
      notes: refund.notes || {}
    });
    
    logger.info(`Refund created: ${refund.id}`, { userId, paymentId });
    res.status(201).json({ success: true, refund });
  } catch (error) {
    logger.error('Error creating refund:', error);
    next(error);
  }
};

// Verify payment signature (for frontend verification)
export const verifyPaymentSignature = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user.userId || req.user.sub;
    
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    // Verify order belongs to user
    const dbOrder = await supabaseService.getPaymentOrder(razorpay_order_id);
    if (!dbOrder || dbOrder.user_id !== userId) {
      throw new PaymentError('Order not found or unauthorized', 404);
    }
    
    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');
    
    const isValid = crypto.timingSafeEqual(
      Buffer.from(razorpay_signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
    
    if (isValid) {
      // Create or update payment transaction
      try {
        await supabaseService.createPaymentTransaction({
          user_id: userId,
          razorpay_payment_id,
          razorpay_order_id,
          amount: dbOrder.amount,
          currency: dbOrder.currency,
          status: 'authorized',
          notes: {}
        });
      } catch (error) {
        // Payment might already exist, update it
        await supabaseService.updatePaymentTransaction(razorpay_payment_id, {
          status: 'authorized',
          updated_at: new Date().toISOString()
        });
      }
      
      // Update order status
      await supabaseService.updatePaymentOrder(razorpay_order_id, {
        status: 'attempted',
        updated_at: new Date().toISOString()
      });
      
      logger.info(`Payment signature verified: ${razorpay_payment_id}`, { userId });
      res.json({ success: true, verified: true });
    } else {
      logger.warn(`Payment signature verification failed: ${razorpay_payment_id}`, { userId });
      res.status(400).json({ success: false, verified: false, error: 'Invalid signature' });
    }
  } catch (error) {
    logger.error('Error verifying payment signature:', error);
    next(error);
  }
};