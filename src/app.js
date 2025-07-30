import express from 'express';
import helmet from 'helmet'; 
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from './middleware/rateLimit.js';
import routes from './routes.js';
import { logger } from './utils/logger.js';
import morgan from 'morgan';

// Load environment variables
dotenv.config();

const app = express();

// Security Headers
app.use(helmet());
app.use(helmet.hsts({ maxAge: 63072000 })); // 2 years

// CORS (restrict origins)
app.use(cors({ origin: process.env.ALLOWED_ORIGINS.split(','), methods: ['POST','GET'] }));

// Body Parsing
app.use(express.json({ limit: '100kb' }));

// Request Logging
app.use(morgan('combined', { stream: logger.stream }));

// Rate Limiting
app.use(rateLimit);

// Routes
app.use('/api/payments', routes);

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(err.status || 500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`Payment service running on port ${PORT}`));
