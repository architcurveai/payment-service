/**
 * Enhanced Authentication Middleware with Session Management
 */

import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { SessionManager } from '../utils/sessionManager.js';
import { ErrorSanitizer } from '../utils/errorSanitizer.js';
import { redisCircuitBreaker } from '../utils/circuitBreaker.js';

let sessionManager = null;

// Initialize session manager with Redis
const initializeSessionManager = async () => {
  if (!sessionManager) {
    try {
      const { queueService } = await import('../services/queueService.js');
      const redisClient = await queueService.getRedisClient();
      sessionManager = new SessionManager(redisClient);
      logger.info('Session manager initialized');
    } catch (error) {
      logger.warn('Failed to initialize session manager:', error);
    }
  }
  return sessionManager;
};

export const authenticateWithSession = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(ErrorSanitizer.createErrorResponse(
        new Error('No valid authorization token provided')
      ));
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json(ErrorSanitizer.createErrorResponse(
        new Error('No token provided')
      ));
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      logger.warn('JWT verification failed:', { error: jwtError.message });
      return res.status(401).json(ErrorSanitizer.createErrorResponse(
        new Error('Invalid or expired token')
      ));
    }

    // Initialize session manager if needed
    const sm = await initializeSessionManager();
    
    if (sm) {
      // Check if token is blacklisted
      const isBlacklisted = await sm.isTokenBlacklisted(token);
      if (isBlacklisted) {
        logger.warn('Blacklisted token used:', { 
          userId: decoded.userId || decoded.sub,
          tokenHash: sm.hashToken(token)
        });
        return res.status(401).json(ErrorSanitizer.createErrorResponse(
          new Error('Token has been invalidated')
        ));
      }

      // Check if user has been globally invalidated
      const userId = decoded.userId || decoded.sub;
      const isUserInvalidated = await sm.isUserInvalidated(userId);
      if (isUserInvalidated) {
        logger.warn('Invalidated user attempted access:', { userId });
        return res.status(401).json(ErrorSanitizer.createErrorResponse(
          new Error('User session has been invalidated')
        ));
      }

      // Track session activity
      const sessionId = decoded.sessionId || decoded.jti || 'unknown';
      await sm.updateSessionActivity(userId, sessionId);
    }

    // Add user info to request
    req.user = decoded;
    req.token = token;
    
    logger.debug('User authenticated successfully', { 
      userId: decoded.userId || decoded.sub 
    });
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json(ErrorSanitizer.createErrorResponse(error));
  }
};

// Legacy authenticate function for backward compatibility
export const authenticate = authenticateWithSession;

// Session management endpoints
export const sessionController = {
  // Invalidate current token
  async invalidateToken(req, res) {
    try {
      const sm = await initializeSessionManager();
      if (!sm) {
        return res.status(503).json(ErrorSanitizer.createErrorResponse(
          new Error('Session management unavailable')
        ));
      }

      const userId = req.user?.userId || req.user?.sub;
      await sm.invalidateToken(req.token, userId);

      res.json({
        success: true,
        message: 'Token invalidated successfully'
      });
    } catch (error) {
      res.status(500).json(ErrorSanitizer.createErrorResponse(error));
    }
  },

  // Invalidate all user sessions
  async invalidateAllSessions(req, res) {
    try {
      const sm = await initializeSessionManager();
      if (!sm) {
        return res.status(503).json(ErrorSanitizer.createErrorResponse(
          new Error('Session management unavailable')
        ));
      }

      const userId = req.user?.userId || req.user?.sub;
      await sm.invalidateAllUserSessions(userId);

      res.json({
        success: true,
        message: 'All sessions invalidated successfully'
      });
    } catch (error) {
      res.status(500).json(ErrorSanitizer.createErrorResponse(error));
    }
  },

  // Get active sessions
  async getActiveSessions(req, res) {
    try {
      const sm = await initializeSessionManager();
      if (!sm) {
        return res.status(503).json(ErrorSanitizer.createErrorResponse(
          new Error('Session management unavailable')
        ));
      }

      const userId = req.user?.userId || req.user?.sub;
      const sessions = await sm.getUserSessions(userId);

      res.json({
        success: true,
        sessions: sessions.map(session => ({
          sessionId: session.sessionId,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          // Don't expose sensitive session data
        }))
      });
    } catch (error) {
      res.status(500).json(ErrorSanitizer.createErrorResponse(error));
    }
  },

  // Get session statistics (admin only)
  async getSessionStats(req, res) {
    try {
      const sm = await initializeSessionManager();
      if (!sm) {
        return res.status(503).json(ErrorSanitizer.createErrorResponse(
          new Error('Session management unavailable')
        ));
      }

      const stats = await sm.getSessionStats();
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      res.status(500).json(ErrorSanitizer.createErrorResponse(error));
    }
  }
};

export { SessionManager };