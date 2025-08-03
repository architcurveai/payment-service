import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

let supabase = null;

const initializeSupabase = () => {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase configuration missing. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
      throw new Error('Supabase not configured');
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

export const supabaseService = {
  // Payment Orders
  async createPaymentOrder(orderData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('payment_orders')
        .insert([orderData])
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Payment order created in DB: ${data.id}`);
      return data;
    } catch (error) {
      logger.error('Error creating payment order in DB:', error);
      throw error;
    }
  },

  async updatePaymentOrder(orderId, updateData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('payment_orders')
        .update(updateData)
        .eq('razorpay_order_id', orderId)
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Payment order updated in DB: ${orderId}`);
      return data;
    } catch (error) {
      logger.error('Error updating payment order in DB:', error);
      throw error;
    }
  },

  async getPaymentOrder(orderId) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('payment_orders')
        .select('*')
        .eq('razorpay_order_id', orderId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching payment order from DB:', error);
      throw error;
    }
  },

  async getUserPaymentOrders(userId, limit = 10, offset = 0) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('payment_orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching user payment orders from DB:', error);
      throw error;
    }
  },

  // Payment Transactions
  async createPaymentTransaction(transactionData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('payment_transactions')
        .insert([transactionData])
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Payment transaction created in DB: ${data.id}`);
      return data;
    } catch (error) {
      logger.error('Error creating payment transaction in DB:', error);
      throw error;
    }
  },

  async updatePaymentTransaction(paymentId, updateData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('payment_transactions')
        .update(updateData)
        .eq('razorpay_payment_id', paymentId)
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Payment transaction updated in DB: ${paymentId}`);
      return data;
    } catch (error) {
      logger.error('Error updating payment transaction in DB:', error);
      throw error;
    }
  },

  async getPaymentTransaction(paymentId) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('payment_transactions')
        .select('*')
        .eq('razorpay_payment_id', paymentId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching payment transaction from DB:', error);
      throw error;
    }
  },

  // Webhook Events
  async createWebhookEvent(eventData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('webhook_events')
        .insert([eventData])
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Webhook event created in DB: ${data.id}`);
      return data;
    } catch (error) {
      logger.error('Error creating webhook event in DB:', error);
      throw error;
    }
  },

  async getWebhookEvent(eventId) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('webhook_events')
        .select('*')
        .eq('razorpay_event_id', eventId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
      return data;
    } catch (error) {
      logger.error('Error fetching webhook event from DB:', error);
      throw error;
    }
  },

  // Refunds
  async createRefund(refundData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('payment_refunds')
        .insert([refundData])
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Refund created in DB: ${data.id}`);
      return data;
    } catch (error) {
      logger.error('Error creating refund in DB:', error);
      throw error;
    }
  },

  async updateRefund(refundId, updateData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('payment_refunds')
        .update(updateData)
        .eq('razorpay_refund_id', refundId)
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Refund updated in DB: ${refundId}`);
      return data;
    } catch (error) {
      logger.error('Error updating refund in DB:', error);
      throw error;
    }
  },

  // Dispute Management
  async createDispute(disputeData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('payment_disputes')
        .insert([disputeData])
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Dispute created in DB: ${data.id}`);
      return data;
    } catch (error) {
      logger.error('Error creating dispute in DB:', error);
      throw error;
    }
  },

  async updateDispute(disputeId, updateData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('payment_disputes')
        .update(updateData)
        .eq('dispute_id', disputeId)
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Dispute updated in DB: ${disputeId}`);
      return data;
    } catch (error) {
      logger.error('Error updating dispute in DB:', error);
      throw error;
    }
  },

  // Downtime Events
  async createDowntimeEvent(downtimeData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('downtime_events')
        .insert([downtimeData])
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Downtime event created in DB: ${data.id}`);
      return data;
    } catch (error) {
      logger.error('Error creating downtime event in DB:', error);
      throw error;
    }
  },

  async updateDowntimeEvent(downtimeId, updateData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('downtime_events')
        .update(updateData)
        .eq('razorpay_downtime_id', downtimeId)
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Downtime event updated in DB: ${downtimeId}`);
      return data;
    } catch (error) {
      logger.error('Error updating downtime event in DB:', error);
      throw error;
    }
  },

  // Invoice Events
  async createInvoiceEvent(invoiceData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('invoice_events')
        .insert([invoiceData])
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Invoice event created in DB: ${data.id}`);
      return data;
    } catch (error) {
      logger.error('Error creating invoice event in DB:', error);
      throw error;
    }
  },

  async updateInvoiceEvent(invoiceId, updateData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('invoice_events')
        .update(updateData)
        .eq('razorpay_invoice_id', invoiceId)
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Invoice event updated in DB: ${invoiceId}`);
      return data;
    } catch (error) {
      logger.error('Error updating invoice event in DB:', error);
      throw error;
    }
  },

  // Fund Account Events
  async createFundAccountEvent(fundAccountData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('fund_account_events')
        .insert([fundAccountData])
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Fund account event created in DB: ${data.id}`);
      return data;
    } catch (error) {
      logger.error('Error creating fund account event in DB:', error);
      throw error;
    }
  },

  async updateFundAccountEvent(fundAccountId, updateData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('fund_account_events')
        .update(updateData)
        .eq('razorpay_fund_account_id', fundAccountId)
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Fund account event updated in DB: ${fundAccountId}`);
      return data;
    } catch (error) {
      logger.error('Error updating fund account event in DB:', error);
      throw error;
    }
  },

  // Account Events
  async createAccountEvent(accountData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('account_events')
        .insert([accountData])
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Account event created in DB: ${data.id}`);
      return data;
    } catch (error) {
      logger.error('Error creating account event in DB:', error);
      throw error;
    }
  },

  async updateAccountEvent(accountId, updateData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('account_events')
        .update(updateData)
        .eq('razorpay_account_id', accountId)
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Account event updated in DB: ${accountId}`);
      return data;
    } catch (error) {
      logger.error('Error updating account event in DB:', error);
      throw error;
    }
  },

  // Payment Link Events
  async createPaymentLinkEvent(paymentLinkData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('payment_link_events')
        .insert([paymentLinkData])
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Payment link event created in DB: ${data.id}`);
      return data;
    } catch (error) {
      logger.error('Error creating payment link event in DB:', error);
      throw error;
    }
  },

  async updatePaymentLinkEvent(paymentLinkId, updateData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('payment_link_events')
        .update(updateData)
        .eq('razorpay_payment_link_id', paymentLinkId)
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Payment link event updated in DB: ${paymentLinkId}`);
      return data;
    } catch (error) {
      logger.error('Error updating payment link event in DB:', error);
      throw error;
    }
  },

  // Webhook Events
  async updateWebhookEvent(eventId, updateData) {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('webhook_events')
        .update(updateData)
        .eq('razorpay_event_id', eventId)
        .select()
        .single();
      
      if (error) throw error;
      logger.info(`Webhook event updated in DB: ${eventId}`);
      return data;
    } catch (error) {
      logger.error('Error updating webhook event in DB:', error);
      throw error;
    }
  },

  // Health Check
  async healthCheck() {
    try {
      const client = initializeSupabase();
      const { data, error } = await client
        .from('payment_orders')
        .select('count')
        .limit(1);
      
      if (error) throw error;
      return { status: 'OK', service: 'supabase' };
    } catch (error) {
      logger.error('Supabase health check failed:', error);
      throw error;
    }
  }
};