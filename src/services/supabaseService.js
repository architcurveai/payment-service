import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

let supabase = null;

const initializeSupabase = () => {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // Check if we're in development mode with placeholder values
    const isPlaceholder = supabaseUrl?.includes('placeholder') || supabaseKey?.includes('placeholder');
    
    if (!supabaseUrl || !supabaseKey || isPlaceholder) {
      logger.warn('Supabase configuration missing or using placeholders. Running in mock mode for development.');
      // Return a mock client that doesn't actually connect
      supabase = {
        isMock: true,
        from: () => ({
          insert: () => ({ data: { id: 'mock-id' }, error: null }),
          update: () => ({ data: { id: 'mock-id' }, error: null }),
          select: () => ({ data: [], error: null }),
          delete: () => ({ data: { id: 'mock-id' }, error: null })
        })
      };
      logger.info('Supabase mock client initialized for development');
      return supabase;
    }
    
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    logger.info('Supabase initialized successfully');
  }
  return supabase;
};

const executeQuery = async (operation, tableName, logMessageFn) => {
  try {
    const client = initializeSupabase();
    
    // Handle mock client
    if (client.isMock) {
      logger.info(`Mock operation on ${tableName} - skipping actual database call`);
      const mockResult = { data: { id: `mock-${Date.now()}` }, error: null };
      if (logMessageFn) {
        logger.info(logMessageFn(mockResult.data));
      }
      return mockResult.data;
    }
    
    const { data, error } = await operation(client);

    if (error) {
      throw error;
    }

    if (logMessageFn) {
      logger.info(logMessageFn(data));
    }

    return data;
  } catch (error) {
    logger.error(`Error with ${tableName}:`, error);
    throw error;
  }
};

