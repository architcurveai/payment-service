/**
 * Error Sanitization Utilities
 * Prevents sensitive information leakage in error responses
 */

import { logger } from './logger.js';

// Sensitive patterns that should never be exposed
const SENSITIVE_PATTERNS = [
  /key_[a-zA-Z0-9]+/gi,           // API keys
  /secret[_\s]*[=:]\s*[^\s]+/gi,  // Secrets
  /password[_\s]*[=:]\s*[^\s]+/gi, // Passwords
  /token[_\s]*[=:]\s*[^\s]+/gi,   // Tokens
  /bearer\s+[a-zA-Z0-9._-]+/gi,   // Bearer tokens
  /authorization:\s*[^\s]+/gi,     // Authorization headers
  /rzp_[a-zA-Z0-9]+/gi,           // Razorpay keys
  /sk_[a-zA-Z0-9]+/gi,            // Secret keys
  /pk_[a-zA-Z0-9]+/gi,            // Public keys
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, // Email addresses
  /\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/gi, // Credit card numbers
  /\b\d{3}-\d{2}-\d{4}\b/gi,      // SSN format
  /mongodb:\/\/[^\s]+/gi,         // MongoDB connection strings
  /postgres:\/\/[^\s]+/gi,        // PostgreSQL connection strings
  /redis:\/\/[^\s]+/gi,           // Redis connection strings
  /mysql:\/\/[^\s]+/gi,           // MySQL connection strings
];

// Database-specific error patterns
const DB_ERROR_PATTERNS = [
  /duplicate key value violates unique constraint/gi,
  /relation ".*" does not exist/gi,
  /column ".*" does not exist/gi,
  /syntax error at or near/gi,
  /permission denied for/gi,
  /connection refused/gi,
  /timeout expired/gi,
];

// Razorpay-specific error patterns
const RAZORPAY_ERROR_PATTERNS = [
  /BAD_REQUEST_ERROR/gi,
  /GATEWAY_ERROR/gi,
  /SERVER_ERROR/gi,
  /Your account has been suspended/gi,
  /Invalid API key/gi,
];

// Production-safe error messages
const SAFE_ERROR_MESSAGES = {
  // Database errors
  'duplicate key': 'Resource already exists',
  'relation does not exist': 'Resource not found',
  'column does not exist': 'Invalid request format',
  'syntax error': 'Invalid request format',
  'permission denied': 'Access denied',
  'connection refused': 'Service temporarily unavailable',
  'timeout expired': 'Request timeout',
  
  // Razorpay errors
  'BAD_REQUEST_ERROR': 'Invalid payment request',
  'GATEWAY_ERROR': 'Payment gateway error',
  'SERVER_ERROR': 'Payment service temporarily unavailable',
  'account suspended': 'Payment service unavailable',
  'Invalid API key': 'Payment configuration error',
  
  // Generic errors
  'ECONNREFUSED': 'Service temporarily unavailable',
  'ETIMEDOUT': 'Request timeout',
  'ENOTFOUND': 'Service unavailable',
  'ECONNRESET': 'Connection error',
  
  // Default fallbacks
  'default_client': 'Bad request',
  'default_server': 'Internal server error',
  'default_auth': 'Authentication failed',
  'default_forbidden': 'Access denied',
  'default_notfound': 'Resource not found',
  'default_validation': 'Invalid input provided'
};

class ErrorSanitizer {
  /**
   * Sanitize error message for client response
   */
  static sanitizeError(error, isProduction = process.env.NODE_ENV === 'production') {
    if (!error) {
      return {
        message: SAFE_ERROR_MESSAGES.default_server,
        code: 'INTERNAL_ERROR',
        statusCode: 500
      };
    }

    const originalMessage = error.message || error.toString();
    const statusCode = error.statusCode || error.status || 500;
    const errorCode = error.code || 'UNKNOWN_ERROR';

    // In development, return more detailed errors (but still sanitized)
    if (!isProduction) {
      return {
        message: this.sanitizeMessage(originalMessage),
        code: errorCode,
        statusCode,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        originalError: process.env.NODE_ENV === 'development' ? originalMessage : undefined
      };
    }

    // Production: return safe, generic messages
    const safeMessage = this.getSafeMessage(originalMessage, statusCode);
    
    return {
      message: safeMessage,
      code: this.getSafeErrorCode(errorCode),
      statusCode
    };
  }

