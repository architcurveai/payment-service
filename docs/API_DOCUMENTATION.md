# Payment Service API Documentation

## Overview
This is a secure, scalable payment microservice built with Node.js and Express.js, integrated with Razorpay payment gateway and Supabase database.

## Base URL
```
https://your-domain.com/api/payments
```

## Authentication
All endpoints (except webhook) require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## API Endpoints

### 1. Create Payment Order
Creates a new payment order in Razorpay and stores it in the database.

**Endpoint:** `POST /create-order`

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "amount": 1000,
  "currency": "INR",
  "receipt": "order_001",
  "notes": {
    "description": "Payment for premium subscription"
  }
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "order_MNzQvlHdZHyVyC",
    "amount": 100000,
    "currency": "INR",
    "receipt": "order_001",
    "status": "created",
    "created_at": 1640995200
  }
}
```

### 2. Verify Payment Signature
Verifies the payment signature from Razorpay frontend integration.

**Endpoint:** `POST /verify-signature`

**Request Body:**
```json
{
  "razorpay_order_id": "order_MNzQvlHdZHyVyC",
  "razorpay_payment_id": "pay_MNzQvlHdZHyVyD",
  "razorpay_signature": "signature_hash"
}
```

**Response:**
```json
{
  "success": true,
  "verified": true
}
```

### 3. Get Payment Status
Retrieves the current status of a payment order.

**Endpoint:** `GET /status/:orderId`

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "order_MNzQvlHdZHyVyC",
    "amount": 100000,
    "currency": "INR",
    "receipt": "order_001",
    "status": "paid",
    "created_at": 1640995200,
    "attempts": 1,
    "notes": {}
  }
}
```

### 4. Get User Payment History
Retrieves payment history for the authenticated user.

**Endpoint:** `GET /history?limit=10&offset=0`

**Query Parameters:**
- `limit` (optional): Number of records to return (default: 10)
- `offset` (optional): Number of records to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "payments": [
    {
      "id": "uuid",
      "razorpay_order_id": "order_MNzQvlHdZHyVyC",
      "amount": 100000,
      "currency": "INR",
      "status": "paid",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 1
  }
}
```

### 5. Create Refund
Creates a refund for a payment.

**Endpoint:** `POST /refund`

**Request Body:**
```json
{
  "paymentId": "pay_MNzQvlHdZHyVyD",
  "amount": 500,
  "reason": "Customer request",
  "receipt": "refund_001"
}
```

**Response:**
```json
{
  "success": true,
  "refund": {
    "id": "rfnd_MNzQvlHdZHyVyE",
    "amount": 50000,
    "currency": "INR",
    "status": "processed",
    "speed": "normal"
  }
}
```

### 6. Capture Payment
Captures an authorized payment.

**Endpoint:** `POST /capture`

**Request Body:**
```json
{
  "paymentId": "pay_MNzQvlHdZHyVyD",
  "amount": 1000
}
```

### 7. Webhook Endpoint
Receives webhook events from Razorpay (no authentication required).

**Endpoint:** `POST /webhook`

**Headers:**
```
x-razorpay-signature: <webhook-signature>
Content-Type: application/json
```

### 8. Health Check
Check service health status.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "OK",
  "service": "payment-service",
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "1.0.0"
}
```

## Error Responses

All error responses follow this format:
```json
{
  "error": "Error message",
  "details": ["Detailed error information"]
}
```

### Common HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Rate Limiting
- 100 requests per 15 minutes per IP address
- 50 requests per 15 minutes per authenticated user

## Security Features
- JWT authentication for all user endpoints
- Request signature verification for webhooks
- Input validation and sanitization
- Rate limiting
- CORS protection
- Security headers (Helmet.js)
- Audit logging

## Webhook Events Handled
The service handles the following Razorpay webhook events:
- `payment.authorized`
- `payment.captured`
- `payment.failed`
- `order.paid`
- `refund.created`
- `refund.processed`
- `refund.failed`

## Database Schema
The service uses Supabase PostgreSQL with the following main tables:
- `payment_orders` - Payment order records
- `payment_transactions` - Payment transaction details
- `payment_refunds` - Refund records
- `webhook_events` - Webhook event logs
- `audit_logs` - Audit trail