-- Supabase Database Schema for Razorpay Payment Integration
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUM Types for Statuses and Categories
CREATE TYPE payment_order_status AS ENUM ('created', 'attempted', 'paid', 'failed');
CREATE TYPE payment_link_status AS ENUM ('paid', 'partially_paid', 'expired', 'cancelled');
CREATE TYPE severity_level AS ENUM ('high', 'medium', 'low');

-- Payment Orders Table
CREATE TABLE IF NOT EXISTS payment_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    razorpay_order_id VARCHAR(255) UNIQUE NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0), -- Amount in smallest currency unit (paise for INR)
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    receipt VARCHAR(255),
    status payment_order_status NOT NULL DEFAULT 'created',
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
    amount INTEGER NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status payment_transaction_status NOT NULL,
    method VARCHAR(50), -- card, netbanking, wallet, upi, etc.
    bank VARCHAR(100),
    wallet VARCHAR(100),
    vpa VARCHAR(255), -- For UPI
    email VARCHAR(255),
    contact VARCHAR(20),
    fee INTEGER DEFAULT 0 CHECK (fee >= 0),
    tax INTEGER DEFAULT 0 CHECK (tax >= 0),
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
    amount INTEGER NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status payment_refund_status NOT NULL,
    speed VARCHAR(20) DEFAULT 'normal', -- normal, optimum
    receipt VARCHAR(255),
    notes JSONB DEFAULT '{}',
    acquirer_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Disputes Table
CREATE TABLE IF NOT EXISTS payment_disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES payment_transactions(id) ON DELETE CASCADE,
    razorpay_payment_id VARCHAR(255) NOT NULL,
    dispute_id VARCHAR(255) UNIQUE NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status payment_dispute_status NOT NULL,
    reason_code VARCHAR(100),
    reason_description TEXT,
    respond_by TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    evidence JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoice Events Table
CREATE TABLE IF NOT EXISTS invoice_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razorpay_invoice_id VARCHAR(255) UNIQUE NOT NULL,
    status invoice_status NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    amount_paid INTEGER DEFAULT 0 CHECK (amount_paid >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    customer_id VARCHAR(255),
    paid_at TIMESTAMP WITH TIME ZONE,
    expired_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Link Events Table
CREATE TABLE IF NOT EXISTS payment_link_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razorpay_payment_link_id VARCHAR(255) UNIQUE NOT NULL,
    status payment_link_status NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    amount_paid INTEGER DEFAULT 0 CHECK (amount_paid >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    customer_id VARCHAR(255),
    paid_at TIMESTAMP WITH TIME ZONE,
    expired_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
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

-- Downtime Events Table
CREATE TABLE IF NOT EXISTS downtime_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razorpay_downtime_id VARCHAR(255) UNIQUE NOT NULL,
    status downtime_status NOT NULL,
    method VARCHAR(50), -- card, netbanking, upi, etc.
    begin TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    severity severity_level, -- high, medium, low
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fund Account Events Table
CREATE TABLE IF NOT EXISTS fund_account_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    razorpay_fund_account_id VARCHAR(255) UNIQUE NOT NULL,
    status fund_account_status NOT NULL,
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
    status account_status NOT NULL,
    activated_at TIMESTAMP WITH TIME ZONE,
    kyc_pending_at TIMESTAMP WITH TIME ZONE,
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

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_user_id ON payment_refunds(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_status ON payment_refunds(status);

CREATE INDEX IF NOT EXISTS idx_payment_disputes_user_id ON payment_disputes(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_status ON payment_disputes(status);

CREATE INDEX IF NOT EXISTS idx_downtime_events_status ON downtime_events(status);
CREATE INDEX IF NOT EXISTS idx_downtime_events_severity ON downtime_events(severity);

CREATE INDEX IF NOT EXISTS idx_invoice_events_status ON invoice_events(status);

CREATE INDEX IF NOT EXISTS idx_fund_account_events_status ON fund_account_events(status);

CREATE INDEX IF NOT EXISTS idx_account_events_status ON account_events(status);

CREATE INDEX IF NOT EXISTS idx_payment_link_events_status ON payment_link_events(status);

CREATE INDEX IF NOT EXISTS idx_webhook_events_source ON webhook_events(source);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event ON webhook_events(event);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION update_updated_at_column() FROM PUBLIC;

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
CREATE POLICY "Users can manage their own payment orders" ON payment_orders
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all payment orders" ON payment_orders
    FOR ALL TO service_role USING (true);

-- RLS Policies for payment_transactions
CREATE POLICY "Users can manage their own payment transactions" ON payment_transactions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all payment transactions" ON payment_transactions
    FOR ALL TO service_role USING (true);

-- RLS Policies for payment_refunds
CREATE POLICY "Users can manage their own payment refunds" ON payment_refunds
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all payment refunds" ON payment_refunds
    FOR ALL TO service_role USING (true);

-- RLS Policies for webhook_events (service role only)
-- Deny all access by default. The service_role policy will override this.
CREATE POLICY "Deny all access to webhook events by default" ON webhook_events
    FOR ALL USING (false);

CREATE POLICY "Service role can manage all webhook events" ON webhook_events
    FOR ALL TO service_role USING (true);

-- RLS Policies for audit_logs
CREATE POLICY "Users can manage their own audit logs" ON audit_logs
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all audit logs" ON audit_logs
    FOR ALL TO service_role USING (true);