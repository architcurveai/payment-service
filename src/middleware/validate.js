import Joi from 'joi';
import { logger } from '../utils/logger.js';

const paymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  currency: Joi.string().valid('INR', 'USD', 'EUR').default('INR'),
  receipt: Joi.string().optional()
});

const captureSchema = Joi.object({
  paymentId: Joi.string().required(),
  amount: Joi.number().positive().required()
});

export const validatePayment = (req, res, next) => {
  const { error, value } = paymentSchema.validate(req.body);
  
  if (error) {
    logger.error('Validation error:', error.details);
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: error.details.map(d => d.message) 
    });
  }
  
  req.body = value;
  next();
};

export const validateCapture = (req, res, next) => {
  const { error, value } = captureSchema.validate(req.body);
  
  if (error) {
    logger.error('Validation error:', error.details);
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: error.details.map(d => d.message) 
    });
  }
  
  req.body = value;
  next();
};