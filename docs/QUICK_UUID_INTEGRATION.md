# Quick UUID Integration Guide

This is a simplified guide for integrating your frontend with the payment gateway using UUIDs.

## 🚀 Quick Start

### 1. Frontend Setup (5 minutes)

```javascript
// Install uuid package
npm install uuid

// Create utils/uuid.js
import { v4 as uuidv4 } from 'uuid';

export const getOrCreateUserUUID = () => {
  const key = 'payment_user_uuid';
  let uuid = localStorage.getItem(key);
  
  if (!uuid) {
    uuid = uuidv4();
    localStorage.setItem(key, uuid);
  }
  
  return uuid;
};
```

### 2. Payment Integration

```javascript
// services/payment.js
const API_URL = 'https://your-payment-api.com/api/payments';

export const createPayment = async (amount, planName) => {
  const user_uuid = getOrCreateUserUUID();
  
  // Step 1: Create order
  const orderResponse = await fetch(`${API_URL}/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      user_uuid,
      notes: { plan_name: planName }
    })
  });
  
  const order = await orderResponse.json();
  
  // Step 2: Open Razorpay
  const options = {
    key: 'your_razorpay_key_id',
    amount: order.order.amount,
    currency: order.order.currency,
    order_id: order.order.id,
    handler: async (response) => {
      // Step 3: Verify payment
      const verifyResponse = await fetch(`${API_URL}/verify-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          user_uuid
        })
      });
      
      const result = await verifyResponse.json();
      if (result.success) {
        alert('Payment successful!');
      }
    }
  };
  
  const rzp = new window.Razorpay(options);
  rzp.open();
};

// Get payment history
export const getPaymentHistory = async () => {
  const user_uuid = getOrCreateUserUUID();
  const response = await fetch(`${API_URL}/payments/uuid/${user_uuid}`);
  return response.json();
};
```

### 3. React Component Example

```jsx
import React, { useState, useEffect } from 'react';
import { createPayment, getPaymentHistory } from './services/payment';

const PaymentButton = ({ plan }) => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const data = await getPaymentHistory();
    setHistory(data.payments || []);
  };

  const handlePay = () => {
    createPayment(plan.price, plan.name);
  };

  return (
    <div>
      <button onClick={handlePay}>
        Pay ₹{plan.price} for {plan.name}
      </button>
      
      <div>
        <h4>Payment History</h4>
        {history.map(payment => (
          <div key={payment.id}>
            {payment.razorpay_order_id} - ₹{payment.amount/100} - {payment.status}
          </div>
        ))}
      </div>
    </div>
  );
};
```

## 🔧 Backend Changes Made

The backend now supports:

1. **UUID in create-order**: Send `user_uuid` in request body
2. **UUID in verify-signature**: Send `user_uuid` in request body  
3. **UUID-based routes**:
   - `GET /api/payments/payments/uuid/{uuid}` - Get payment history
   - `GET /api/payments/status/uuid/{uuid}/{orderId}` - Get payment status

## 📋 Database Migration

Run this SQL to add UUID support:

```sql
-- Add UUID columns
ALTER TABLE payment_orders ADD COLUMN user_uuid UUID;
ALTER TABLE payment_transactions ADD COLUMN user_uuid UUID;

-- Add indexes
CREATE INDEX idx_payment_orders_user_uuid ON payment_orders(user_uuid);
CREATE INDEX idx_payment_transactions_user_uuid ON payment_transactions(user_uuid);
```

## ✅ Testing

1. Generate UUID in frontend
2. Create payment with UUID
3. Complete payment in Razorpay
4. Verify payment with same UUID
5. Check payment history by UUID

All payment data will be linked to your UUID!

## 🔒 Security Notes

- UUIDs are validated on backend
- No authentication required for UUID endpoints
- Rate limiting recommended
- UUIDs are not personally identifiable

That's it! Your frontend can now track all payments under a single UUID without requiring user registration.