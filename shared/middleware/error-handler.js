// Standardized Error Handling Middleware
// Provides consistent error responses across all microservices

const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode, errorCode, isOperational = true, stack = '') {
    super(message);

    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.validationErrors = errors;
  }
}

class DatabaseError extends AppError {
  constructor(message, originalError) {
    super(message, 500, 'DATABASE_ERROR');
    this.originalError = originalError;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

class ServiceUnavailableError extends AppError {
  constructor(service = 'Service') {
    super(`${service} temporarily unavailable`, 503, 'SERVICE_UNAVAILABLE_ERROR');
  }
}

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error with context
  const errorContext = {
    error: error.message,
    statusCode: error.statusCode,
    errorCode: error.errorCode,
    requestId: req.headers['x-request-id'] || req.id,
    userId: req.user?.userId,
    email: req.user?.email,
    url: req.originalUrl,
    method: req.method,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  };

  // Log based on severity
  if (error.statusCode >= 500) {
    logger.error('Server Error', errorContext);
  } else if (error.statusCode >= 400) {
    logger.warn('Client Error', errorContext);
  }

  // Handle specific error types
  if (err.name === 'CastError') {
    const message = 'Invalid resource ID';
    error = new ValidationError(message);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} already exists`;
    error = new ConflictError(message);
  }

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(val => ({
      field: val.path,
      message: val.message
    }));
    error = new ValidationError('Validation failed', errors);
  }

  if (err.name === 'JsonWebTokenError') {
    error = new AuthenticationError('Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    error = new AuthenticationError('Token expired');
  }

  // Database connection errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    error = new ServiceUnavailableError('Database');
  }

  // Set default error if not operational
  if (!error.isOperational) {
    error = new AppError('Something went wrong', 500, 'INTERNAL_SERVER_ERROR');
  }

  // Prepare response
  const response = {
    success: false,
    error: {
      message: error.message,
      code: error.errorCode,
      ...(error.validationErrors && { validationErrors: error.validationErrors }),
      requestId: errorContext.requestId,
      timestamp: errorContext.timestamp
    }
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = error.stack;
  }

  res.status(error.statusCode || 500).json(response);
};

// Async error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Global unhandled promise rejection handler
const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (err, promise) => {
    logger.error('Unhandled Promise Rejection', {
      error: err.message,
      stack: err.stack,
      promise: promise
    });
    
    // Close server & exit process
    process.exit(1);
  });
};

// Global uncaught exception handler
const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', {
      error: err.message,
      stack: err.stack
    });
    
    // Close server & exit process
    process.exit(1);
  });
};

module.exports = {
  AppError,
  ValidationError,
  DatabaseError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  errorHandler,
  asyncHandler,
  handleUnhandledRejection,
  handleUncaughtException
}; 