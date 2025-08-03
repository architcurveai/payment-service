-- Supabase Database Schema for Razorpay Payment Integration
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Payment Orders Table
CREATE TABLE IF NOT EXISTS payment_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    razorpay_order_id VARCHAR(255) UNIQUE NOT NULL,
    amount INTEGER NOT NULL, -- Amount in smallest currency unit (paise for INR)
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    receipt VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'created', -- created, attempted, paid, failed
    notes JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Transactions Table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES payment_orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    razorpay_payment_id VARCHAR(255) UNIQUE NOT NULL,
    razorpay_order_id VARCHAR(255) NOT NULL,
    amount INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(50) NOT NULL, -- created, authorized, captured, refunded, failed
    method VARCHAR(50), -- card, netbanking, wallet, upi, etc.
    bank VARCHAR(100),
    wallet VARCHAR(100),
    vpa VARCHAR(255), -- For UPI
    email VARCHAR(255),
    contact VARCHAR(20),
    fee INTEGER DEFAULT 0,
    tax INTEGER DEFAULT 0,
    error_code VARCHAR(100),
    error_description TEXT,
    error_source VARCHAR(100),
    error_step VARCHAR(100),
    error_reason VARCHAR(100),
    acquirer_data JSONB DEFAULT '{}',
    notes JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Refunds Table
CREATE TABLE IF NOT EXISTS payment_refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES payment_transactions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    razorpay_refund_id VARCHAR(255) UNIQUE NOT NULL,
    razorpay_payment_id VARCHAR(255) NOT NULL,
    amount INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(50) NOT NULL, -- pending, processed, failed
    speed VARCHAR(20) DEFAULT 'normal', -- normal, optimum
    receipt VARCHAR(255),
    notes JSONB DEFAULT '{}',
    acquirer_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhook Events Table
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razorpay_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- payment, order, refund, etc.
    entity_id VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Disputes Table
CREATE TABLE IF NOT EXISTS payment_disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES payment_transactions(id) ON DELETE CASCADE,
    razorpay_payment_id VARCHAR(255) NOT NULL,
    dispute_id VARCHAR(255) UNIQUE NOT NULL,
    amount INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(50) NOT NULL, -- created, won, lost, closed, under_review, action_required
    reason_code VARCHAR(100),
    reason_description TEXT,
    respond_by TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    evidence JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Downtime Events Table
CREATE TABLE IF NOT EXISTS downtime_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razorpay_downtime_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL, -- started, updated, resolved
    method VARCHAR(50), -- card, netbanking, upi, etc.
    begin TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    severity VARCHAR(20), -- high, medium, low
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoice Events Table
CREATE TABLE IF NOT EXISTS invoice_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razorpay_invoice_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL, -- paid, partially_paid, expired
    amount INTEGER NOT NULL,
    amount_paid INTEGER DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    customer_id VARCHAR(255),
    paid_at TIMESTAMP WITH TIME ZONE,
    expired_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fund Account Events Table
CREATE TABLE IF NOT EXISTS fund_account_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razorpay_fund_account_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL, -- validation_completed, validation_failed
    account_type VARCHAR(50), -- bank_account, vpa, card
    bank_account JSONB,
    validation_id VARCHAR(255),
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Account Events Table
CREATE TABLE IF NOT EXISTS account_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razorpay_account_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL, -- instantly_activated, activated_kyc_pending
    activated_at TIMESTAMP WITH TIME ZONE,
    kyc_pending_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Link Events Table
CREATE TABLE IF NOT EXISTS payment_link_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razorpay_payment_link_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL, -- paid, partially_paid, expired, cancelled
    amount INTEGER NOT NULL,
    amount_paid INTEGER DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    customer_id VARCHAR(255),
    paid_at TIMESTAMP WITH TIME ZONE,
    expired_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_orders_razorpay_order_id ON payment_orders(razorpay_order_id);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_razorpay_payment_id ON payment_transactions(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_razorpay_order_id ON payment_transactions(razorpay_order_id);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_user_id ON payment_refunds(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_status ON payment_refunds(status);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_razorpay_refund_id ON payment_refunds(razorpay_refund_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_razorpay_event_id ON webhook_events(razorpay_event_id);

CREATE INDEX IF NOT EXISTS idx_payment_disputes_payment_id ON payment_disputes(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_status ON payment_disputes(status);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_dispute_id ON payment_disputes(dispute_id);

CREATE INDEX IF NOT EXISTS idx_downtime_events_status ON downtime_events(status);
CREATE INDEX IF NOT EXISTS idx_downtime_events_method ON downtime_events(method);
CREATE INDEX IF NOT EXISTS idx_downtime_events_created_at ON downtime_events(created_at);

CREATE INDEX IF NOT EXISTS idx_invoice_events_status ON invoice_events(status);
CREATE INDEX IF NOT EXISTS idx_invoice_events_razorpay_invoice_id ON invoice_events(razorpay_invoice_id);

CREATE INDEX IF NOT EXISTS idx_fund_account_events_status ON fund_account_events(status);
CREATE INDEX IF NOT EXISTS idx_fund_account_events_razorpay_fund_account_id ON fund_account_events(razorpay_fund_account_id);

CREATE INDEX IF NOT EXISTS idx_account_events_status ON account_events(status);
CREATE INDEX IF NOT EXISTS idx_account_events_razorpay_account_id ON account_events(razorpay_account_id);

CREATE INDEX IF NOT EXISTS idx_payment_link_events_status ON payment_link_events(status);
CREATE INDEX IF NOT EXISTS idx_payment_link_events_razorpay_payment_link_id ON payment_link_events(razorpay_payment_link_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payment_orders_updated_at BEFORE UPDATE ON payment_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_refunds_updated_at BEFORE UPDATE ON payment_refunds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_orders
CREATE POLICY "Users can view their own payment orders" ON payment_orders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all payment orders" ON payment_orders
    FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for payment_transactions
CREATE POLICY "Users can view their own payment transactions" ON payment_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all payment transactions" ON payment_transactions
    FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for payment_refunds
CREATE POLICY "Users can view their own payment refunds" ON payment_refunds
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all payment refunds" ON payment_refunds
    FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for webhook_events (service role only)
CREATE POLICY "Service role can manage all webhook events" ON webhook_events
    FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for audit_logs
CREATE POLICY "Users can view their own audit logs" ON audit_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all audit logs" ON audit_logs
    FOR ALL USING (auth.role() = 'service_role');