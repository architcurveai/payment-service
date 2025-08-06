import { razorpayService } from '../services/razorpayService.js';
import { supabaseService } from '../services/supabaseService.js';
import { logger } from '../utils/logger.js';
import { PaymentError, ValidationError } from '../utils/errors.js';
import { v4 as uuidv4 } from 'uuid';

// Predefined pricing plans
const PRICING_PLANS = {
  basic: {
    name: 'Basic Plan',
    amount: 999, // ₹9.99
    currency: 'INR',
    features: ['Feature 1', 'Feature 2', 'Feature 3'],
    duration: '1 month'
  },
  premium: {
    name: 'Premium Plan',
    amount: 1999, // ₹19.99
    currency: 'INR',
    features: ['All Basic features', 'Premium Feature 1', 'Premium Feature 2'],
    duration: '1 month'
  },
  enterprise: {
    name: 'Enterprise Plan',
    amount: 4999, // ₹49.99
    currency: 'INR',
    features: ['All Premium features', 'Enterprise Support', 'Custom Integration'],
    duration: '1 month'
  }
};

// Get available pricing plans
export const getPricingPlans = async (req, res, next) => {
  try {
    res.json({
      success: true,
      plans: PRICING_PLANS
    });
  } catch (error) {
    logger.error('Error getting pricing plans:', error);
    next(error);
  }
};

// Create payment for a specific plan (for pricing page redirect)
export const createPlanPayment = async (req, res, next) => {
  try {
    const { 
      planId,
      user_uuid,
      customer_info = {},
      redirect_source = 'pricing_page' // Track where payment was initiated
    } = req.body;

    // Validate plan ID
    if (!planId || !PRICING_PLANS[planId]) {
      throw new ValidationError(`Invalid plan ID. Available plans: ${Object.keys(PRICING_PLANS).join(', ')}`);
    }

    // Validate UUID if provided
    if (user_uuid) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(user_uuid)) {
        throw new ValidationError('Invalid UUID format');
      }
    }

    const plan = PRICING_PLANS[planId];
    const userId = req.user?.userId || req.user?.sub;

    // Generate unique receipt
    const orderReceipt = `plan_${planId}_${Date.now()}_${user_uuid ? user_uuid.slice(0, 8) : uuidv4().slice(0, 8)}`;

    // Create order in Razorpay
    const razorpayOrder = await razorpayService.createOrder({
      amount: plan.amount * 100, // Convert to paise
      currency: plan.currency,
      receipt: orderReceipt,
      notes: {
        plan_id: planId,
        plan_name: plan.name,
        user_uuid: user_uuid || null,
        redirect_source,
        ip_address: req.headers['x-forwarded-for']?.split(',')[0] || req.ip,
        customer_name: customer_info.name || 'Unknown',
        customer_email: customer_info.email || 'unknown@example.com'
      }
    });

    // Save order in database with plan information
    const dbOrder = await supabaseService.createPaymentOrder({
      user_id: userId,
      user_uuid: user_uuid || null,
      razorpay_order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      receipt: razorpayOrder.receipt,
      status: 'created',
      notes: razorpayOrder.notes,
      customer_info,
      metadata: {
        plan_id: planId,
        plan_name: plan.name,
        plan_features: plan.features,
        plan_duration: plan.duration,
        created_via: 'plan_payment',
        redirect_source,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        frontend_uuid: user_uuid || null
      }
    });

    logger.info(`Plan payment order created: ${razorpayOrder.id}`, { 
      userId, 
      user_uuid, 
      planId,
      dbOrderId: dbOrder.id,
      redirect_source
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
        user_uuid: user_uuid || null
      },
      plan: {
        id: planId,
        name: plan.name,
        amount: plan.amount,
        currency: plan.currency,
        features: plan.features,
        duration: plan.duration
      },
      razorpay_key: process.env.RAZORPAY_KEY_ID // Frontend needs this for checkout
    });
  } catch (error) {
    logger.error('Error creating plan payment:', error);
    next(error);
  }
};

// Verify plan payment signature
export const verifyPlanPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      user_uuid,
      planId
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

    // Verify plan ID matches
    const orderPlanId = dbOrder.metadata?.plan_id;
    if (planId && orderPlanId !== planId) {
      throw new ValidationError('Plan ID mismatch');
    }

    // Verify signature
    const crypto = await import('node:crypto');
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
          user_uuid: user_uuid || dbOrder.user_uuid,
          razorpay_payment_id,
          razorpay_order_id,
          amount: dbOrder.amount,
          currency: dbOrder.currency,
          status: 'authorized',
          notes: { 
            verified_with_uuid: user_uuid || null,
            plan_id: orderPlanId,
            plan_name: dbOrder.metadata?.plan_name
          }
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
        status: 'paid',
        updated_at: new Date().toISOString()
      });

      logger.info(`Plan payment verified: ${razorpay_payment_id}`, { 
        userId, 
        user_uuid, 
        planId: orderPlanId 
      });

      res.json({
        success: true,
        verified: true,
        user_uuid: user_uuid || dbOrder.user_uuid,
        plan: {
          id: orderPlanId,
          name: dbOrder.metadata?.plan_name,
          amount: dbOrder.amount / 100, // Convert back from paise
          currency: dbOrder.currency
        },
        payment: {
          id: razorpay_payment_id,
          order_id: razorpay_order_id,
          status: 'authorized'
        }
      });
    } else {
      logger.warn(`Plan payment signature verification failed: ${razorpay_payment_id}`, { 
        userId, 
        user_uuid, 
        planId 
      });
      res.status(400).json({
        success: false,
        verified: false,
        error: 'Invalid signature',
        user_uuid: user_uuid || dbOrder.user_uuid
      });
    }
  } catch (error) {
    logger.error('Error verifying plan payment:', error);
    next(error);
  }
};

// Get user's plan subscription status
export const getUserPlanStatus = async (req, res, next) => {
  try {
    const { user_uuid } = req.params;
    const userId = req.user?.userId || req.user?.sub;

    if (!user_uuid && !userId) {
      throw new ValidationError('user_uuid or authentication required');
    }

    // Validate UUID format if provided
    if (user_uuid) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(user_uuid)) {
        throw new ValidationError('Invalid UUID format');
      }
    }

    // Get user's successful plan payments
    const payments = user_uuid 
      ? await supabaseService.getPaymentHistoryByUUID(user_uuid, 50, 0)
      : await supabaseService.getPaymentHistory(userId, 50, 0);

    // Filter for successful plan payments
    const planPayments = payments.filter(payment => 
      payment.status === 'paid' && 
      payment.metadata?.plan_id &&
      payment.metadata?.created_via === 'plan_payment'
    );

    // Get current active plan (most recent successful payment)
    const activePlan = planPayments.length > 0 ? planPayments[0] : null;

    res.json({
      success: true,
      user_uuid: user_uuid || null,
      active_plan: activePlan ? {
        id: activePlan.metadata.plan_id,
        name: activePlan.metadata.plan_name,
        amount: activePlan.amount / 100,
        currency: activePlan.currency,
        purchased_at: activePlan.created_at,
        order_id: activePlan.razorpay_order_id
      } : null,
      plan_history: planPayments.map(payment => ({
        id: payment.metadata.plan_id,
        name: payment.metadata.plan_name,
        amount: payment.amount / 100,
        currency: payment.currency,
        purchased_at: payment.created_at,
        order_id: payment.razorpay_order_id,
        status: payment.status
      }))
    });
  } catch (error) {
    logger.error('Error getting user plan status:', error);
    next(error);
  }
};