import express from 'express';
import { createOrder, capturePayment, verifyWebhook } from './controllers/paymentController.js';
import { authenticate } from './middleware/auth.js';
import { validatePayment, validateCapture } from './middleware/validate.js';

const router = express.Router();

// Create payment order
router.post('/create-order', authenticate, validatePayment, createOrder);

// Capture payment
router.post('/capture', authenticate, validateCapture, capturePayment);

// Webhook for payment verification
router.post('/webhook', verifyWebhook);

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'payment-service' });
});

export default router;