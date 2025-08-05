import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../utils/logger.js';
import { supabaseService } from './supabaseService.js';
import { razorpayService } from './razorpayService.js';
import { addQueueToBullBoard } from './bullBoardService.js';

let paymentQueue = null;
let webhookWorker = null;
let paymentWorker = null;
let refundWorker = null;
let queueEvents = null;
let redisConnection = null;

const initializeRedis = () => {
  if (!redisConnection) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    // Parse Redis URL for Redis Cloud compatibility
    let redisConfig;
    
    if (redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://')) {
      // For Redis Cloud URLs like: redis://username:password@host:port
      // or rediss://username:password@host:port (SSL)
      redisConfig = redisUrl;
    } else {
      // Fallback for custom configurations
      redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        username: process.env.REDIS_USERNAME,
      };
    }
    
    redisConnection = new IORedis(redisConfig, {
      // Redis Cloud optimized settings
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
      
      // Redis Cloud SSL/TLS support
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
      
      // Connection pool settings for Redis Cloud
      family: 4, // IPv4
      keepAlive: true,
      
      // Retry strategy for Redis Cloud
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis connection retry attempt ${times}, delay: ${delay}ms`);
        return delay;
      },
      
      // Reconnect on failure
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      },
    });
    
    redisConnection.on('connect', () => {
      logger.info('Redis connected successfully to Redis Cloud');
    });
    
    redisConnection.on('ready', () => {
      logger.info('Redis ready for commands');
    });
    
    redisConnection.on('error', (error) => {
      logger.error('Redis connection error:', error.message);
    });
    
    redisConnection.on('close', () => {
      logger.warn('Redis connection closed');
    });
    
    redisConnection.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });
  }
  return redisConnection;
};

const initializeQueue = () => {
  if (!paymentQueue) {
    const redis = initializeRedis();
    const queueName = process.env.QUEUE_NAME || 'payment_processing';
    
    paymentQueue = new Queue(queueName, {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        // Redis Cloud optimized job options
        delay: 0,
        priority: 0,
        // Prevent job stalling in Redis Cloud
        jobId: undefined, // Let BullMQ generate unique IDs
      },
      // Redis Cloud specific queue settings
      settings: {
        stalledInterval: 30000, // 30 seconds
        maxStalledCount: 1,
      },
    });

    // Initialize workers with Redis Cloud optimizations
    webhookWorker = new Worker(queueName, async (job) => {
      switch (job.name) {
        case 'webhook_event':
          return await processWebhookEvent(job.data);
        case 'payment_status_update':
          return await processPaymentStatusUpdate(job.data);
        case 'refund_event':
          return await processRefundEvent(job.data);
        case 'dispute_event':
          return await processDisputeEvent(job.data);
        case 'invoice_event':
          return await processInvoiceEvent(job.data);
        case 'payment_link_event':
          return await processPaymentLinkEvent(job.data);
        case 'account_event':
          return await processAccountEvent(job.data);
        case 'fund_account_event':
          return await processFundAccountEvent(job.data);
        case 'downtime_event':
          return await processDowntimeEvent(job.data);
        default:
          logger.warn(`Unknown job type: ${job.name}`);
          return { success: false, error: 'Unknown job type' };
      }
    }, {
      connection: redis,
      // Redis Cloud optimized worker settings
      concurrency: parseInt(process.env.QUEUE_CONCURRENCY) || 5,
      removeOnComplete: 100,
      removeOnFail: 50,
      
      // Redis Cloud specific worker settings
      settings: {
        stalledInterval: 30000, // 30 seconds
        maxStalledCount: 1,
        retryProcessDelay: 5000, // 5 seconds between retries
      },
      
      // Connection settings for Redis Cloud
      autorun: true,
      useWorkerThreads: false, // Better for Redis Cloud
    });

    // Queue events for monitoring
    queueEvents = new QueueEvents(queueName, { connection: redis });
    
    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      logger.info(`Job ${jobId} completed successfully`, returnvalue);
    });
    
    queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error(`Job ${jobId} failed:`, failedReason);
    });

    logger.info('BullMQ payment queue initialized successfully');
    
    // Add queue to Bull Board dashboard
    addQueueToBullBoard(paymentQueue);
  }
  return paymentQueue;
};

const webhookEventHandlers = {
  'payment.authorized': handlePaymentAuthorized,
  'payment.captured': handlePaymentCaptured,
  'payment.failed': handlePaymentFailed,
  'order.paid': handleOrderPaid,
  'order.notification.delivered': handleOrderNotificationDelivered,
  'order.notification.failed': handleOrderNotificationFailed,
  'refund.created': handleRefundCreated,
  'refund.processed': handleRefundProcessed,
  'refund.failed': handleRefundFailed,
  'refund.speed_changed': handleRefundSpeedChanged,
  'payment.dispute.created': handleDisputeCreated,
  'payment.dispute.won': handleDisputeWon,
  'payment.dispute.lost': handleDisputeLost,
  'payment.dispute.closed': handleDisputeClosed,
  'payment.dispute.under_review': handleDisputeUnderReview,
  'payment.dispute.action_required': handleDisputeActionRequired,
  'payment.downtime.started': handleDowntimeStarted,
  'payment.downtime.updated': handleDowntimeUpdated,
  'payment.downtime.resolved': handleDowntimeResolved,
  'invoice.paid': handleInvoicePaid,
  'invoice.partially_paid': handleInvoicePartiallyPaid,
  'invoice.expired': handleInvoiceExpired,
  'fund_account.validation.completed': handleFundAccountValidationCompleted,
  'fund_account.validation.failed': handleFundAccountValidationFailed,
  'account.instantly_activated': handleAccountInstantlyActivated,
  'account.activated_kyc_pending': handleAccountActivatedKycPending,
  'payment_link.paid': handlePaymentLinkPaid,
  'payment_link.partially_paid': handlePaymentLinkPartiallyPaid,
  'payment_link.expired': handlePaymentLinkExpired,
  'payment_link.cancelled': handlePaymentLinkCancelled,
};

const processWebhookEvent = async (eventData) => {
  try {
    const { event, payload, eventId } = eventData;
    
    logger.info(`Processing webhook event: ${event}`, { eventId });

    const handler = webhookEventHandlers[event];
    if (handler) {
      const payloadKey = event.split('.')[0];
      const entity = payload[payloadKey]?.entity;
      if (entity) {
        await handler(entity);
      } else {
        logger.warn(`Could not find entity for event: ${event}`, { payload });
      }
    } else {
      logger.warn(`Unhandled webhook event: ${event}`);
    }

    // Mark webhook event as processed
    await supabaseService.updateWebhookEvent(eventId, {
      processed: true,
      processed_at: new Date().toISOString()
    });

    logger.info(`Webhook event processed successfully: ${event}`, { eventId });
    return { success: true, event, eventId };
  } catch (error) {
    logger.error('Error processing webhook event:', error);
    throw error;
  }
};

const handlePaymentAuthorized = async (payment) => {
  try {
    await supabaseService.updatePaymentTransaction(payment.id, {
      status: 'authorized',
      method: payment.method,
      bank: payment.bank,
      wallet: payment.wallet,
      vpa: payment.vpa,
      email: payment.email,
      contact: payment.contact,
      fee: payment.fee,
      tax: payment.tax,
      acquirer_data: payment.acquirer_data || {},
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Payment authorized: ${payment.id}`);
  } catch (error) {
    logger.error(`Error handling payment authorized: ${payment.id}`, error);
    throw error;
  }
};

