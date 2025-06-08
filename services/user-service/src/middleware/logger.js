const morgan = require('morgan');

// Custom token for request ID
morgan.token('req-id', (req) => req.headers['x-request-id'] || 'unknown');

// Custom token for response time in colors
morgan.token('response-time-colored', (req, res) => {
  const responseTime = morgan['response-time'](req, res);
  const time = parseFloat(responseTime);
  
  if (time < 100) return `\x1b[32m${responseTime}ms\x1b[0m`; // Green for fast
  if (time < 500) return `\x1b[33m${responseTime}ms\x1b[0m`; // Yellow for medium
  return `\x1b[31m${responseTime}ms\x1b[0m`; // Red for slow
});

// Custom token for status code with colors
morgan.token('status-colored', (req, res) => {
  const status = res.statusCode;
  let color = '';
  
  if (status >= 500) color = '\x1b[31m'; // Red for server errors
  else if (status >= 400) color = '\x1b[33m'; // Yellow for client errors
  else if (status >= 300) color = '\x1b[36m'; // Cyan for redirects
  else if (status >= 200) color = '\x1b[32m'; // Green for success
  
  return `${color}${status}\x1b[0m`;
});

// Development format with colors and request ID
const developmentFormat = ':method :url :status-colored :response-time-colored - :res[content-length] [:req-id]';

// Production format (JSON for log aggregation)
const productionFormat = morgan.compile(JSON.stringify({
  method: ':method',
  url: ':url',
  status: ':status',
  responseTime: ':response-time',
  contentLength: ':res[content-length]',
  userAgent: ':user-agent',
  requestId: ':req-id',
  timestamp: ':date[iso]',
  service: 'user-service'
}));

// Create logger based on environment
const createLogger = () => {
  if (process.env.NODE_ENV === 'production') {
    return morgan(productionFormat);
  } else {
    return morgan(developmentFormat);
  }
};

// Request ID middleware
const requestIdMiddleware = (req, res, next) => {
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = `usr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  res.setHeader('x-request-id', req.headers['x-request-id']);
  next();
};

// Security logging for auth events
const logAuthEvent = (event, context = {}) => {
  const authLog = {
    timestamp: new Date().toISOString(),
    level: 'SECURITY',
    event,
    service: 'user-service',
    ...context
  };
  
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(authLog));
  } else {
    const eventEmoji = {
      'LOGIN_SUCCESS': '✅',
      'LOGIN_FAILED': '❌',
      'REGISTER_SUCCESS': '👤',
      'TOKEN_INVALID': '🚫',
      'ACCOUNT_LOCKED': '🔒'
    };
    console.log(`${eventEmoji[event] || '🔐'} AUTH EVENT: ${event}`, context);
  }
};

// Error logging utility
const logError = (error, context = {}) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    service: 'user-service',
    ...context
  };
  
  if (process.env.NODE_ENV === 'production') {
    console.error(JSON.stringify(errorLog));
  } else {
    console.error('\x1b[31m❌ USER SERVICE ERROR:\x1b[0m', error.message);
    if (Object.keys(context).length > 0) {
      console.error('\x1b[90mContext:\x1b[0m', context);
    }
    if (error.stack) {
      console.error('\x1b[90mStack:\x1b[0m', error.stack);
    }
  }
};

// Info logging utility
const logInfo = (message, context = {}) => {
  const infoLog = {
    timestamp: new Date().toISOString(),
    level: 'INFO',
    message,
    service: 'user-service',
    ...context
  };
  
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(infoLog));
  } else {
    console.log('\x1b[36mℹ️ USER SERVICE:\x1b[0m', message);
    if (Object.keys(context).length > 0) {
      console.log('\x1b[90mContext:\x1b[0m', context);
    }
  }
};

module.exports = {
  createLogger,
  requestIdMiddleware,
  logError,
  logInfo,
  logAuthEvent
}; 