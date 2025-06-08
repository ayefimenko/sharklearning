const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

// Store for user-specific rate limits (in production, use Redis)
const userLimits = new Map();

// Rate limits by user role
const RATE_LIMITS = {
  admin: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window per admin
    message: 'Admin rate limit exceeded. Try again later.'
  },
  instructor: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per window per instructor
    message: 'Instructor rate limit exceeded. Try again later.'
  },
  student: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per window per student
    message: 'Student rate limit exceeded. Try again later.'
  },
  guest: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Increased from 50 to 1000 for development
    message: 'Guest rate limit exceeded. Please register or try again later.'
  }
};

// Custom key generator based on user ID
const keyGenerator = (req) => {
  let userId = 'guest';
  let userRole = 'guest';

  // Try to extract user info from JWT token
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = `user_${decoded.userId || decoded.id}`;
      userRole = decoded.role || 'student';
    }
  } catch (error) {
    // If token is invalid, treat as guest
    userId = `ip_${req.ip}`;
    userRole = 'guest';
  }

  // Store user role for later use
  req.userRole = userRole;
  req.rateLimitKey = userId;
  
  return userId;
};

// Custom handler that uses role-specific limits
const handler = (req, res) => {
  const userRole = req.userRole || 'guest';
  const limits = RATE_LIMITS[userRole];
  
  res.status(429).json({
    error: limits.message,
    retryAfter: Math.ceil(limits.windowMs / 1000),
    limit: limits.max,
    userRole: userRole,
    timestamp: new Date().toISOString()
  });
};

// Skip function for health checks and monitoring endpoints
const skipSuccessfulRequests = (req, res) => {
  // Skip rate limiting for health checks
  if (req.path === '/health' || req.path === '/api') {
    return true;
  }
  
  // Skip for successful OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS' && res.statusCode < 400) {
    return true;
  }
  
  return false;
};

// Create different rate limiters for different endpoints
const createUserRateLimit = (endpointConfig = {}) => {
  return rateLimit({
    windowMs: endpointConfig.windowMs || 15 * 60 * 1000,
    keyGenerator: keyGenerator,
    handler: handler,
    skip: skipSuccessfulRequests,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Dynamic max based on user role
    max: (req) => {
      const userRole = req.userRole || 'guest';
      const baseLimit = RATE_LIMITS[userRole].max;
      
      // Apply endpoint-specific multiplier if provided
      const multiplier = endpointConfig.multiplier || 1;
      return Math.floor(baseLimit * multiplier);
    },
    message: (req) => {
      const userRole = req.userRole || 'guest';
      return RATE_LIMITS[userRole].message;
    }
  });
};

// Specialized rate limiters for different types of endpoints
const rateLimiters = {
  // General API rate limiter
  general: createUserRateLimit(),
  
  // Authentication endpoints (more restrictive)
  auth: createUserRateLimit({ 
    multiplier: 0.5, // Increased from 0.1 to 0.5 for development
    windowMs: 5 * 60 * 1000 // 5-minute window
  }),
  
  // Upload endpoints (very restrictive)
  upload: createUserRateLimit({ 
    multiplier: 0.05, // 5% of normal limit
    windowMs: 60 * 60 * 1000 // 1-hour window
  }),
  
  // Search endpoints (moderate)
  search: createUserRateLimit({ 
    multiplier: 0.5, // 50% of normal limit
    windowMs: 10 * 60 * 1000 // 10-minute window
  })
};

// Middleware to log rate limit events
const logRateLimit = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    // Log if this is a rate limit response
    if (res.statusCode === 429) {
      console.log(`🚫 Rate limit exceeded:`, {
        userId: req.rateLimitKey,
        userRole: req.userRole,
        ip: req.ip,
        endpoint: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent')
      });
    }
    
    originalJson.call(this, data);
  };
  
  next();
};

module.exports = {
  rateLimiters,
  createUserRateLimit,
  logRateLimit,
  RATE_LIMITS
}; 