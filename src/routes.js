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
import { validateOwnership } from './middleware/validateOwnership.js';
import { validatePayment, validateCapture, validateRefund, validateSignature } from './middleware/validate.js';
import { queueService } from './services/queueService.js';
import { getBullBoardStats } from './services/bullBoardService.js';
import { getSimpleDashboard, getWebhookStats, clearQueue } from './controllers/dashboardController.js';

const router = express.Router();

// Create payment order
router.post('/create-order', authenticate, validatePayment, createOrder);

// Capture payment
router.post('/capture', authenticate, validateCapture, capturePayment);

// Get payment status - CRITICAL: Added validateOwnership for security
router.get('/status/:orderId', authenticate, validateOwnership, getPaymentStatus);

// Get user payment history
router.get('/history', authenticate, getUserPayments);

// Create refund
router.post('/refund', authenticate, validateRefund, createRefund);

// Verify payment signature (for frontend)
router.post('/verify-signature', authenticate, validateSignature, verifyPaymentSignature);

// Webhook for payment verification (no auth required)
router.post('/webhook', verifyWebhook);

// Health check with queue stats
router.get('/health', async (req, res) => {
  try {
    const queueStats = await queueService.getQueueStats();
    const bullBoardStats = getBullBoardStats();
    
    res.json({ 
      status: 'OK', 
      service: 'payment-service',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      queue: queueStats,
      dashboard: bullBoardStats
    });
  } catch (error) {
    res.json({ 
      status: 'OK', 
      service: 'payment-service',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      queue: 'not_initialized',
      dashboard: 'not_available'
    });
  }
});

// Simple Dashboard (no authentication required for development)
router.get('/dashboard', getSimpleDashboard);

// Queue dashboard stats (admin only)
router.get('/admin/stats', authenticate, async (req, res) => {
  try {
    const queueStats = await queueService.getQueueStats();
    const bullBoardStats = getBullBoardStats();
    
    res.json({
      success: true,
      queue: queueStats,
      dashboard: bullBoardStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get queue stats',
      message: error.message
    });
  }
});

// Webhook statistics (no auth required)
router.get('/admin/webhook-stats', getWebhookStats);

// Clear queue jobs (admin only)
router.post('/admin/clear-queue', authenticate, clearQueue);

export default router;