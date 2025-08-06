# Quick Pricing Page Integration (5 Minutes)

This is a simplified guide to quickly implement payment initiation from pricing page to dashboard.

## 🚀 Quick Implementation

### 1. Frontend: Pricing Page Button

```javascript
// Add this to your pricing page
const handlePlanClick = (planId) => {
  // Store plan selection
  localStorage.setItem('selectedPlan', planId);
  
  // Check if user is logged in
  const isLoggedIn = !!localStorage.getItem('authToken'); // Your auth check
  
  if (isLoggedIn) {
    // Go directly to dashboard with plan
    window.location.href = `/dashboard?plan=${planId}&auto=true`;
  } else {
    // Go to login first
    window.location.href = `/login?plan=${planId}&redirect=dashboard`;
  }
};

// Your pricing buttons
<button onClick={() => handlePlanClick('basic')}>
  Get Basic Plan - ₹999
</button>
<button onClick={() => handlePlanClick('premium')}>
  Get Premium Plan - ₹1999
</button>
```

### 2. Frontend: Dashboard Auto-Payment

```javascript
// Add this to your dashboard component
import { useEffect } from 'react';

const Dashboard = () => {
  useEffect(() => {
    // Check for auto-payment trigger
    const urlParams = new URLSearchParams(window.location.search);
    const planId = urlParams.get('plan');
    const autoStart = urlParams.get('auto') === 'true';
    
    if (planId && autoStart) {
      // Clear URL
      window.history.replaceState({}, '', '/dashboard');
      
      // Start payment
      startPayment(planId);
    }
  }, []);
  
  const startPayment = async (planId) => {
    try {
      // Get/create UUID
      let uuid = localStorage.getItem('payment_uuid');
      if (!uuid) {
        uuid = 'uuid-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('payment_uuid', uuid);
      }
      
      // Create payment order
      const response = await fetch('/api/payments/plan/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          user_uuid: uuid,
          customer_info: {
            name: 'Student', // Get from your user context
            email: 'student@example.com' // Get from your user context
          }
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Open Razorpay
        const options = {
          key: data.razorpay_key,
          amount: data.order.amount,
          currency: data.order.currency,
          order_id: data.order.id,
          name: 'CurveAI',
          description: `Payment for ${data.plan.name}`,
          handler: async (razorpayResponse) => {
            // Verify payment
            const verifyResponse = await fetch('/api/payments/plan/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...razorpayResponse,
                user_uuid: uuid,
                planId
              })
            });
            
            const result = await verifyResponse.json();
            if (result.success) {
              alert('Payment successful! Plan activated.');
              window.location.reload(); // Refresh to show new plan
            }
          }
        };
        
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed. Please try again.');
    }
  };
  
  return (
    <div>
      <h1>Dashboard</h1>
      {/* Your dashboard content */}
    </div>
  );
};
```

### 3. Add Razorpay Script

```html
<!-- Add to your HTML head -->
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

### 4. Backend: Already Done!

The backend endpoints are already created:
- ✅ `GET /api/payments/plans` - Get available plans
- ✅ `POST /api/payments/plan/create-payment` - Create payment
- ✅ `POST /api/payments/plan/verify-payment` - Verify payment

## 🎯 Test Flow

1. **Pricing Page**: Click "Get Basic Plan"
2. **Login** (if not logged in)
3. **Dashboard**: Payment automatically starts
4. **Razorpay**: Complete payment
5. **Success**: Plan activated!

## 📋 Available Plans

The backend has these predefined plans:

```javascript
{
  basic: { name: 'Basic Plan', amount: 999, currency: 'INR' },
  premium: { name: 'Premium Plan', amount: 1999, currency: 'INR' },
  enterprise: { name: 'Enterprise Plan', amount: 4999, currency: 'INR' }
}
```

## 🔧 Customization

### Change Plan Prices
Edit `src/controllers/planController.js`:

```javascript
const PRICING_PLANS = {
  basic: {
    name: 'Basic Plan',
    amount: 1499, // Change price here
    currency: 'INR',
    features: ['Feature 1', 'Feature 2']
  }
  // ... other plans
};
```

### Add New Plans
Add to the `PRICING_PLANS` object:

```javascript
const PRICING_PLANS = {
  // ... existing plans
  student: {
    name: 'Student Plan',
    amount: 499,
    currency: 'INR',
    features: ['Student Feature 1', 'Student Feature 2']
  }
};
```

That's it! Your pricing page now automatically initiates payments when users login and get redirected to the dashboard.