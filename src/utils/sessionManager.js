/**
 * Session Management System
 * Handles JWT token invalidation and session tracking
 */

import { logger } from './logger.js';
import { redisCircuitBreaker } from './circuitBreaker.js';

class SessionManager {
  constructor(redisClient) {
    this.redis = redisClient;
    this.blacklistPrefix = 'blacklist:';
    this.sessionPrefix = 'session:';
    this.defaultTTL = 24 * 60 * 60; // 24 hours in seconds
  }

  /**
   * Invalidate a specific JWT token
   */
  async invalidateToken(token, userId = null) {
    try {
      await redisCircuitBreaker.execute(async () => {
        const key = `${this.blacklistPrefix}${token}`;
        await this.redis.setex(key, this.defaultTTL, JSON.stringify({
          invalidatedAt: new Date().toISOString(),
          userId,
          reason: 'manual_invalidation'
        }));
      });

      logger.info('Token invalidated successfully', { userId, tokenHash: this.hashToken(token) });
      return true;
    } catch (error) {
      logger.error('Failed to invalidate token:', error);
      throw new Error('Session invalidation failed');
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllUserSessions(userId) {
    try {
      await redisCircuitBreaker.execute(async () => {
        const sessionKey = `${this.sessionPrefix}${userId}:*`;
        const keys = await this.redis.keys(sessionKey);
        
        if (keys.length > 0) {
          const pipeline = this.redis.pipeline();
          keys.forEach(key => {
            pipeline.del(key);
          });
          await pipeline.exec();
        }

        // Add user to global invalidation list
        const globalInvalidationKey = `user_invalidated:${userId}`;
        await this.redis.setex(globalInvalidationKey, this.defaultTTL, new Date().toISOString());
      });

      logger.info('All user sessions invalidated', { userId });
      return true;
    } catch (error) {
      logger.error('Failed to invalidate user sessions:', error);
      throw new Error('User session invalidation failed');
    }
  }

  /**
   * Check if a token is blacklisted
   */
  async isTokenBlacklisted(token) {
    try {
      return await redisCircuitBreaker.execute(async () => {
        const key = `${this.blacklistPrefix}${token}`;
        const result = await this.redis.get(key);
        return result !== null;
      }, () => false); // Fallback: allow access if Redis is down
    } catch (error) {
      logger.warn('Failed to check token blacklist, allowing access:', error);
      return false; // Fail open for availability
    }
  }

  /**
   * Check if user has been globally invalidated
   */
  async isUserInvalidated(userId) {
    try {
      return await redisCircuitBreaker.execute(async () => {
        const key = `user_invalidated:${userId}`;
        const result = await this.redis.get(key);
        return result !== null;
      }, () => false);
    } catch (error) {
      logger.warn('Failed to check user invalidation, allowing access:', error);
      return false;
    }
  }

  /**
   * Track active session
   */
  async trackSession(userId, sessionId, metadata = {}) {
    try {
      await redisCircuitBreaker.execute(async () => {
        const key = `${this.sessionPrefix}${userId}:${sessionId}`;
        const sessionData = {
          userId,
          sessionId,
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          ...metadata
        };
        await this.redis.setex(key, this.defaultTTL, JSON.stringify(sessionData));
      });
    } catch (error) {
      logger.warn('Failed to track session:', error);
      // Don't throw error - session tracking is not critical
    }
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(userId, sessionId) {
    try {
      await redisCircuitBreaker.execute(async () => {
        const key = `${this.sessionPrefix}${userId}:${sessionId}`;
        const sessionData = await this.redis.get(key);
        
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          parsed.lastActivity = new Date().toISOString();
          await this.redis.setex(key, this.defaultTTL, JSON.stringify(parsed));
        }
      });
    } catch (error) {
      logger.warn('Failed to update session activity:', error);
    }
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId) {
    try {
      return await redisCircuitBreaker.execute(async () => {
        const pattern = `${this.sessionPrefix}${userId}:*`;
        const keys = await this.redis.keys(pattern);
        
        if (keys.length === 0) return [];

        const sessions = await this.redis.mget(keys);
        return sessions
          .filter(session => session !== null)
          .map(session => JSON.parse(session));
      }, () => []);
    } catch (error) {
      logger.error('Failed to get user sessions:', error);
      return [];
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      await redisCircuitBreaker.execute(async () => {
        const patterns = [
          `${this.blacklistPrefix}*`,
          `${this.sessionPrefix}*`,
          'user_invalidated:*'
        ];

        for (const pattern of patterns) {
          const keys = await this.redis.keys(pattern);
          const pipeline = this.redis.pipeline();
          
          for (const key of keys) {
            const ttl = await this.redis.ttl(key);
            if (ttl === -1) { // No expiry set
              pipeline.expire(key, this.defaultTTL);
            }
          }
          
          await pipeline.exec();
        }
      });

      logger.info('Session cleanup completed');
    } catch (error) {
      logger.error('Session cleanup failed:', error);
    }
  }

  /**
   * Hash token for logging (security)
   */
  hashToken(token) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex').substring(0, 8);
  }

  /**
   * Get session statistics
   */
  async getSessionStats() {
    try {
      return await redisCircuitBreaker.execute(async () => {
        const [blacklistedTokens, activeSessions, invalidatedUsers] = await Promise.all([
          this.redis.keys(`${this.blacklistPrefix}*`),
          this.redis.keys(`${this.sessionPrefix}*`),
          this.redis.keys('user_invalidated:*')
        ]);

        return {
          blacklistedTokens: blacklistedTokens.length,
          activeSessions: activeSessions.length,
          invalidatedUsers: invalidatedUsers.length,
          timestamp: new Date().toISOString()
        };
      }, () => ({
        blacklistedTokens: 0,
        activeSessions: 0,
        invalidatedUsers: 0,
        timestamp: new Date().toISOString(),
        error: 'Redis unavailable'
      }));
    } catch (error) {
      logger.error('Failed to get session stats:', error);
      return {
        blacklistedTokens: 0,
        activeSessions: 0,
        invalidatedUsers: 0,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

export { SessionManager };