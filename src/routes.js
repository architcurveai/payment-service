import express from 'express';
import { 
  createOrder, 
  capturePayment, 
  verifyWebhook, 
  getPaymentStatus, 
  getUserPayments, 
  createRefund, 
  verifyPaymentSignature 
} from './controllers/paymentController.js';
import { authenticate } from './middleware/auth.js';
import { validatePayment, validateCapture, validateRefund, validateSignature } from './middleware/validate.js';

const router = express.Router();

// Create payment order
router.post('/create-order', authenticate, validatePayment, createOrder);

// Capture payment
router.post('/capture', authenticate, validateCapture, capturePayment);

// Get payment status
router.get('/status/:orderId', authenticate, getPaymentStatus);

// Get user payment history
router.get('/history', authenticate, getUserPayments);

// Create refund
router.post('/refund', authenticate, validateRefund, createRefund);

// Verify payment signature (for frontend)
router.post('/verify-signature', authenticate, validateSignature, verifyPaymentSignature);

// Webhook for payment verification (no auth required)
router.post('/webhook', verifyWebhook);

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'payment-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export default router;