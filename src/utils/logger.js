import winston from 'winston';

let logger;

try {
  // Create base transports array with console transport
  const transports = [];
  
  // Always add console transport with appropriate formatting
  try {
    const consoleFormat = process.env.NODE_ENV === 'production' 
      ? winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        );
    
    transports.push(new winston.transports.Console({
      format: consoleFormat,
      handleExceptions: true,
      handleRejections: true
    }));
  } catch (consoleError) {
    // Fallback to basic console if formatting fails
    console.error('Console transport setup failed, using fallback:', consoleError.message);
    transports.push(new winston.transports.Console());
  }
  
  // Add file transports only in production or when explicitly enabled
  if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
    try {
      // Ensure logs directory exists
      import('fs').then(fs => {
        if (!fs.existsSync('logs')) {
          fs.mkdirSync('logs', { recursive: true });
        }
      }).catch(() => {
        // Ignore directory creation errors in production
      });
      
      transports.push(
        new winston.transports.File({ 
          filename: 'logs/error.log', 
          level: 'error',
          handleExceptions: true
        }),
        new winston.transports.File({ 
          filename: 'logs/combined.log',
          handleExceptions: true
        })
      );
    } catch (fileError) {
      console.warn('File transport setup failed, continuing with console only:', fileError.message);
    }
  }
  
  // Create the logger with error handling
  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'payment-service' },
    transports: transports,
    exitOnError: false, // Don't exit on handled exceptions
    handleExceptions: true,
    handleRejections: true
  });
  
  // Test the logger
  logger.info('Logger initialized successfully');
  
} catch (error) {
  // Ultimate fallback - create a basic console logger
  console.error('Winston logger initialization failed, using console fallback:', error.message);
  
  logger = {
    info: (message, meta) => console.log(`INFO: ${message}`, meta || ''),
    warn: (message, meta) => console.warn(`WARN: ${message}`, meta || ''),
    error: (message, meta) => console.error(`ERROR: ${message}`, meta || ''),
    debug: (message, meta) => console.log(`DEBUG: ${message}`, meta || ''),
    verbose: (message, meta) => console.log(`VERBOSE: ${message}`, meta || ''),
    silly: (message, meta) => console.log(`SILLY: ${message}`, meta || '')
  };
}

// Create a stream object with a 'write' function that will be used by morgan
logger.stream = {
  write: function(message, encoding) {
    try {
      logger.info(message.trim());
    } catch (streamError) {
      console.log(message.trim());
    }
  }
};

export { logger };