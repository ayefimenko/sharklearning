// Enhanced Rate Limiting Middleware
// Implements sophisticated rate limiting with Redis backend, sliding windows, and adaptive limits

const redis = require('redis');
const { logger } = require('../utils/logger');
const { getRedisUrl } = require('../security/secrets-manager');

class EnhancedRateLimiter {
  constructor(options = {}) {
    this.redisClient = null;
    this.defaultConfig = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      keyGenerator: this.defaultKeyGenerator,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      enableSlidingWindow: true,
      enableAdaptiveLimits: false,
      burstLimit: 10, // Allow burst of requests
      burstWindowMs: 60 * 1000, // 1 minute burst window
      ...options
    };
    
    this.initializeRedis();
  }

  async initializeRedis() {
    try {
      const redisUrl = await getRedisUrl();
      this.redisClient = redis.createClient({
        url: redisUrl,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis server refused connection for rate limiter');
            return new Error('Redis server connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Redis connection retry time exhausted');
          }
          if (options.attempt > 10) {
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      await this.redisClient.connect();
      
      logger.info('Rate limiter Redis connection established', {
        redisUrl: redisUrl.replace(/\/\/.*@/, '//***:***@') // Hide credentials in logs
      });
    } catch (error) {
      logger.error('Failed to initialize Redis for rate limiter', {
        error: error.message
      });
      // Fallback to in-memory storage
      this.fallbackStorage = new Map();
    }
  }

  defaultKeyGenerator(req) {
    // Generate key based on IP, user ID (if authenticated), and route
    const ip = req.ip || req.connection.remoteAddress;
    const userId = req.user?.userId || 'anonymous';
    const route = req.route?.path || req.path;
    
    return `rate_limit:${ip}:${userId}:${route}`;
  }

  // Sliding window rate limiting algorithm
  async slidingWindowRateLimit(key, limit, windowMs) {
    try {
      const now = Date.now();
      const windowStart = now - windowMs;
      
      if (this.redisClient && this.redisClient.isOpen) {
        // Redis-based sliding window
        const multi = this.redisClient.multi();
        
        // Remove expired entries
        multi.zremrangebyscore(key, 0, windowStart);
        
        // Count current requests in window
        multi.zcard(key);
        
        // Add current request
        multi.zadd(key, now, `${now}-${Math.random()}`);
        
        // Set expiration
        multi.expire(key, Math.ceil(windowMs / 1000));
        
        const results = await multi.exec();
        const currentCount = results[1];
        
        return {
          allowed: currentCount < limit,
          currentCount,
          limit,
          windowStart,
          resetTime: now + windowMs
        };
      } else {
        // Fallback to in-memory storage
        return this.fallbackSlidingWindow(key, limit, windowMs);
      }
    } catch (error) {
      logger.error('Error in sliding window rate limit', {
        error: error.message,
        key
      });
      // Allow request on error to avoid blocking legitimate traffic
      return { allowed: true, currentCount: 0, limit };
    }
  }

  fallbackSlidingWindow(key, limit, windowMs) {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!this.fallbackStorage.has(key)) {
      this.fallbackStorage.set(key, []);
    }
    
    const requests = this.fallbackStorage.get(key);
    
    // Remove expired requests
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    // Add current request
    validRequests.push(now);
    
    // Update storage
    this.fallbackStorage.set(key, validRequests);
    
    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      this.cleanupFallbackStorage();
    }
    
    return {
      allowed: validRequests.length <= limit,
      currentCount: validRequests.length,
      limit,
      windowStart,
      resetTime: now + windowMs
    };
  }

  cleanupFallbackStorage() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    
    for (const [key, requests] of this.fallbackStorage.entries()) {
      const validRequests = requests.filter(timestamp => now - timestamp < maxAge);
      if (validRequests.length === 0) {
        this.fallbackStorage.delete(key);
      } else {
        this.fallbackStorage.set(key, validRequests);
      }
    }
  }

  // Adaptive rate limiting based on system load
  async getAdaptiveLimit(baseLimit, req) {
    if (!this.defaultConfig.enableAdaptiveLimits) {
      return baseLimit;
    }

    try {
      // Get system metrics (simplified version)
      const systemLoad = await this.getSystemLoad();
      const errorRate = await this.getErrorRate();
      
      let adaptiveLimit = baseLimit;
      
      // Reduce limit if system is under stress
      if (systemLoad > 0.8) {
        adaptiveLimit = Math.floor(baseLimit * 0.5);
      } else if (systemLoad > 0.6) {
        adaptiveLimit = Math.floor(baseLimit * 0.7);
      }
      
      // Reduce limit if error rate is high
      if (errorRate > 0.1) { // 10% error rate
        adaptiveLimit = Math.floor(adaptiveLimit * 0.6);
      }
      
      logger.debug('Adaptive rate limit calculated', {
        baseLimit,
        adaptiveLimit,
        systemLoad,
        errorRate,
        path: req.path
      });
      
      return Math.max(adaptiveLimit, Math.floor(baseLimit * 0.1)); // Never go below 10% of base
    } catch (error) {
      logger.error('Error calculating adaptive limit', { error: error.message });
      return baseLimit;
    }
  }

  async getSystemLoad() {
    // Simplified system load calculation
    // In production, you'd integrate with your monitoring system
    const used = process.memoryUsage();
    const total = process.memoryUsage().heapTotal;
    return used.heapUsed / total;
  }

  async getErrorRate() {
    // Simplified error rate calculation
    // In production, you'd track this more comprehensively
    return 0.05; // 5% baseline error rate
  }

  // Main rate limiting middleware
  createMiddleware(config = {}) {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    return async (req, res, next) => {
      try {
        const key = finalConfig.keyGenerator(req);
        const limit = await this.getAdaptiveLimit(finalConfig.maxRequests, req);
        
        // Check burst limit first
        const burstResult = await this.slidingWindowRateLimit(
          `${key}:burst`,
          finalConfig.burstLimit,
          finalConfig.burstWindowMs
        );
        
        if (!burstResult.allowed) {
          return this.sendRateLimitResponse(res, {
            ...burstResult,
            type: 'burst',
            retryAfter: Math.ceil(finalConfig.burstWindowMs / 1000)
          });
        }
        
        // Check main window limit
        const result = await this.slidingWindowRateLimit(
          key,
          limit,
          finalConfig.windowMs
        );
        
        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': limit,
          'X-RateLimit-Remaining': Math.max(0, limit - result.currentCount),
          'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
          'X-RateLimit-Window': finalConfig.windowMs
        });
        
        if (!result.allowed) {
          return this.sendRateLimitResponse(res, {
            ...result,
            type: 'window',
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
          });
        }
        
        // Log rate limit info
        logger.debug('Rate limit check passed', {
          key,
          currentCount: result.currentCount,
          limit,
          remaining: limit - result.currentCount,
          path: req.path,
          method: req.method,
          ip: req.ip,
          userId: req.user?.userId
        });
        
        next();
      } catch (error) {
        logger.error('Rate limiting error', {
          error: error.message,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        // Allow request on error to avoid blocking legitimate traffic
        next();
      }
    };
  }

  sendRateLimitResponse(res, rateLimitInfo) {
    logger.warn('Rate limit exceeded', {
      type: rateLimitInfo.type,
      currentCount: rateLimitInfo.currentCount,
      limit: rateLimitInfo.limit,
      retryAfter: rateLimitInfo.retryAfter,
      ip: res.req.ip,
      userAgent: res.req.get('User-Agent'),
      path: res.req.path
    });
    
    res.set('Retry-After', rateLimitInfo.retryAfter);
    
    res.status(429).json({
      success: false,
      error: {
        message: `Too many requests. Rate limit exceeded.`,
        code: 'RATE_LIMIT_EXCEEDED',
        details: {
          type: rateLimitInfo.type,
          limit: rateLimitInfo.limit,
          current: rateLimitInfo.currentCount,
          retryAfter: rateLimitInfo.retryAfter,
          resetTime: rateLimitInfo.resetTime
        }
      }
    });
  }

  async close() {
    if (this.redisClient && this.redisClient.isOpen) {
      await this.redisClient.quit();
    }
  }
}