const handlePaymentCaptured = async (payment) => {
  try {
    await supabaseService.updatePaymentTransaction(payment.id, {
      status: 'captured',
      method: payment.method,
      bank: payment.bank,
      wallet: payment.wallet,
      vpa: payment.vpa,
      email: payment.email,
      contact: payment.contact,
      fee: payment.fee,
      tax: payment.tax,
      acquirer_data: payment.acquirer_data || {},
      updated_at: new Date().toISOString()
    });

    // Update order status
    await supabaseService.updatePaymentOrder(payment.order_id, {
      status: 'paid',
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Payment captured: ${payment.id}`);
  } catch (error) {
    logger.error(`Error handling payment captured: ${payment.id}`, error);
    throw error;
  }
};

const handlePaymentFailed = async (payment) => {
  try {
    await supabaseService.updatePaymentTransaction(payment.id, {
      status: 'failed',
      error_code: payment.error_code,
      error_description: payment.error_description,
      error_source: payment.error_source,
      error_step: payment.error_step,
      error_reason: payment.error_reason,
      updated_at: new Date().toISOString()
    });

    // Update order status
    await supabaseService.updatePaymentOrder(payment.order_id, {
      status: 'failed',
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Payment failed: ${payment.id}`);
  } catch (error) {
    logger.error(`Error handling payment failed: ${payment.id}`, error);
    throw error;
  }
};

const handleOrderPaid = async (order) => {
  try {
    await supabaseService.updatePaymentOrder(order.id, {
      status: 'paid',
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Order paid: ${order.id}`);
  } catch (error) {
    logger.error(`Error handling order paid: ${order.id}`, error);
    throw error;
  }
};

const handleRefundCreated = async (refund) => {
  try {
    // Get payment transaction to get user_id
    const payment = await supabaseService.getPaymentTransaction(refund.payment_id);
    
    await supabaseService.createRefund({
      user_id: payment.user_id,
      razorpay_refund_id: refund.id,
      razorpay_payment_id: refund.payment_id,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status,
      speed: refund.speed,
      receipt: refund.receipt,
      notes: refund.notes || {},
      acquirer_data: refund.acquirer_data || {}
    });
    
    logger.info(`Refund created: ${refund.id}`);
  } catch (error) {
    logger.error(`Error handling refund created: ${refund.id}`, error);
    throw error;
  }
};

const handleRefundProcessed = async (refund) => {
  try {
    await supabaseService.updateRefund(refund.id, {
      status: 'processed',
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Refund processed: ${refund.id}`);
  } catch (error) {
    logger.error(`Error handling refund processed: ${refund.id}`, error);
    throw error;
  }
};

const handleRefundFailed = async (refund) => {
  try {
    await supabaseService.updateRefund(refund.id, {
      status: 'failed',
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Refund failed: ${refund.id}`);
  } catch (error) {
    logger.error(`Error handling refund failed: ${refund.id}`, error);
    throw error;
  }
};

const handleRefundSpeedChanged = async (refund) => {
  try {
    await supabaseService.updateRefund(refund.id, {
      speed: refund.speed,
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Refund speed changed: ${refund.id} -> ${refund.speed}`);
  } catch (error) {
    logger.error(`Error handling refund speed changed: ${refund.id}`, error);
    throw error;
  }
};

// Order Event Handlers
const handleOrderNotificationDelivered = async (order) => {
  try {
    await supabaseService.updatePaymentOrder(order.id, {
      metadata: {
        notification_status: 'delivered',
        notification_delivered_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Order notification delivered: ${order.id}`);
  } catch (error) {
    logger.error(`Error handling order notification delivered: ${order.id}`, error);
    throw error;
  }
};

const handleOrderNotificationFailed = async (order) => {
  try {
    await supabaseService.updatePaymentOrder(order.id, {
      metadata: {
        notification_status: 'failed',
        notification_failed_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Order notification failed: ${order.id}`);
  } catch (error) {
    logger.error(`Error handling order notification failed: ${order.id}`, error);
    throw error;
  }
};

// Dispute Event Handlers
const handleDisputeCreated = async (payment) => {
  try {
    // Create dispute record in database
    await supabaseService.createDispute({
      razorpay_payment_id: payment.id,
      dispute_id: payment.dispute_id,
      amount: payment.amount,
      currency: payment.currency,
      status: 'created',
      reason_code: payment.dispute?.reason_code,
      reason_description: payment.dispute?.reason_description,
      respond_by: payment.dispute?.respond_by,
      created_at: new Date().toISOString()
    });
    
    // Update payment status
    await supabaseService.updatePaymentTransaction(payment.id, {
      status: 'disputed',
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Dispute created for payment: ${payment.id}`);
  } catch (error) {
    logger.error(`Error handling dispute created: ${payment.id}`, error);
    throw error;
  }
};

const handleDisputeWon = async (payment) => {
  try {
    await supabaseService.updateDispute(payment.dispute_id, {
      status: 'won',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    await supabaseService.updatePaymentTransaction(payment.id, {
      status: 'captured', // Restore to captured status
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Dispute won for payment: ${payment.id}`);
  } catch (error) {
    logger.error(`Error handling dispute won: ${payment.id}`, error);
    throw error;
  }
};

const handleDisputeLost = async (payment) => {
  try {
    await supabaseService.updateDispute(payment.dispute_id, {
      status: 'lost',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    await supabaseService.updatePaymentTransaction(payment.id, {
      status: 'dispute_lost',
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Dispute lost for payment: ${payment.id}`);
  } catch (error) {
    logger.error(`Error handling dispute lost: ${payment.id}`, error);
    throw error;
  }
};

const handleDisputeClosed = async (payment) => {
  try {
    await supabaseService.updateDispute(payment.dispute_id, {
      status: 'closed',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Dispute closed for payment: ${payment.id}`);
  } catch (error) {
    logger.error(`Error handling dispute closed: ${payment.id}`, error);
    throw error;
  }
};

const handleDisputeUnderReview = async (payment) => {
  try {
    await supabaseService.updateDispute(payment.dispute_id, {
      status: 'under_review',
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Dispute under review for payment: ${payment.id}`);
  } catch (error) {
    logger.error(`Error handling dispute under review: ${payment.id}`, error);
    throw error;
  }
};

const handleDisputeActionRequired = async (payment) => {
  try {
    await supabaseService.updateDispute(payment.dispute_id, {
      status: 'action_required',
      updated_at: new Date().toISOString()
    });
    
    // Send notification to admin/legal team
    logger.warn(`Dispute action required for payment: ${payment.id}`, {
      dispute_id: payment.dispute_id,
      respond_by: payment.dispute?.respond_by
    });
    
  } catch (error) {
    logger.error(`Error handling dispute action required: ${payment.id}`, error);
    throw error;
  }
};

// Downtime Event Handlers
const handleDowntimeStarted = async (downtime) => {
  try {
    await supabaseService.createDowntimeEvent({
      razorpay_downtime_id: downtime.id,
      status: 'started',
      method: downtime.method,
      begin: downtime.begin,
      end: downtime.end,
      severity: downtime.severity,
      created_at: new Date().toISOString()
    });
    
    logger.warn(`Payment downtime started: ${downtime.method}`, {
      severity: downtime.severity,
      begin: downtime.begin,
      end: downtime.end
    });
  } catch (error) {
    logger.error(`Error handling downtime started: ${downtime.id}`, error);
    throw error;
  }
};

const handleDowntimeUpdated = async (downtime) => {
  try {
    await supabaseService.updateDowntimeEvent(downtime.id, {
      status: 'updated',
      end: downtime.end,
      severity: downtime.severity,
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Payment downtime updated: ${downtime.id}`);
  } catch (error) {
    logger.error(`Error handling downtime updated: ${downtime.id}`, error);
    throw error;
  }
};

const handleDowntimeResolved = async (downtime) => {
  try {
    await supabaseService.updateDowntimeEvent(downtime.id, {
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Payment downtime resolved: ${downtime.id}`);
  } catch (error) {
    logger.error(`Error handling downtime resolved: ${downtime.id}`, error);
    throw error;
  }
};

// Invoice Event Handlers
const handleInvoicePaid = async (invoice) => {
  try {
    await supabaseService.createInvoiceEvent({
      razorpay_invoice_id: invoice.id,
      status: 'paid',
      amount: invoice.amount,
      amount_paid: invoice.amount_paid,
      currency: invoice.currency,
      customer_id: invoice.customer_id,
      paid_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });
    
    logger.info(`Invoice paid: ${invoice.id}`);
  } catch (error) {
    logger.error(`Error handling invoice paid: ${invoice.id}`, error);
    throw error;
  }
};

const handleInvoicePartiallyPaid = async (invoice) => {
  try {
    await supabaseService.updateInvoiceEvent(invoice.id, {
      status: 'partially_paid',
      amount_paid: invoice.amount_paid,
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Invoice partially paid: ${invoice.id} - ${invoice.amount_paid}/${invoice.amount}`);
  } catch (error) {
    logger.error(`Error handling invoice partially paid: ${invoice.id}`, error);
    throw error;
  }
};

const handleInvoiceExpired = async (invoice) => {
  try {
    await supabaseService.updateInvoiceEvent(invoice.id, {
      status: 'expired',
      expired_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Invoice expired: ${invoice.id}`);
  } catch (error) {
    logger.error(`Error handling invoice expired: ${invoice.id}`, error);
    throw error;
  }
};

// Fund Account Event Handlers
const handleFundAccountValidationCompleted = async (fundAccount) => {
  try {
    await supabaseService.createFundAccountEvent({
      razorpay_fund_account_id: fundAccount.id,
      status: 'validation_completed',
      account_type: fundAccount.account_type,
      bank_account: fundAccount.bank_account,
      validation_id: fundAccount.validation_id,
      created_at: new Date().toISOString()
    });
    
    logger.info(`Fund account validation completed: ${fundAccount.id}`);
  } catch (error) {
    logger.error(`Error handling fund account validation completed: ${fundAccount.id}`, error);
    throw error;
  }
};

const handleFundAccountValidationFailed = async (fundAccount) => {
  try {
    await supabaseService.updateFundAccountEvent(fundAccount.id, {
      status: 'validation_failed',
      failure_reason: fundAccount.failure_reason,
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Fund account validation failed: ${fundAccount.id}`);
  } catch (error) {
    logger.error(`Error handling fund account validation failed: ${fundAccount.id}`, error);
    throw error;
  }
};

// Account Event Handlers
const handleAccountInstantlyActivated = async (account) => {
  try {
    await supabaseService.createAccountEvent({
      razorpay_account_id: account.id,
      status: 'instantly_activated',
      activated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });
    
    logger.info(`Account instantly activated: ${account.id}`);
  } catch (error) {
    logger.error(`Error handling account instantly activated: ${account.id}`, error);
    throw error;
  }
};

const handleAccountActivatedKycPending = async (account) => {
  try {
    await supabaseService.updateAccountEvent(account.id, {
      status: 'activated_kyc_pending',
      kyc_pending_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Account activated with KYC pending: ${account.id}`);
  } catch (error) {
    logger.error(`Error handling account activated KYC pending: ${account.id}`, error);
    throw error;
  }
};

// Payment Link Event Handlers
const handlePaymentLinkPaid = async (paymentLink) => {
  try {
    await supabaseService.createPaymentLinkEvent({
      razorpay_payment_link_id: paymentLink.id,
      status: 'paid',
      amount: paymentLink.amount,
      amount_paid: paymentLink.amount_paid,
      currency: paymentLink.currency,
      customer_id: paymentLink.customer_id,
      paid_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });
    
    logger.info(`Payment link paid: ${paymentLink.id}`);
  } catch (error) {
    logger.error(`Error handling payment link paid: ${paymentLink.id}`, error);
    throw error;
  }
};

const handlePaymentLinkPartiallyPaid = async (paymentLink) => {
  try {
    await supabaseService.updatePaymentLinkEvent(paymentLink.id, {
      status: 'partially_paid',
      amount_paid: paymentLink.amount_paid,
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Payment link partially paid: ${paymentLink.id}`);
  } catch (error) {
    logger.error(`Error handling payment link partially paid: ${paymentLink.id}`, error);
    throw error;
  }
};

const handlePaymentLinkExpired = async (paymentLink) => {
  try {
    await supabaseService.updatePaymentLinkEvent(paymentLink.id, {
      status: 'expired',
      expired_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Payment link expired: ${paymentLink.id}`);
  } catch (error) {
    logger.error(`Error handling payment link expired: ${paymentLink.id}`, error);
    throw error;
  }
};

const handlePaymentLinkCancelled = async (paymentLink) => {
  try {
    await supabaseService.updatePaymentLinkEvent(paymentLink.id, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Payment link cancelled: ${paymentLink.id}`);
  } catch (error) {
    logger.error(`Error handling payment link cancelled: ${paymentLink.id}`, error);
    throw error;
  }
};

const processPaymentStatusUpdate = async (data) => {
  try {
    const { paymentId } = data;
    
    // Fetch latest payment status from Razorpay
    const payment = await razorpayService.fetchPayment(paymentId);
    
    // Update in database
    await supabaseService.updatePaymentTransaction(paymentId, {
      status: payment.status,
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Payment status updated: ${paymentId} -> ${payment.status}`);
    return { success: true, paymentId, status: payment.status };
  } catch (error) {
    logger.error('Error processing payment status update:', error);
    throw error;
  }
};

const processRefundEvent = async (data) => {
  try {
    const { refundId } = data;
    
    // Fetch latest refund status from Razorpay
    const refund = await razorpayService.fetchRefund(refundId);
    
    // Update in database
    await supabaseService.updateRefund(refundId, {
      status: refund.status,
      updated_at: new Date().toISOString()
    });
    
    logger.info(`Refund status updated: ${refundId} -> ${refund.status}`);
    return { success: true, refundId, status: refund.status };
  } catch (error) {
    logger.error('Error processing refund event:', error);
    throw error;
  }
};

// Additional event processors for new event types
const processDisputeEvent = async (data) => {
  try {
    const { disputeId, action } = data;
    logger.info(`Processing dispute event: ${action} for dispute ${disputeId}`);
    
    const dispute = await razorpayService.fetchDispute(disputeId);
    if (!dispute) {
      logger.error(`Dispute not found: ${disputeId}`);
      return { success: false, message: 'Dispute not found' };
    }

    switch (action) {
      case 'created':
        await handleDisputeCreated(dispute);
        break;
      case 'won':
        await handleDisputeWon(dispute);
        break;
      case 'lost':
        await handleDisputeLost(dispute);
        break;
      case 'closed':
        await handleDisputeClosed(dispute);
        break;
      default:
        logger.warn(`Unhandled dispute action: ${action}`);
    }
    
    return { success: true, disputeId, action };
  } catch (error) {
    logger.error('Error processing dispute event:', error);
    throw error;
  }
};

const processInvoiceEvent = async (data) => {
  try {
    const { invoiceId, action } = data;
    logger.info(`Processing invoice event: ${action} for invoice ${invoiceId}`);
    
    const invoice = await razorpayService.fetchInvoice(invoiceId);
    if (!invoice) {
      logger.error(`Invoice not found: ${invoiceId}`);
      return { success: false, message: 'Invoice not found' };
    }

    switch (action) {
      case 'paid':
        await handleInvoicePaid(invoice);
        break;
      case 'partially_paid':
        await handleInvoicePartiallyPaid(invoice);
        break;
      case 'expired':
        await handleInvoiceExpired(invoice);
        break;
      default:
        logger.warn(`Unhandled invoice action: ${action}`);
    }
    
    return { success: true, invoiceId, action };
  } catch (error) {
    logger.error('Error processing invoice event:', error);
    throw error;
  }
};

const processPaymentLinkEvent = async (data) => {
  try {
    const { paymentLinkId, action } = data;
    logger.info(`Processing payment link event: ${action} for payment link ${paymentLinkId}`);
    
    const paymentLink = await razorpayService.fetchPaymentLink(paymentLinkId);
    if (!paymentLink) {
      logger.error(`Payment link not found: ${paymentLinkId}`);
      return { success: false, message: 'Payment link not found' };
    }

    switch (action) {
      case 'paid':
        await handlePaymentLinkPaid(paymentLink);
        break;
      case 'partially_paid':
        await handlePaymentLinkPartiallyPaid(paymentLink);
        break;
      case 'expired':
        await handlePaymentLinkExpired(paymentLink);
        break;
      case 'cancelled':
        await handlePaymentLinkCancelled(paymentLink);
        break;
      default:
        logger.warn(`Unhandled payment link action: ${action}`);
    }
    
    return { success: true, paymentLinkId, action };
  } catch (error) {
    logger.error('Error processing payment link event:', error);
    throw error;
  }
};

const processAccountEvent = async (data) => {
  try {
    const { accountId, action } = data;
    logger.info(`Processing account event: ${action} for account ${accountId}`);
    
    // Note: Razorpay Node SDK might not have a direct fetchAccount method.
    // This is a placeholder for potential future implementation.
    logger.warn(`Processing for account event '${action}' is not fully implemented.`);
    
    return { success: true, accountId, action };
  } catch (error) {
    logger.error('Error processing account event:', error);
    throw error;
  }
};

const processFundAccountEvent = async (data) => {
  try {
    const { fundAccountId, action } = data;
    logger.info(`Processing fund account event: ${action} for fund account ${fundAccountId}`);
    
    // Note: Razorpay Node SDK might not have a direct fetchFundAccount method.
    // This is a placeholder for potential future implementation.
    logger.warn(`Processing for fund account event '${action}' is not fully implemented.`);
    
    return { success: true, fundAccountId, action };
  } catch (error) {
    logger.error('Error processing fund account event:', error);
    throw error;
  }
};

const processDowntimeEvent = async (data) => {
  try {
    const { downtimeId, action } = data;
    logger.info(`Processing downtime event: ${action} for downtime ${downtimeId}`);
    
    // Note: Razorpay Node SDK might not have a direct fetchDowntime method.
    // This is a placeholder for potential future implementation.
    logger.warn(`Processing for downtime event '${action}' is not fully implemented.`);
    
    return { success: true, downtimeId, action };
  } catch (error) {
    logger.error('Error processing downtime event:', error);
    throw error;
  }
};

export const queueService = {
  async addWebhookEvent(eventData) {
    try {
      const queue = initializeQueue();
      const job = await queue.add('webhook_event', eventData, {
        priority: 1,
        delay: 0
      });
      
      logger.info(`Webhook event queued: ${eventData.event}`, { jobId: job.id });
      return job;
    } catch (error) {
      logger.error('Error adding webhook event to queue:', error);
      throw error;
    }
  },

  async addPaymentStatusUpdate(paymentId) {
    try {
      const queue = initializeQueue();
      const job = await queue.add('payment_status_update', { paymentId }, {
        priority: 2,
        delay: 5000 // 5 second delay
      });
      
      logger.info(`Payment status update queued: ${paymentId}`, { jobId: job.id });
      return job;
    } catch (error) {
      logger.error('Error adding payment status update to queue:', error);
      throw error;
    }
  },

  async addRefundEvent(refundId) {
    try {
      const queue = initializeQueue();
      const job = await queue.add('refund_event', { refundId }, {
        priority: 2,
        delay: 0
      });
      
      logger.info(`Refund event queued: ${refundId}`, { jobId: job.id });
      return job;
    } catch (error) {
      logger.error('Error adding refund event to queue:', error);
      throw error;
    }
  },

  async getQueueStats() {
    if (!paymentQueue) return null;
    
    try {
      const waiting = await paymentQueue.getWaiting();
      const active = await paymentQueue.getActive();
      const completed = await paymentQueue.getCompleted();
      const failed = await paymentQueue.getFailed();
      
      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        total: waiting.length + active.length + completed.length + failed.length
      };
    } catch (error) {
      logger.error('Error getting queue stats:', error);
      return null;
    }
  },

  async addDisputeEvent(disputeData) {
    try {
      const queue = initializeQueue();
      const job = await queue.add('dispute_event', disputeData, {
        priority: 1, // High priority for disputes
        delay: 0
      });
      
      logger.info(`Dispute event queued: ${disputeData.action}`, { jobId: job.id });
      return job;
    } catch (error) {
      logger.error('Error adding dispute event to queue:', error);
      throw error;
    }
  },

  async addInvoiceEvent(invoiceData) {
    try {
      const queue = initializeQueue();
      const job = await queue.add('invoice_event', invoiceData, {
        priority: 3,
        delay: 0
      });
      
      logger.info(`Invoice event queued: ${invoiceData.action}`, { jobId: job.id });
      return job;
    } catch (error) {
      logger.error('Error adding invoice event to queue:', error);
      throw error;
    }
  },

  async addPaymentLinkEvent(paymentLinkData) {
    try {
      const queue = initializeQueue();
      const job = await queue.add('payment_link_event', paymentLinkData, {
        priority: 3,
        delay: 0
      });
      
      logger.info(`Payment link event queued: ${paymentLinkData.action}`, { jobId: job.id });
      return job;
    } catch (error) {
      logger.error('Error adding payment link event to queue:', error);
      throw error;
    }
  },

  async addAccountEvent(accountData) {
    try {
      const queue = initializeQueue();
      const job = await queue.add('account_event', accountData, {
        priority: 2,
        delay: 0
      });
      
      logger.info(`Account event queued: ${accountData.action}`, { jobId: job.id });
      return job;
    } catch (error) {
      logger.error('Error adding account event to queue:', error);
      throw error;
    }
  },

  async addFundAccountEvent(fundAccountData) {
    try {
      const queue = initializeQueue();
      const job = await queue.add('fund_account_event', fundAccountData, {
        priority: 2,
        delay: 0
      });
      
      logger.info(`Fund account event queued: ${fundAccountData.action}`, { jobId: job.id });
      return job;
    } catch (error) {
      logger.error('Error adding fund account event to queue:', error);
      throw error;
    }
  },

  async addDowntimeEvent(downtimeData) {
    try {
      const queue = initializeQueue();
      const job = await queue.add('downtime_event', downtimeData, {
        priority: 1, // High priority for downtime events
        delay: 0
      });
      
      logger.info(`Downtime event queued: ${downtimeData.action}`, { jobId: job.id });
      return job;
    } catch (error) {
      logger.error('Error adding downtime event to queue:', error);
      throw error;
    }
  },

  async healthCheck() {
    try {
      const redis = initializeRedis();
      await redis.ping();
      return { status: 'OK', service: 'queue' };
    } catch (error) {
      logger.error('Queue health check failed:', error);
      throw error;
    }
  },

  async gracefulShutdown() {
    try {
      logger.info('Shutting down queue workers...');
      
      if (webhookWorker) {
        await webhookWorker.close();
      }
      
      if (queueEvents) {
        await queueEvents.close();
      }
      
      if (redisConnection) {
        await redisConnection.quit();
      }
      
      logger.info('Queue workers shut down successfully');
    } catch (error) {
      logger.error('Error during queue shutdown:', error);
      throw error;
    }
  },

  // Get queue instance for Bull Board
  getQueue() {
    return paymentQueue;
  },

  async waitForQueue(timeout = 10000) {
    if (paymentQueue) {
      return paymentQueue;
    }

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (paymentQueue) {
        return paymentQueue;
      }
      await new Promise(resolve => setTimeout(resolve, 100)); // Poll every 100ms
    }

    throw new Error('Queue initialization timed out.');
  },

  // Graceful shutdown support
  async shutdown() {
    logger.info('Starting queue service shutdown...');
    
    try {
      if (webhookWorker) {
        logger.info('Closing webhook worker...');
        await webhookWorker.close();
        webhookWorker = null;
      }

      if (paymentWorker) {
        logger.info('Closing payment worker...');
        await paymentWorker.close();
        paymentWorker = null;
      }

      if (paymentQueue) {
        logger.info('Closing payment queue...');
        await paymentQueue.close();
        paymentQueue = null;
      }

      logger.info('Queue service shutdown completed');
    } catch (error) {
      logger.error('Error during queue service shutdown:', error);
      throw error;
    }
  },

  // Close Redis connections
  async closeRedisConnections() {
    try {
      if (redisConnection) {
        logger.info('Closing Redis connection...');
        await redisConnection.quit();
        redisConnection = null;
      }
      logger.info('Redis connections closed');
    } catch (error) {
      logger.error('Error closing Redis connections:', error);
      throw error;
    }
  },

  // Get Redis client for session management
  async getRedisClient() {
    if (!redisConnection) {
      await initializeQueue();
    }
    return redisConnection;
  },

  // Health check
  async healthCheck() {
    try {
      if (!redisConnection) {
        throw new Error('Redis connection not initialized');
      }

      await redisConnection.ping();
      
      const queueStats = await this.getQueueStats();
      
      return {
        status: 'OK',
        service: 'queue',
        redis: 'connected',
        queue: queueStats
      };
    } catch (error) {
      logger.error('Queue service health check failed:', error);
      throw error;
    }
  }
};