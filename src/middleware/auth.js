import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

export const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer token
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    logger.info(`Authenticated user: ${decoded.userId || decoded.sub}`);
    next();
  } catch (error) {
    logger.error('Authentication failed:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const extractUserId = (req, res, next) => {
  const userId = req.user?.userId || req.user?.sub;
  if (!userId) {
    return next(new Error('User ID is required'));
  }
  req.userId = userId;
  next();
};