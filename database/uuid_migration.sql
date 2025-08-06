-- UUID Migration Script for Payment Gateway
-- Run this script to add UUID support to existing tables

-- Add user_uuid columns to payment_orders table
ALTER TABLE payment_orders 
ADD COLUMN IF NOT EXISTS user_uuid UUID;

-- Add user_uuid columns to payment_transactions table  
ALTER TABLE payment_transactions
ADD COLUMN IF NOT EXISTS user_uuid UUID;

-- Add customer_info column to payment_orders for storing customer details
ALTER TABLE payment_orders
ADD COLUMN IF NOT EXISTS customer_info JSONB DEFAULT '{}';

-- Add indexes for better performance on UUID queries
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_uuid ON payment_orders(user_uuid);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_uuid ON payment_transactions(user_uuid);

-- Add composite indexes for UUID + order/payment lookups
CREATE INDEX IF NOT EXISTS idx_payment_orders_uuid_order_id ON payment_orders(user_uuid, razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_uuid_payment_id ON payment_transactions(user_uuid, razorpay_payment_id);

-- Optional: Update existing records with generated UUIDs (uncomment if needed for migration)
-- WARNING: Only run this if you need to migrate existing data
/*
UPDATE payment_orders 
SET user_uuid = uuid_generate_v4() 
WHERE user_uuid IS NULL;

UPDATE payment_transactions 
SET user_uuid = (
  SELECT po.user_uuid 
  FROM payment_orders po 
  WHERE po.razorpay_order_id = payment_transactions.razorpay_order_id
)
WHERE user_uuid IS NULL;
*/

-- Add comments to document the new columns
COMMENT ON COLUMN payment_orders.user_uuid IS 'Frontend-generated UUID for anonymous payment tracking';
COMMENT ON COLUMN payment_transactions.user_uuid IS 'Frontend-generated UUID for anonymous payment tracking';
COMMENT ON COLUMN payment_orders.customer_info IS 'Customer information from frontend (name, email, etc.)';

-- Verify the migration
SELECT 
  'payment_orders' as table_name,
  COUNT(*) as total_records,
  COUNT(user_uuid) as records_with_uuid
FROM payment_orders
UNION ALL
SELECT 
  'payment_transactions' as table_name,
  COUNT(*) as total_records,
  COUNT(user_uuid) as records_with_uuid
FROM payment_transactions;