// Predefined rate limiting configurations for different endpoint types
const RATE_LIMIT_CONFIGS = {
  // Authentication endpoints (stricter limits)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // Very strict for login/register
    burstLimit: 3,
    burstWindowMs: 60 * 1000,
    enableAdaptiveLimits: false // Keep auth limits fixed
  },
  
  // API endpoints (moderate limits)
  api: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
    burstLimit: 20,
    burstWindowMs: 60 * 1000,
    enableAdaptiveLimits: true
  },
  
  // Public endpoints (generous limits)
  public: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 1000,
    burstLimit: 100,
    burstWindowMs: 60 * 1000,
    enableAdaptiveLimits: true
  },
  
  // File upload endpoints (special limits)
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50,
    burstLimit: 5,
    burstWindowMs: 5 * 60 * 1000, // 5 minutes
    enableAdaptiveLimits: false
  },
  
  // Admin endpoints (very generous for authenticated admins)
  admin: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 500,
    burstLimit: 50,
    burstWindowMs: 60 * 1000,
    enableAdaptiveLimits: false
  }
};

// Create global rate limiter instance
let globalRateLimiter = null;

function getRateLimiter() {
  if (!globalRateLimiter) {
    globalRateLimiter = new EnhancedRateLimiter();
  }
  return globalRateLimiter;
}

// Convenience functions for different rate limit types
function authRateLimit() {
  return getRateLimiter().createMiddleware(RATE_LIMIT_CONFIGS.auth);
}

function apiRateLimit() {
  return getRateLimiter().createMiddleware(RATE_LIMIT_CONFIGS.api);
}

function publicRateLimit() {
  return getRateLimiter().createMiddleware(RATE_LIMIT_CONFIGS.public);
}

function uploadRateLimit() {
  return getRateLimiter().createMiddleware(RATE_LIMIT_CONFIGS.upload);
}

function adminRateLimit() {
  return getRateLimiter().createMiddleware(RATE_LIMIT_CONFIGS.admin);
}

function customRateLimit(config) {
  return getRateLimiter().createMiddleware(config);
}

module.exports = {
  EnhancedRateLimiter,
  getRateLimiter,
  authRateLimit,
  apiRateLimit,
  publicRateLimit,
  uploadRateLimit,
  adminRateLimit,
  customRateLimit,
  RATE_LIMIT_CONFIGS
}; 