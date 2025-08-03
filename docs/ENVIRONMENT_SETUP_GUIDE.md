# Environment Setup Guide - Supabase & Redis Configuration

## 🎯 **Complete Environment Setup**

This guide will walk you through setting up Supabase and Redis for your Razorpay payment service.

## 📋 **Prerequisites**

- Node.js 18+ installed
- Git installed
- A Supabase account
- A Razorpay account (test/live)
- Docker (optional, for local Redis)

## 🗄️ **Step 1: Supabase Setup**

### **1.1 Create Supabase Project**

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Fill in project details:
   - **Name**: `payment-service-db`
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Start with Free tier

### **1.2 Get Supabase Credentials**

After project creation, go to **Settings > API**:

```bash
# Copy these values:
Project URL: https://your-project-id.supabase.co
anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **1.3 Run Database Schema**

1. Go to **SQL Editor** in Supabase dashboard
2. Create a new query
3. Copy and paste the entire content from `database/schema.sql`
4. Click "Run" to execute the schema

```sql
-- Verify tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'payment_%'
ORDER BY table_name;

-- Should return:
-- payment_disputes
-- payment_link_events  
-- payment_orders
-- payment_refunds
-- payment_transactions
```

### **1.4 Configure Row Level Security (RLS)**

The schema automatically enables RLS. Verify in **Authentication > Policies**:

```sql
-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
```

## 🔴 **Step 2: Redis Setup**

### **Option A: Local Redis (Development)**

#### **Using Docker (Recommended):**
```bash
# Create docker-compose.yml for Redis
cat > docker-compose.redis.yml << EOF
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    container_name: payment-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --requirepass your_redis_password
    restart: unless-stopped
    environment:
      - REDIS_PASSWORD=your_redis_password

volumes:
  redis_data:
EOF

# Start Redis
docker-compose -f docker-compose.redis.yml up -d

# Test Redis connection
docker exec -it payment-redis redis-cli -a your_redis_password ping
# Should return: PONG
```

#### **Using Local Installation:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install redis-server

# macOS
brew install redis

# Start Redis
redis-server

# Test connection
redis-cli ping
# Should return: PONG
```

### **Option B: Cloud Redis (Production)**