  /**
   * Remove sensitive information from error message
   */
  static sanitizeMessage(message) {
    if (!message || typeof message !== 'string') {
      return 'An error occurred';
    }

    let sanitized = message;

    // Remove sensitive patterns
    SENSITIVE_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    // Remove file paths that might contain sensitive info
    sanitized = sanitized.replace(/\/[^\s]*\/[^\s]*/g, '[PATH_REDACTED]');

    // Remove IP addresses
    sanitized = sanitized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP_REDACTED]');

    // Remove port numbers in connection strings
    sanitized = sanitized.replace(/:\d{4,5}/g, ':[PORT]');

    return sanitized;
  }

  /**
   * Get production-safe error message
   */
  static getSafeMessage(originalMessage, statusCode) {
    const message = originalMessage.toLowerCase();

    // Check for specific error patterns
    for (const [pattern, safeMessage] of Object.entries(SAFE_ERROR_MESSAGES)) {
      if (pattern.startsWith('default_')) continue;
      
      if (message.includes(pattern.toLowerCase())) {
        return safeMessage;
      }
    }

    // Fallback based on status code
    if (statusCode >= 400 && statusCode < 500) {
      if (statusCode === 401) return SAFE_ERROR_MESSAGES.default_auth;
      if (statusCode === 403) return SAFE_ERROR_MESSAGES.default_forbidden;
      if (statusCode === 404) return SAFE_ERROR_MESSAGES.default_notfound;
      if (statusCode === 422) return SAFE_ERROR_MESSAGES.default_validation;
      return SAFE_ERROR_MESSAGES.default_client;
    }

    return SAFE_ERROR_MESSAGES.default_server;
  }

  /**
   * Get safe error code
   */
  static getSafeErrorCode(originalCode) {
    const sensitiveCodePatterns = [
      /key/gi,
      /secret/gi,
      /token/gi,
      /auth/gi
    ];

    for (const pattern of sensitiveCodePatterns) {
      if (pattern.test(originalCode)) {
        return 'AUTHENTICATION_ERROR';
      }
    }

    return originalCode;
  }

  /**
   * Log error with full details (for internal use)
   */
  static logError(error, context = {}) {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode || error.status,
      name: error.name,
      context,
      timestamp: new Date().toISOString()
    };

    // Log based on severity
    if (error.statusCode >= 500 || !error.statusCode) {
      logger.error('Server error occurred:', errorDetails);
    } else if (error.statusCode >= 400) {
      logger.warn('Client error occurred:', errorDetails);
    } else {
      logger.info('Error handled:', errorDetails);
    }

    return errorDetails;
  }

  /**
   * Create sanitized error response
   */
  static createErrorResponse(error, req = null) {
    // Log full error details internally
    const logContext = req ? {
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId || req.user?.sub
    } : {};

    this.logError(error, logContext);

    // Return sanitized error for client
    const sanitizedError = this.sanitizeError(error);

    return {
      success: false,
      error: sanitizedError.message,
      code: sanitizedError.code,
      timestamp: new Date().toISOString(),
      ...(sanitizedError.stack && { stack: sanitizedError.stack }),
      ...(sanitizedError.originalError && { originalError: sanitizedError.originalError })
    };
  }

  /**
   * Middleware for error sanitization
   */
  static middleware() {
    return (error, req, res, next) => {
      const sanitizedResponse = this.createErrorResponse(error, req);
      const statusCode = error.statusCode || error.status || 500;

      res.status(statusCode).json(sanitizedResponse);
    };
  }
}

export { ErrorSanitizer, SAFE_ERROR_MESSAGES };