export const supabaseService = {
  // Payment Orders
  async createPaymentOrder(orderData) {
    return executeQuery(
      (client) => client.from('payment_orders').insert([orderData]).select().single(),
      'payment_orders',
      (data) => `Payment order created in DB: ${data.id}`
    );
  },

  async updatePaymentOrder(orderId, updateData) {
    return executeQuery(
      (client) => client.from('payment_orders').update(updateData).eq('razorpay_order_id', orderId).select().single(),
      'payment_orders',
      () => `Payment order updated in DB: ${orderId}`
    );
  },

  async getPaymentOrder(orderId) {
    return executeQuery(
      (client) => client.from('payment_orders').select('*').eq('razorpay_order_id', orderId).single(),
      'payment_orders'
    );
  },

  async getUserPaymentOrders(userId, limit = 10, offset = 0) {
    return executeQuery(
      (client) => client.from('payment_orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }).range(offset, offset + limit - 1),
      'payment_orders'
    );
  },

  // Payment Transactions
  async createPaymentTransaction(transactionData) {
    return executeQuery(
      (client) => client.from('payment_transactions').insert([transactionData]).select().single(),
      'payment_transactions',
      (data) => `Payment transaction created in DB: ${data.id}`
    );
  },

  async updatePaymentTransaction(paymentId, updateData) {
    return executeQuery(
      (client) => client.from('payment_transactions').update(updateData).eq('razorpay_payment_id', paymentId).select().single(),
      'payment_transactions',
      () => `Payment transaction updated in DB: ${paymentId}`
    );
  },

  async getPaymentTransaction(paymentId) {
    return executeQuery(
      (client) => client.from('payment_transactions').select('*').eq('razorpay_payment_id', paymentId).single(),
      'payment_transactions'
    );
  },

  // Webhook Events
  async createWebhookEvent(eventData) {
    return executeQuery(
      (client) => client.from('webhook_events').insert([eventData]).select().single(),
      'webhook_events',
      (data) => `Webhook event created in DB: ${data.id}`
    );
  },

  async getWebhookEvent(eventId) {
    return executeQuery(
      (client) => client.from('webhook_events').select('*').eq('razorpay_event_id', eventId).single(),
      'webhook_events'
    );
  },

  async updateWebhookEvent(eventId, updateData) {
    return executeQuery(
      (client) => client.from('webhook_events').update(updateData).eq('razorpay_event_id', eventId).select().single(),
      'webhook_events',
      () => `Webhook event updated in DB: ${eventId}`
    );
  },

  // Refunds
  async createRefund(refundData) {
    return executeQuery(
      (client) => client.from('payment_refunds').insert([refundData]).select().single(),
      'payment_refunds',
      (data) => `Refund created in DB: ${data.id}`
    );
  },

  async updateRefund(refundId, updateData) {
    return executeQuery(
      (client) => client.from('payment_refunds').update(updateData).eq('razorpay_refund_id', refundId).select().single(),
      'payment_refunds',
      () => `Refund updated in DB: ${refundId}`
    );
  },

  // Dispute Management
  async createDispute(disputeData) {
    return executeQuery(
      (client) => client.from('payment_disputes').insert([disputeData]).select().single(),
      'payment_disputes',
      (data) => `Dispute created in DB: ${data.id}`
    );
  },

  async updateDispute(disputeId, updateData) {
    return executeQuery(
      (client) => client.from('payment_disputes').update(updateData).eq('dispute_id', disputeId).select().single(),
      'payment_disputes',
      () => `Dispute updated in DB: ${disputeId}`
    );
  },

  // Downtime Events
  async createDowntimeEvent(downtimeData) {
    return executeQuery(
      (client) => client.from('downtime_events').insert([downtimeData]).select().single(),
      'downtime_events',
      (data) => `Downtime event created in DB: ${data.id}`
    );
  },

  async updateDowntimeEvent(downtimeId, updateData) {
    return executeQuery(
      (client) => client.from('downtime_events').update(updateData).eq('razorpay_downtime_id', downtimeId).select().single(),
      'downtime_events',
      () => `Downtime event updated in DB: ${downtimeId}`
    );
  },

  // Invoice Events
  async createInvoiceEvent(invoiceData) {
    return executeQuery(
      (client) => client.from('invoice_events').insert([invoiceData]).select().single(),
      'invoice_events',
      (data) => `Invoice event created in DB: ${data.id}`
    );
  },

  async updateInvoiceEvent(invoiceId, updateData) {
    return executeQuery(
      (client) => client.from('invoice_events').update(updateData).eq('razorpay_invoice_id', invoiceId).select().single(),
      'invoice_events',
      () => `Invoice event updated in DB: ${invoiceId}`
    );
  },

  // Fund Account Events
  async createFundAccountEvent(fundAccountData) {
    return executeQuery(
      (client) => client.from('fund_account_events').insert([fundAccountData]).select().single(),
      'fund_account_events',
      (data) => `Fund account event created in DB: ${data.id}`
    );
  },

  async updateFundAccountEvent(fundAccountId, updateData) {
    return executeQuery(
      (client) => client.from('fund_account_events').update(updateData).eq('razorpay_fund_account_id', fundAccountId).select().single(),
      'fund_account_events',
      () => `Fund account event updated in DB: ${fundAccountId}`
    );
  },

  // Account Events
  async createAccountEvent(accountData) {
    return executeQuery(
      (client) => client.from('account_events').insert([accountData]).select().single(),
      'account_events',
      (data) => `Account event created in DB: ${data.id}`
    );
  },

  async updateAccountEvent(accountId, updateData) {
    return executeQuery(
      (client) => client.from('account_events').update(updateData).eq('razorpay_account_id', accountId).select().single(),
      'account_events',
      () => `Account event updated in DB: ${accountId}`
    );
  },

  // Payment Link Events
  async createPaymentLinkEvent(paymentLinkData) {
    return executeQuery(
      (client) => client.from('payment_link_events').insert([paymentLinkData]).select().single(),
      'payment_link_events',
      (data) => `Payment link event created in DB: ${data.id}`
    );
  },

  async updatePaymentLinkEvent(paymentLinkId, updateData) {
    return executeQuery(
      (client) => client.from('payment_link_events').update(updateData).eq('razorpay_payment_link_id', paymentLinkId).select().single(),
      'payment_link_events',
      () => `Payment link event updated in DB: ${paymentLinkId}`
    );
  },

  // UUID-based payment order operations
  async getPaymentOrderByUUID(orderId, userUuid) {
    return executeQuery(
      (client) => client
        .from('payment_orders')
        .select('*')
        .eq('razorpay_order_id', orderId)
        .eq('user_uuid', userUuid)
        .single(),
      'payment_orders'
    );
  },

  async updatePaymentOrderByUUID(orderId, userUuid, updateData) {
    return executeQuery(
      (client) => client
        .from('payment_orders')
        .update(updateData)
        .eq('razorpay_order_id', orderId)
        .eq('user_uuid', userUuid)
        .select()
        .single(),
      'payment_orders',
      () => `Payment order updated for UUID ${userUuid}: ${orderId}`
    );
  },

  async getPaymentHistoryByUUID(userUuid, limit = 10, offset = 0) {
    return executeQuery(
      (client) => client
        .from('payment_orders')
        .select(`
          *,
          payment_transactions (*)
        `)
        .eq('user_uuid', userUuid)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      'payment_orders'
    );
  },

  // UUID-based payment transaction operations
  async updatePaymentTransactionByUUID(paymentId, userUuid, updateData) {
    return executeQuery(
      (client) => client
        .from('payment_transactions')
        .update(updateData)
        .eq('razorpay_payment_id', paymentId)
        .eq('user_uuid', userUuid)
        .select()
        .single(),
      'payment_transactions',
      () => `Payment transaction updated for UUID ${userUuid}: ${paymentId}`
    );
  },

  async getPaymentTransactionsByUUID(userUuid, limit = 10, offset = 0) {
    return executeQuery(
      (client) => client
        .from('payment_transactions')
        .select('*')
        .eq('user_uuid', userUuid)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      'payment_transactions'
    );
  },

  // Health Check
  async healthCheck() {
    try {
      const client = initializeSupabase();
      const { error } = await client.from('payment_orders').select('id', { count: 'exact', head: true });
      if (error) throw error;
      return { status: 'OK', service: 'supabase' };
    } catch (error) {
      logger.error('Supabase health check failed:', error);
      throw error;
    }
  }
};