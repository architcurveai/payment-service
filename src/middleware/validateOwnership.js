import { supabaseService } from '../services/supabaseService.js';
import { PaymentError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// Middleware to validate that a payment order belongs to the authenticated user
export const validateOwnership = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.userId || req.user?.sub;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User authentication required' 
      });
    }

    if (!orderId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Order ID is required' 
      });
    }

    // Get order from database and verify ownership
    const dbOrder = await supabaseService.getPaymentOrder(orderId);
    
    if (!dbOrder) {
      logger.warn(`Order not found: ${orderId}`, { userId });
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found' 
      });
    }

    if (dbOrder.user_id !== userId) {
      logger.warn(`Unauthorized access attempt to order: ${orderId}`, { 
        userId, 
        orderUserId: dbOrder.user_id 
      });
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied: Order does not belong to user' 
      });
    }

    // Add order to request for use in controller
    req.order = dbOrder;
    next();
  } catch (error) {
    logger.error('Error in validateOwnership middleware:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error during ownership validation' 
    });
  }
};