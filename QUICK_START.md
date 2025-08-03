# 🚀 Quick Start Guide - Environment Setup

## ⚡ **Fastest Way to Get Started**

### **Option 1: Automated Setup (Recommended)**
```bash
# Run the automated setup script
npm run setup

# This will:
# ✅ Check prerequisites
# ✅ Create .env file
# ✅ Collect your credentials interactively
# ✅ Install dependencies
# ✅ Set up local Redis (optional)
# ✅ Test configuration
```

### **Option 2: Manual Setup**
```bash
# 1. Create environment file
npm run setup:env

# 2. Edit .env file with your credentials
nano .env

# 3. Install dependencies
npm install

# 4. Test configuration
npm run test:config
```

## 📋 **Required Credentials**

You'll need these credentials ready:

### **🗄️ Supabase (Database)**
1. Go to [supabase.com](https://supabase.com) → Create Project
2. Get from Settings → API:
   - **Project URL**: `https://your-project.supabase.co`
   - **Service Role Key**: `eyJhbGciOiJIUzI1NiIs...`

### **🔴 Redis (Queue)**
Choose one option:

**Local Redis (Development):**
```bash
# Start local Redis with Docker
npm run redis:start
```

**Cloud Redis (Production):**
- [Redis Cloud](https://redis.com/try-free/) - Free tier available
- [AWS ElastiCache](https://aws.amazon.com/elasticache/)
- [DigitalOcean Managed Redis](https://www.digitalocean.com/products/managed-databases/)

### **💳 Razorpay (Payment Gateway)**
1. Go to [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Get from Settings → API Keys:
   - **Key ID**: `rzp_test_xxxxxxxxxx`
   - **Key Secret**: `your_secret_key`
3. Get from Settings → Webhooks:
   - **Webhook Secret**: `your_webhook_secret`

## 🔧 **Environment Variables Template**

```env
# Server
NODE_ENV=development
PORT=3000

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Redis
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your_32_character_jwt_secret_key
ALLOWED_ORIGINS=http://localhost:3000,https://curveai.com
```

## 🗄️ **Database Setup**

After configuring environment:

1. **Go to Supabase Dashboard** → SQL Editor
2. **Copy content** from `database/schema.sql`
3. **Run the SQL** to create all tables
4. **Verify tables** are created:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name LIKE 'payment_%';
   ```

## ✅ **Verify Setup**

```bash
# Test all configurations
npm run test:config

# Expected output:
# 🧪 Testing Environment Configuration...
# 📊 Testing Supabase connection...
# ✅ Supabase connection successful
# 🔴 Testing Redis connection...
# ✅ Redis connection successful
# 💳 Testing Razorpay credentials...
# ✅ Razorpay credentials format valid
# 🎉 All configurations are valid!
```

## 🚀 **Start the Service**

```bash
# Start in development mode
npm run dev

# Expected output:
# [INFO] Supabase initialized successfully
# [INFO] BullMQ payment queue initialized successfully
# [INFO] Redis connected successfully
# [INFO] Payment service running on port 3000
```

## 🌐 **Test API Endpoints**

```bash
# Test health endpoint
curl http://localhost:3000/api/payments/health

# Expected response:
{
  "status": "OK",
  "service": "payment-service",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

## 🔗 **Configure Webhooks**

### **For Local Development:**
```bash
# Install ngrok for local testing
npm install -g ngrok

# Expose local server
ngrok http 3000

# Use the HTTPS URL for webhook: https://abc123.ngrok.io/api/payments/webhook
```

### **In Razorpay Dashboard:**
1. Go to **Settings → Webhooks**
2. **Add New Webhook**:
   - **URL**: `https://your-domain.com/api/payments/webhook`
   - **Secret**: Same as `RAZORPAY_WEBHOOK_SECRET` in .env
   - **Events**: Select all payment events
   - **Active**: ✅ Enable

## 🚨 **Troubleshooting**

### **Common Issues:**

#### **Supabase Connection Failed**
```bash
# Check URL format
echo $SUPABASE_URL
# Should be: https://your-project-id.supabase.co

# Verify service role key
echo $SUPABASE_SERVICE_ROLE_KEY | cut -c1-20
# Should start with: eyJhbGciOiJIUzI1NiIs
```

#### **Redis Connection Failed**
```bash
# For local Redis
docker ps | grep redis
# Should show running Redis container

# Test Redis directly
redis-cli ping
# Should return: PONG
```

#### **Missing Database Tables**
```sql
-- Check if schema was run
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'payment_%';
-- Should return: 9 (if all tables created)
```

## 📚 **Next Steps**

Once setup is complete:

1. **📖 Read API Documentation**: `docs/API_DOCUMENTATION.md`
2. **🎨 Frontend Integration**: `docs/UI_INTEGRATION_GUIDE.md`
3. **🚀 Production Deployment**: `docs/DEPLOYMENT_GUIDE.md`
4. **🔍 Monitor Performance**: Set up monitoring dashboards

## 💡 **Pro Tips**

- **Use test credentials** during development
- **Enable webhook logs** in Razorpay dashboard for debugging
- **Monitor queue stats** at `/admin/queues` (if dashboard enabled)
- **Check logs** in `logs/combined.log` for troubleshooting

## 🆘 **Need Help?**

If you encounter issues:

1. **Run diagnostics**: `npm run test:config`
2. **Check logs**: `tail -f logs/combined.log`
3. **Verify environment**: Compare with `.env.example`
4. **Read detailed guide**: `docs/ENVIRONMENT_SETUP_GUIDE.md`

---

**🎉 You're ready to process payments securely with all 29 Razorpay webhook events!**