# Payment Service Testing Guide

## 🚀 Quick Start Testing

### 1. Start the Server
```bash
npm start
```

### 2. Import Postman Collection
- Import `postman_collection.json` into Postman
- The collection includes all necessary tests with pre-request scripts

### 3. Test Sequence
Run the requests in this order:

1. **Health Check** - Verify service is running
2. **Generate JWT Token** - Creates a test JWT token
3. **Create Payment Order** - Test order creation with auth
4. **Capture Payment** - Test payment capture
5. **Webhook Simulation** - Test webhook processing
6. **Test Rate Limiting** - Verify rate limiting works
7. **Test Invalid Token** - Verify auth protection
8. **Test Validation Errors** - Verify input validation

## 🧪 Manual Testing with cURL

### Health Check
```bash
curl -X GET http://localhost:3000/api/payments/health
```

### Generate JWT Token (for testing)
```bash
# Use this token in subsequent requests
JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Create Payment Order
```bash
curl -X POST http://localhost:3000/api/payments/create-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "amount": 500,
    "currency": "INR",
    "receipt": "test_receipt_001"
  }'
```

### Test Webhook
```bash
# Generate signature first
PAYLOAD='{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_test_123","amount":50000,"currency":"INR","status":"captured"}}}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "test_webhook_secret" -hex | cut -d' ' -f2)

curl -X POST http://localhost:3000/api/payments/webhook \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

## 🔧 Environment Setup

### Required Environment Variables
```bash
# Copy .env.example to .env and update values
cp .env.example .env
```

### For Razorpay Testing
1. Sign up at https://razorpay.com/
2. Go to Dashboard → Settings → API Keys
3. Generate Test API Keys
4. Update .env file with your test keys:
   ```
   RAZORPAY_KEY_ID=rzp_test_your_key_id
   RAZORPAY_KEY_SECRET=your_test_key_secret
   ```

### Webhook Testing
1. Use ngrok for local webhook testing:
   ```bash
   ngrok http 3000
   ```
2. Add webhook URL in Razorpay Dashboard:
   ```
   https://your-ngrok-url.ngrok.io/api/payments/webhook
   ```

## 📊 Expected Test Results

### ✅ Successful Responses

**Health Check:**
```json
{
  "status": "OK",
  "service": "payment-service"
}
```

**Create Order (Success):**
```json
{
  "success": true,
  "order": {
    "id": "order_xyz123",
    "amount": 50000,
    "currency": "INR",
    "receipt": "test_receipt_001"
  }
}
```

**Webhook (Success):**
```json
{
  "status": "ok"
}
```

### ❌ Error Responses

**Authentication Error:**
```json
{
  "error": "No token provided"
}
```

**Validation Error:**
```json
{
  "error": "Validation failed",
  "details": ["\"amount\" must be a positive number"]
}
```

**Rate Limit Error:**
```json
{
  "error": "Too many requests from this IP, please try again later."
}
```

## 🔍 Debugging Tips

1. **Check Logs:** Look at console output for detailed error messages
2. **Verify Environment:** Ensure all required env variables are set
3. **Network Issues:** Use `curl -v` for verbose output
4. **JWT Issues:** Verify token format and expiration
5. **Webhook Issues:** Check signature generation and raw body handling

## 🧪 Advanced Testing

### Load Testing
```bash
# Install autocannon globally
npm install -g autocannon

# Run load test
autocannon -c 10 -d 30 -m POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -b '{"amount":500,"currency":"INR","receipt":"load_test"}' \
  http://localhost:3000/api/payments/create-order
```

### Security Testing
- Test with invalid JWT tokens
- Test with malformed requests
- Test rate limiting by making rapid requests
- Test webhook signature verification with tampered payloads

## 📝 Test Checklist

- [ ] Service starts without errors
- [ ] Health check returns 200
- [ ] Authentication works with valid JWT
- [ ] Authentication fails with invalid JWT
- [ ] Order creation works with valid data
- [ ] Validation rejects invalid data
- [ ] Webhook signature verification works
- [ ] Rate limiting triggers after threshold
- [ ] CORS headers are present
- [ ] Error responses are properly formatted
- [ ] Logs are generated for all operations