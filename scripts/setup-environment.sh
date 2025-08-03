#!/bin/bash

# Environment Setup Script for Razorpay Payment Service
# This script helps automate the environment setup process

set -e  # Exit on any error

echo "🚀 Razorpay Payment Service - Environment Setup"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "\n${BLUE}[STEP]${NC} $1"
}

# Check if required tools are installed
check_prerequisites() {
    print_step "Checking prerequisites..."
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_status "Node.js found: $NODE_VERSION"
    else
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_status "npm found: $NPM_VERSION"
    else
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    # Check if Docker is available (optional)
    if command -v docker &> /dev/null; then
        print_status "Docker found (optional for Redis)"
    else
        print_warning "Docker not found. You'll need to install Redis manually or use cloud Redis."
    fi
}

# Create environment file
create_env_file() {
    print_step "Creating environment file..."
    
    if [ -f ".env" ]; then
        print_warning ".env file already exists. Creating backup..."
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    fi
    
    # Copy from example
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_status ".env file created from .env.example"
    else
        print_error ".env.example file not found!"
        exit 1
    fi
}

# Collect user inputs for configuration
collect_credentials() {
    print_step "Collecting credentials..."
    
    echo "Please provide the following credentials:"
    echo "You can skip any field and configure it manually later in .env file"
    echo ""
    
    # Supabase credentials
    echo "📊 Supabase Configuration:"
    read -p "Supabase URL (https://your-project.supabase.co): " SUPABASE_URL
    read -p "Supabase Service Role Key: " SUPABASE_SERVICE_ROLE_KEY
    echo ""
    
    # Redis credentials
    echo "🔴 Redis Configuration:"
    echo "1. Local Redis (redis://localhost:6379)"
    echo "2. Redis Cloud (recommended for production)"
    echo "3. Custom Redis URL"
    read -p "Choose option (1-3): " REDIS_CHOICE
    
    case $REDIS_CHOICE in
        1)
            REDIS_URL="redis://localhost:6379"
            ;;
        2)
            echo ""
            echo "📋 Redis Cloud Setup Instructions:"
            echo "1. Go to https://redis.com/try-free/"
            echo "2. Create account and new database"
            echo "3. Copy the connection URL from dashboard"
            echo ""
            echo "Example Redis Cloud URL formats:"
            echo "redis://default:password@redis-12345.c1.us-east-1-1.ec2.cloud.redislabs.com:12345"
            echo "rediss://default:password@redis-12345.c1.us-east-1-1.ec2.cloud.redislabs.com:12345 (SSL)"
            echo ""
            read -p "Enter your Redis Cloud URL: " REDIS_URL
            ;;
        3)
            read -p "Enter custom Redis URL: " REDIS_URL
            ;;
    esac
    echo ""
    
    # Razorpay credentials
    echo "💳 Razorpay Configuration:"
    read -p "Razorpay Key ID (rzp_test_xxx or rzp_live_xxx): " RAZORPAY_KEY_ID
    read -p "Razorpay Key Secret: " RAZORPAY_KEY_SECRET
    read -p "Razorpay Webhook Secret: " RAZORPAY_WEBHOOK_SECRET
    echo ""
    
    # JWT Secret
    echo "🔐 Security Configuration:"
    read -p "JWT Secret (min 32 characters): " JWT_SECRET
    if [ ${#JWT_SECRET} -lt 32 ]; then
        print_warning "JWT Secret should be at least 32 characters. Generating one..."
        JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
    fi
    echo ""
    
    # Allowed Origins
    read -p "Allowed Origins (comma-separated, e.g., http://localhost:3000,https://curveai.com): " ALLOWED_ORIGINS
}

# Update environment file with collected credentials
update_env_file() {
    print_step "Updating .env file with your credentials..."
    
    # Update .env file with collected values
    if [ ! -z "$SUPABASE_URL" ]; then
        sed -i.bak "s|SUPABASE_URL=.*|SUPABASE_URL=$SUPABASE_URL|" .env
    fi
    
    if [ ! -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        sed -i.bak "s|SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY|" .env
    fi
    
    if [ ! -z "$REDIS_URL" ]; then
        sed -i.bak "s|REDIS_URL=.*|REDIS_URL=$REDIS_URL|" .env
    fi
    
    if [ ! -z "$RAZORPAY_KEY_ID" ]; then
        sed -i.bak "s|RAZORPAY_KEY_ID=.*|RAZORPAY_KEY_ID=$RAZORPAY_KEY_ID|" .env
    fi
    
    if [ ! -z "$RAZORPAY_KEY_SECRET" ]; then
        sed -i.bak "s|RAZORPAY_KEY_SECRET=.*|RAZORPAY_KEY_SECRET=$RAZORPAY_KEY_SECRET|" .env
    fi
    
    if [ ! -z "$RAZORPAY_WEBHOOK_SECRET" ]; then
        sed -i.bak "s|RAZORPAY_WEBHOOK_SECRET=.*|RAZORPAY_WEBHOOK_SECRET=$RAZORPAY_WEBHOOK_SECRET|" .env
    fi
    
    if [ ! -z "$JWT_SECRET" ]; then
        sed -i.bak "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
    fi
    
    if [ ! -z "$ALLOWED_ORIGINS" ]; then
        sed -i.bak "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=$ALLOWED_ORIGINS|" .env
    fi
    
    # Remove backup file
    rm -f .env.bak
    
    print_status "Environment file updated successfully!"
}

# Install dependencies
install_dependencies() {
    print_step "Installing dependencies..."
    
    if [ -f "package.json" ]; then
        npm install
        print_status "Dependencies installed successfully!"
    else
        print_error "package.json not found!"
        exit 1
    fi
}

# Setup local Redis with Docker (optional)
setup_local_redis() {
    print_step "Setting up local Redis with Docker..."
    
    if command -v docker &> /dev/null; then
        read -p "Do you want to set up local Redis with Docker? (y/n): " SETUP_REDIS
        
        if [ "$SETUP_REDIS" = "y" ] || [ "$SETUP_REDIS" = "Y" ]; then
            # Create Redis docker-compose file
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
    command: redis-server --appendonly yes
    restart: unless-stopped

volumes:
  redis_data:
EOF
            
            # Start Redis
            docker-compose -f docker-compose.redis.yml up -d
            
            # Wait for Redis to start
            sleep 5
            
            # Test Redis connection
            if docker exec payment-redis redis-cli ping &> /dev/null; then
                print_status "Redis started successfully!"
                
                # Update .env file for local Redis
                sed -i.bak "s|REDIS_URL=.*|REDIS_URL=redis://localhost:6379|" .env
                rm -f .env.bak
            else
                print_error "Failed to start Redis"
            fi
        fi
    else
        print_warning "Docker not available. Please set up Redis manually or use cloud Redis."
    fi
}

# Create test configuration script
create_test_script() {
    print_step "Creating configuration test script..."
    
    cat > test-config.js << 'EOF'
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import IORedis from 'ioredis';

dotenv.config();

async function testConfiguration() {
  console.log('🧪 Testing Environment Configuration...\n');

  let allTestsPassed = true;

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
    allTestsPassed = false;
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
    allTestsPassed = false;
  }

  // Test Razorpay credentials format
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
    allTestsPassed = false;
  }

  if (allTestsPassed) {
    console.log('\n🎉 All configurations are valid!');
    console.log('\nNext steps:');
    console.log('1. Run database schema in Supabase (see docs/ENVIRONMENT_SETUP_GUIDE.md)');
    console.log('2. Start the service: npm run dev');
    console.log('3. Configure webhook URL in Razorpay dashboard');
  } else {
    console.log('\n❌ Some configurations failed. Please check your .env file.');
  }
}

testConfiguration().catch(console.error);
EOF
    
    print_status "Test script created: test-config.js"
}

