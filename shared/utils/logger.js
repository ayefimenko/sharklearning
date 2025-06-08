// Standardized Logging Utility
// Provides structured logging across all microservices

const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }),
  
  // Error log file
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
  
  // Combined log file
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
});

// Enhanced logging methods with context
const enhancedLogger = {
  error: (message, context = {}) => {
    logger.error(message, {
      service: process.env.SERVICE_NAME || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      ...context
    });
  },

  warn: (message, context = {}) => {
    logger.warn(message, {
      service: process.env.SERVICE_NAME || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      ...context
    });
  },

  info: (message, context = {}) => {
    logger.info(message, {
      service: process.env.SERVICE_NAME || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      ...context
    });
  },

  http: (message, context = {}) => {
    logger.http(message, {
      service: process.env.SERVICE_NAME || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      ...context
    });
  },

  debug: (message, context = {}) => {
    logger.debug(message, {
      service: process.env.SERVICE_NAME || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      ...context
    });
  },

  // Security event logging
  security: (event, context = {}) => {
    logger.warn(`SECURITY: ${event}`, {
      service: process.env.SERVICE_NAME || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      type: 'security',
      ...context
    });
  },

  // Authentication event logging
  auth: (event, context = {}) => {
    logger.info(`AUTH: ${event}`, {
      service: process.env.SERVICE_NAME || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      type: 'authentication',
      ...context
    });
  },

  // Business logic event logging
  business: (event, context = {}) => {
    logger.info(`BUSINESS: ${event}`, {
      service: process.env.SERVICE_NAME || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      type: 'business',
      ...context
    });
  },

  // Performance monitoring
  performance: (operation, duration, context = {}) => {
    logger.info(`PERFORMANCE: ${operation} took ${duration}ms`, {
      service: process.env.SERVICE_NAME || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      type: 'performance',
      operation,
      duration,
      ...context
    });
  }
};

// Express middleware for HTTP request logging
const httpLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  enhancedLogger.http('Incoming request', {
    method: req.method,
    url: req.originalUrl,
    requestId: req.headers['x-request-id'],
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    enhancedLogger.http('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.headers['x-request-id'],
      ip: req.ip
    });
  });

  next();
};

// Request ID middleware
const requestIdMiddleware = (req, res, next) => {
  req.id = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.headers['x-request-id'] = req.id;
  res.setHeader('X-Request-ID', req.id);
  next();
};

module.exports = {
  logger: enhancedLogger,
  httpLogger,
  requestIdMiddleware,
  rawLogger: logger // For direct winston access if needed
}; 