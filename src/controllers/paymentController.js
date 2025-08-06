import { razorpayService } from '../services/razorpayService.js';
import { supabaseService } from '../services/supabaseService.js';
import { queueService } from '../services/queueService.js';
import { logger } from '../utils/logger.js';
import { PaymentError, ValidationError } from '../utils/errors.js';
import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';


export const createOrder = async (req, res, next) => {
  try {
    const { 
      amount, 
      currency = 'INR', 
      receipt, 
      notes = {},
      user_uuid,  // NEW: UUID from frontend
      customer_info = {} // Optional customer details
    } = req.body;
    
    const userId = req.user?.userId || req.user?.sub;

    // Validate UUID if provided (for frontend integration)
    if (user_uuid) {
      if (typeof user_uuid !== 'string') {
        throw new ValidationError('user_uuid must be a string');
      }
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(user_uuid)) {
        throw new ValidationError('Invalid UUID format');
      }
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new ValidationError('Valid amount is required');
    }

    const supportedCurrencies = ['INR', 'USD', 'EUR']; // Add your supported currencies
    if (!supportedCurrencies.includes(currency)) {
      throw new ValidationError(`Currency must be one of: ${supportedCurrencies.join(', ')}`);
    }

    // Generate unique receipt if not provided
    const orderReceipt = receipt || `order_${Date.now()}_${user_uuid ? user_uuid.slice(0, 8) : uuidv4().slice(0, 8)}`;

    // Create order in Razorpay
    const razorpayOrder = await razorpayService.createOrder({
      amount: amount * 100, // Convert to paise
      currency,
      receipt: orderReceipt,
      notes: {
        user_uuid: user_uuid || null,
        ip_address: req.headers['x-forwarded-for']?.split(',')[0] || req.ip,
        ...notes
      }
    });
    
    // Save order in database
    const dbOrder = await supabaseService.createPaymentOrder({
      user_id: userId,
      user_uuid: user_uuid || null, // Store UUID from frontend
      razorpay_order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      receipt: razorpayOrder.receipt,
      status: 'created',
      notes: razorpayOrder.notes,
      customer_info, // Store customer details
      metadata: {
        created_via: user_uuid ? 'frontend_uuid' : 'api',
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        frontend_uuid: user_uuid || null
      }
    });
    
    logger.info(`Order created: ${razorpayOrder.id}`, { 
      userId, 
      user_uuid, 
      dbOrderId: dbOrder.id 
    });
    
    res.status(201).json({ 
      success: true, 
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        status: razorpayOrder.status,
        created_at: razorpayOrder.created_at,
        user_uuid: user_uuid || null // Return UUID for frontend reference
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
    const userId = req.user?.userId || req.user?.sub;

    if (!paymentId || typeof paymentId !== 'string') {
      throw new ValidationError('Valid payment ID is required');
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new ValidationError('Valid amount is required');
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
    const userId = req.user?.userId || req.user?.sub;

    if (!orderId) {
      throw new ValidationError('Order ID is required');
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
    const { limit = 10, offset = 0 } = req.query;
    const userId = req.user?.userId || req.user?.sub;

    const payments = await supabaseService.getPaymentHistory(
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
        total: payments.length,
        total: payments.totalCount || payments.length // Assuming service returns { data: [], totalCount: n }
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
    const userId = req.user?.userId || req.user?.sub;

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
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      user_uuid // NEW: UUID from frontend
    } = req.body;
    const userId = req.user?.userId || req.user?.sub;

    // Get order from database
    const dbOrder = await supabaseService.getPaymentOrder(razorpay_order_id);
    if (!dbOrder) {
      throw new PaymentError('Order not found', 404);
    }

    // Verify ownership - either by user_id OR user_uuid
    const isAuthorized = (userId && dbOrder.user_id === userId) || 
                        (user_uuid && dbOrder.user_uuid === user_uuid);
    
    if (!isAuthorized) {
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
          user_uuid: user_uuid || dbOrder.user_uuid, // Store UUID
          razorpay_payment_id,
          razorpay_order_id,
          amount: dbOrder.amount,
          currency: dbOrder.currency,
          status: 'authorized',
          notes: { verified_with_uuid: user_uuid || null }
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
      
      logger.info(`Payment signature verified: ${razorpay_payment_id}`, { userId, user_uuid });
      res.json({ 
        success: true, 
        verified: true,
        user_uuid: user_uuid || dbOrder.user_uuid
      });
    } else {
      logger.warn(`Payment signature verification failed: ${razorpay_payment_id}`, { userId, user_uuid });
      res.status(400).json({ 
        success: false, 
        verified: false, 
        error: 'Invalid signature',
        user_uuid: user_uuid || dbOrder.user_uuid
      });
    }
  } catch (error) {
    logger.error('Error verifying payment signature:', error);
    next(error);
  }
};

// Get payment history by UUID (no authentication required)
export const getPaymentsByUUID = async (req, res, next) => {
  try {
    const { user_uuid } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    if (!user_uuid) {
      throw new ValidationError('user_uuid is required');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user_uuid)) {
      throw new ValidationError('Invalid UUID format');
    }

    const payments = await supabaseService.getPaymentHistoryByUUID(
      user_uuid,
      parseInt(limit),
      parseInt(offset)
    );
    
    res.json({
      success: true,
      user_uuid,
      payments,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: payments.length
      }
    });
  } catch (error) {
    logger.error('Error getting payments by UUID:', error);
    next(error);
  }
};

// Get payment status by UUID (no authentication required)
export const getPaymentStatusByUUID = async (req, res, next) => {
  try {
    const { user_uuid, orderId } = req.params;
    
    if (!user_uuid || !orderId) {
      throw new ValidationError('user_uuid and orderId are required');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user_uuid)) {
      throw new ValidationError('Invalid UUID format');
    }
    
    const dbOrder = await supabaseService.getPaymentOrderByUUID(orderId, user_uuid);
    if (!dbOrder) {
      throw new PaymentError('Order not found for this UUID', 404);
    }
    
    // Get latest status from Razorpay
    const razorpayOrder = await razorpayService.fetchOrder(orderId);
    
    // Update order status in database if different
    if (dbOrder.status !== razorpayOrder.status) {
      await supabaseService.updatePaymentOrderByUUID(orderId, user_uuid, {
        status: razorpayOrder.status,
        updated_at: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      user_uuid,
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
    logger.error('Error getting payment status by UUID:', error);
    next(error);
  }
};