# Run configuration test
run_tests() {
    print_step "Running configuration tests..."
    
    if [ -f "test-config.js" ]; then
        node test-config.js
    else
        print_error "Test script not found!"
    fi
}

# Display next steps
show_next_steps() {
    print_step "Setup completed! Next steps:"
    
    echo ""
    echo "📋 Manual steps required:"
    echo "1. 🗄️  Run database schema in Supabase:"
    echo "   - Go to Supabase dashboard > SQL Editor"
    echo "   - Copy content from database/schema.sql"
    echo "   - Run the SQL to create all tables"
    echo ""
    echo "2. 🌐 Configure webhook URL in Razorpay:"
    echo "   - Go to Razorpay dashboard > Settings > Webhooks"
    echo "   - Add webhook URL: https://your-domain.com/api/payments/webhook"
    echo "   - Use the webhook secret from your .env file"
    echo ""
    echo "3. 🚀 Start the service:"
    echo "   npm run dev"
    echo ""
    echo "4. 🧪 Test the setup:"
    echo "   node test-config.js"
    echo ""
    echo "📚 For detailed instructions, see:"
    echo "   docs/ENVIRONMENT_SETUP_GUIDE.md"
    echo ""
    print_status "Environment setup completed successfully! 🎉"
}

# Main execution
main() {
    check_prerequisites
    create_env_file
    
    echo ""
    read -p "Do you want to configure credentials interactively? (y/n): " CONFIGURE_INTERACTIVE
    
    if [ "$CONFIGURE_INTERACTIVE" = "y" ] || [ "$CONFIGURE_INTERACTIVE" = "Y" ]; then
        collect_credentials
        update_env_file
    else
        print_warning "Skipping interactive configuration. Please edit .env file manually."
    fi
    
    install_dependencies
    setup_local_redis
    create_test_script
    
    echo ""
    read -p "Do you want to run configuration tests now? (y/n): " RUN_TESTS
    
    if [ "$RUN_TESTS" = "y" ] || [ "$RUN_TESTS" = "Y" ]; then
        run_tests
    fi
    
    show_next_steps
}

# Run main function
main "$@"