#### **Redis Cloud (Recommended for Production):**
1. Go to [https://redis.com/try-free/](https://redis.com/try-free/)
2. Create account and new database
3. Get connection details:
   - **Endpoint**: redis-12345.c1.us-east-1-1.ec2.cloud.redislabs.com:12345
   - **Password**: your-redis-password

#### **AWS ElastiCache:**
```bash
# Create ElastiCache cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id payment-redis \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-nodes 1 \
  --port 6379
```

#### **DigitalOcean Managed Redis:**
1. Go to DigitalOcean dashboard
2. Create > Databases > Redis
3. Choose configuration and region
4. Get connection string

## 🔑 **Step 3: Razorpay Credentials**

### **3.1 Get Test Credentials**
1. Go to [https://dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Sign in to your account
3. Go to **Settings > API Keys**
4. Generate Test API Keys:
   - **Key ID**: rzp_test_xxxxxxxxxx
   - **Key Secret**: your_test_secret_key

### **3.2 Setup Webhook Secret**
1. Go to **Settings > Webhooks**
2. Create webhook endpoint (we'll configure URL later)
3. Generate webhook secret: `your_webhook_secret`

## 📝 **Step 4: Environment Configuration**

### **4.1 Create Environment File**
```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file with your credentials
nano .env
```

### **4.2 Configure .env File**
```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Razorpay Configuration (Test Mode)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET=your_test_secret_key
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_min_32_characters_long
JWT_EXPIRES_IN=24h

# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Redis Configuration
REDIS_URL=redis://localhost:6379
# For Redis with password: redis://:password@localhost:6379
# For Redis Cloud: redis://:password@endpoint:port

# Security Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://curveai.com
WEBHOOK_TIMEOUT_MS=30000

# Queue Configuration
QUEUE_NAME=payment_processing
QUEUE_CONCURRENCY=5

# Logging Configuration
LOG_LEVEL=info
LOG_FILE_PATH=./logs

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_MAX_REQUESTS_PER_USER=50
```

## 🔧 **Step 5: Install Dependencies**

```bash
# Install all dependencies
npm install

# Verify installation
npm list --depth=0
```

## ✅ **Step 6: Test Configuration**

### **6.1 Create Test Script**
```bash
# Create test configuration script
cat > test-config.js << 'EOF'
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import IORedis from 'ioredis';

dotenv.config();

async function testConfiguration() {
  console.log('🧪 Testing Environment Configuration...\n');

  // Test Supabase connection
  try {
    console.log('📊 Testing Supabase connection...');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data, error } = await supabase
      .from('payment_orders')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    console.log('✅ Supabase connection successful');
  } catch (error) {
    console.log('❌ Supabase connection failed:', error.message);
    return false;
  }

  // Test Redis connection
  try {
    console.log('🔴 Testing Redis connection...');
    const redis = new IORedis(process.env.REDIS_URL);
    const pong = await redis.ping();
    await redis.quit();
    
    if (pong === 'PONG') {
      console.log('✅ Redis connection successful');
    } else {
      throw new Error('Invalid Redis response');
    }
  } catch (error) {
    console.log('❌ Redis connection failed:', error.message);
    return false;
  }

  // Test Razorpay credentials
  try {
    console.log('💳 Testing Razorpay credentials...');
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials not found');
    }
    
    if (!process.env.RAZORPAY_KEY_ID.startsWith('rzp_')) {
      throw new Error('Invalid Razorpay Key ID format');
    }
    
    console.log('✅ Razorpay credentials format valid');
  } catch (error) {
    console.log('❌ Razorpay credentials invalid:', error.message);
    return false;
  }

  console.log('\n🎉 All configurations are valid!');
  return true;
}

testConfiguration().catch(console.error);
EOF

# Run the test
node test-config.js
```

### **6.2 Test Database Schema**
```bash
# Create database test script
cat > test-database.js << 'EOF'
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function testDatabaseSchema() {
  console.log('🗄️ Testing Database Schema...\n');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const expectedTables = [
    'payment_orders',
    'payment_transactions', 
    'payment_refunds',
    'payment_disputes',
    'downtime_events',
    'invoice_events',
    'fund_account_events',
    'account_events',
    'payment_link_events',
    'webhook_events',
    'audit_logs'
  ];

  try {
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', expectedTables);

    if (error) throw error;

    const foundTables = tables.map(t => t.table_name);
    const missingTables = expectedTables.filter(t => !foundTables.includes(t));

    if (missingTables.length === 0) {
      console.log('✅ All required tables found:');
      foundTables.forEach(table => console.log(`   - ${table}`));
    } else {
      console.log('❌ Missing tables:');
      missingTables.forEach(table => console.log(`   - ${table}`));
      console.log('\n📝 Please run the database schema from database/schema.sql');
    }
  } catch (error) {
    console.log('❌ Database schema test failed:', error.message);
  }
}

testDatabaseSchema().catch(console.error);
EOF

# Run database test
node test-database.js
```

## 🚀 **Step 7: Start the Service**

```bash
# Start in development mode
npm run dev

# You should see:
# [INFO] Supabase initialized successfully
# [INFO] BullMQ payment queue initialized successfully  
# [INFO] Redis connected successfully
# [INFO] Payment service running on port 3000
```

## 🌐 **Step 8: Configure Webhook URL**

### **8.1 For Local Development (using ngrok):**
```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Your webhook URL will be: https://abc123.ngrok.io/api/payments/webhook
```

### **8.2 Configure in Razorpay Dashboard:**
1. Go to **Settings > Webhooks**
2. Click "Add New Webhook"
3. **URL**: `https://your-domain.com/api/payments/webhook`
4. **Secret**: Use the same secret from your .env file
5. **Events**: Select all the events you want to handle
6. **Active**: Enable the webhook

## 🧪 **Step 9: Test the Setup**

### **9.1 Test Health Endpoint**
```bash
curl http://localhost:3000/api/payments/health

# Expected response:
{
  "status": "OK",
  "service": "payment-service",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

### **9.2 Test Webhook Endpoint**
```bash
# Test webhook signature verification
curl -X POST http://localhost:3000/api/payments/webhook \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: test_signature" \
  -d '{"event": "payment.captured", "payload": {}}'

# Expected: 400 Bad Request (signature verification failed - this is correct!)
```

## 🔒 **Step 10: Security Checklist**

- [ ] ✅ Strong passwords for all services
- [ ] ✅ Environment variables properly configured
- [ ] ✅ No credentials in code repository
- [ ] ✅ HTTPS enabled for production
- [ ] ✅ Webhook signature verification working
- [ ] ✅ Database RLS policies enabled
- [ ] ✅ Redis authentication configured

## 🚨 **Troubleshooting**

### **Common Issues:**

#### **Supabase Connection Failed:**
```bash
# Check URL format
echo $SUPABASE_URL
# Should be: https://your-project-id.supabase.co

# Check service role key
echo $SUPABASE_SERVICE_ROLE_KEY | cut -c1-20
# Should start with: eyJhbGciOiJIUzI1NiIs
```

#### **Redis Connection Failed:**
```bash
# Test Redis directly
redis-cli -h localhost -p 6379 ping

# For password-protected Redis
redis-cli -h localhost -p 6379 -a your_password ping

# Check Redis URL format
echo $REDIS_URL
# Should be: redis://localhost:6379 or redis://:password@host:port
```

#### **Database Schema Issues:**
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'payment_%';

-- If no tables, re-run the schema
-- Copy content from database/schema.sql and run in Supabase SQL editor
```

## 📞 **Support**

If you encounter issues:

1. **Check logs**: `tail -f logs/combined.log`
2. **Verify environment**: Run `node test-config.js`
3. **Test connections**: Use the test scripts provided
4. **Check documentation**: Refer to API documentation

## 🎉 **Next Steps**

Once environment is configured:

1. **Test payment creation**: Use the API endpoints
2. **Configure frontend**: Follow UI integration guide
3. **Deploy to production**: Use deployment guide
4. **Monitor performance**: Set up monitoring dashboards

Your environment is now ready for the Razorpay payment service! 🚀