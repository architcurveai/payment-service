import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = 'test_jwt_secret_key_for_development_only';

// Generate test JWT token
function generateTestToken() {
  const payload = {
    userId: 'test_user_123',
    email: 'test@example.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
  };
  
  return jwt.sign(payload, JWT_SECRET);
}

async function testBasicFunctionality() {
  console.log('🧪 Testing Basic Payment Service Functionality...\n');
  
  const token = generateTestToken();
  console.log('✅ Generated JWT Token:', token.substring(0, 50) + '...\n');
  
  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await fetch(`${BASE_URL}/api/payments/health`);
    const healthData = await healthResponse.json();
    console.log('Health Check Response:', healthData);
    console.log('Status:', healthResponse.status, healthResponse.ok ? '✅' : '❌');
    console.log('');
    
    // Test 2: Create Order (without auth - should fail)
    console.log('2️⃣ Testing Create Order without Auth (should fail)...');
    const noAuthResponse = await fetch(`${BASE_URL}/api/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: 500,
        currency: 'INR',
        receipt: 'test_receipt_1'
      })
    });
    const noAuthData = await noAuthResponse.json();
    console.log('No Auth Response:', noAuthData);
    console.log('Status:', noAuthResponse.status, noAuthResponse.status === 401 ? '✅' : '❌');
    console.log('');
    
    // Test 3: Create Order (with auth)
    console.log('3️⃣ Testing Create Order with Auth...');
    const orderResponse = await fetch(`${BASE_URL}/api/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        amount: 500,
        currency: 'INR',
        receipt: 'test_receipt_2'
      })
    });
    const orderData = await orderResponse.json();
    console.log('Create Order Response:', orderData);
    console.log('Status:', orderResponse.status, orderResponse.ok ? '✅' : '❌');
    console.log('');
    
    // Test 4: Validation Error
    console.log('4️⃣ Testing Validation Error...');
    const validationResponse = await fetch(`${BASE_URL}/api/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        amount: -500, // Invalid amount
        currency: 'INVALID', // Invalid currency
      })
    });
    const validationData = await validationResponse.json();
    console.log('Validation Error Response:', validationData);
    console.log('Status:', validationResponse.status, validationResponse.status === 400 ? '✅' : '❌');
    console.log('');
    
    // Test 5: Webhook Test
    console.log('5️⃣ Testing Webhook...');
    const crypto = await import('crypto');
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_test_123',
            amount: 50000,
            currency: 'INR',
            status: 'captured'
          }
        }
      }
    };
    
    const webhookSecret = 'test_webhook_secret';
    const signature = crypto.createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    const webhookResponse = await fetch(`${BASE_URL}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature
      },
      body: JSON.stringify(payload)
    });
    const webhookData = await webhookResponse.json();
    console.log('Webhook Response:', webhookData);
    console.log('Status:', webhookResponse.status, webhookResponse.ok ? '✅' : '❌');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run tests
testBasicFunctionality();