# Deployment Guide for Razorpay Payment Service

## Overview
This guide covers deploying the payment microservice to production with proper security, monitoring, and scalability configurations.

## Prerequisites

### 1. Environment Setup
- Node.js 18+ LTS
- Docker and Docker Compose
- Redis (for queue processing)
- Supabase account and database
- Razorpay account (live credentials)

### 2. Required Accounts
- **Razorpay**: Live API keys and webhook secret
- **Supabase**: Production database with service role key
- **Domain**: SSL certificate for HTTPS
- **Monitoring**: Sentry, DataDog, or similar (optional)

## Database Setup

### 1. Supabase Configuration
```sql
-- Run the schema.sql file in your Supabase SQL editor
-- File: database/schema.sql

-- Verify tables are created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'payment_%';
```

### 2. Environment Variables
Create production `.env` file:
```env
# Server Configuration
NODE_ENV=production
PORT=3000

# Razorpay Live Configuration
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxx
RAZORPAY_KEY_SECRET=your_live_secret_key
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# JWT Configuration
JWT_SECRET=your_super_secure_jwt_secret_min_32_chars
JWT_EXPIRES_IN=24h

# Supabase Production Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Security Configuration
ALLOWED_ORIGINS=https://curveai.com,https://www.curveai.com
WEBHOOK_TIMEOUT_MS=30000

# Redis Configuration (for queue processing)
REDIS_URL=redis://your-redis-host:6379
QUEUE_NAME=payment_processing

# Logging Configuration
LOG_LEVEL=info
LOG_FILE_PATH=/app/logs

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_MAX_REQUESTS_PER_USER=50
```

## Docker Deployment

### 1. Build Docker Image
```bash
# Build the image
docker build -t payment-service:latest .

# Tag for registry (if using)
docker tag payment-service:latest your-registry/payment-service:latest
```

### 2. Docker Compose Setup
Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  payment-service:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    depends_on:
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/payments/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    command: redis-server --appendonly yes

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - payment-service
    restart: unless-stopped

volumes:
  redis_data:
```

### 3. Nginx Configuration
Create `nginx.conf`:
```nginx
events {
    worker_connections 1024;
}

http {
    upstream payment_service {
        server payment-service:3000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

        location /api/payments {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://payment_service;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeout settings
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        location /health {
            proxy_pass http://payment_service/api/payments/health;
        }
    }
}
```

## Cloud Deployment Options

### 1. AWS ECS Deployment
```yaml
# ecs-task-definition.json
{
  "family": "payment-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "payment-service",
      "image": "your-account.dkr.ecr.region.amazonaws.com/payment-service:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "RAZORPAY_KEY_SECRET",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:payment-service/razorpay-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/payment-service",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### 2. Kubernetes Deployment
```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: payment-service
  template:
    metadata:
      labels:
        app: payment-service
    spec:
      containers:
      - name: payment-service
        image: payment-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - secretRef:
            name: payment-service-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/payments/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/payments/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: payment-service
spec:
  selector:
    app: payment-service
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: payment-service-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.curveai.com
    secretName: payment-service-tls
  rules:
  - host: api.curveai.com
    http:
      paths:
      - path: /api/payments
        pathType: Prefix
        backend:
          service:
            name: payment-service
            port:
              number: 80
```

## Monitoring and Logging

### 1. Application Monitoring
```javascript
// Add to src/app.js for production monitoring
import Sentry from '@sentry/node';

if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
  });
}
```

### 2. Health Checks
```javascript
// Enhanced health check endpoint
router.get('/health', async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {
      database: 'OK',
      redis: 'OK',
      razorpay: 'OK'
    }
  };

  try {
    // Check database connection
    await supabaseService.healthCheck();
    
    // Check Redis connection
    await queueService.healthCheck();
    
    // Check Razorpay connection
    await razorpayService.healthCheck();
    
    res.json(health);
  } catch (error) {
    health.status = 'ERROR';
    health.error = error.message;
    res.status(503).json(health);
  }
});
```

## Security Checklist

### 1. Environment Security
- [ ] All secrets stored in environment variables or secret managers
- [ ] No hardcoded credentials in code
- [ ] HTTPS enabled with valid SSL certificates
- [ ] CORS configured for specific origins only
- [ ] Rate limiting enabled
- [ ] Security headers configured

### 2. Database Security
- [ ] Row Level Security (RLS) enabled in Supabase
- [ ] Service role key used for backend operations
- [ ] Database connection over SSL
- [ ] Regular backups configured

### 3. API Security
- [ ] JWT authentication on all user endpoints
- [ ] Input validation on all endpoints
- [ ] Webhook signature verification
- [ ] Request size limits configured
- [ ] Audit logging enabled

## Razorpay Configuration

### 1. Webhook Setup
1. Go to Razorpay Dashboard → Settings → Webhooks
2. Add webhook URL: `https://your-domain.com/api/payments/webhook`
3. Select events:
   - payment.authorized
   - payment.captured
   - payment.failed
   - order.paid
   - refund.created
   - refund.processed
   - refund.failed
4. Set webhook secret and add to environment variables

### 2. API Keys
1. Generate live API keys in Razorpay Dashboard
2. Add to environment variables
3. Test with small transactions first

## Deployment Steps

### 1. Pre-deployment
```bash
# Install dependencies
npm ci

# Run tests
npm test

# Build Docker image
docker build -t payment-service .

# Security scan (optional)
docker scan payment-service
```

### 2. Deploy
```bash
# Deploy with Docker Compose
docker-compose up -d

# Or deploy to cloud platform
# (AWS ECS, Kubernetes, etc.)
```

### 3. Post-deployment
```bash
# Verify health
curl https://your-domain.com/api/payments/health

# Test webhook endpoint
curl -X POST https://your-domain.com/api/payments/webhook \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: test" \
  -d '{"event":"test"}'

# Monitor logs
docker-compose logs -f payment-service
```

## Scaling Considerations

### 1. Horizontal Scaling
- Use load balancer (Nginx, AWS ALB, etc.)
- Deploy multiple instances
- Use Redis for session storage if needed

### 2. Database Scaling
- Use Supabase connection pooling
- Implement read replicas for heavy read operations
- Consider database sharding for very high volume

### 3. Queue Processing
- Scale queue workers independently
- Use Redis Cluster for high availability
- Monitor queue metrics

## Backup and Recovery

### 1. Database Backups
- Configure automated Supabase backups
- Test restore procedures regularly
- Store backups in multiple locations

### 2. Application Backups
- Version control all configuration
- Document deployment procedures
- Maintain rollback procedures

## Troubleshooting

### Common Issues
1. **Database Connection**: Check Supabase credentials and network access
2. **Webhook Failures**: Verify signature validation and endpoint accessibility
3. **Rate Limiting**: Monitor and adjust limits based on usage
4. **Memory Issues**: Monitor memory usage and adjust container limits

### Debug Commands
```bash
# Check container logs
docker logs payment-service

# Check health endpoint
curl http://localhost:3000/api/payments/health

# Check database connection
docker exec -it payment-service npm run db:test

# Check Redis connection
docker exec -it redis redis-cli ping
```