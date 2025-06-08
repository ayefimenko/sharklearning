// Retry Mechanism with Exponential Backoff and Jitter
// Provides intelligent retry logic for transient failures

const { logger } = require('../utils/logger');

// Retry strategies
const RETRY_STRATEGIES = {
  FIXED: 'FIXED',                    // Fixed delay between retries
  EXPONENTIAL: 'EXPONENTIAL',        // Exponential backoff
  LINEAR: 'LINEAR',                  // Linear increase in delay
  FIBONACCI: 'FIBONACCI'             // Fibonacci sequence delays
};

// Jitter types
const JITTER_TYPES = {
  NONE: 'NONE',                      // No jitter
  FULL: 'FULL',                      // Full jitter (0 to delay)
  EQUAL: 'EQUAL',                    // Equal jitter (delay/2 to delay)
  DECORRELATED: 'DECORRELATED'       // Decorrelated jitter
};

class RetryMechanism {
  constructor(options = {}) {
    this.options = {
      // Basic retry settings
      maxRetries: options.maxRetries || 3,
      baseDelay: options.baseDelay || 1000,              // Base delay in ms
      maxDelay: options.maxDelay || 30000,               // Maximum delay in ms
      
      // Strategy and jitter
      strategy: options.strategy || RETRY_STRATEGIES.EXPONENTIAL,
      jitterType: options.jitterType || JITTER_TYPES.EQUAL,
      
      // Multipliers and factors
      exponentialBase: options.exponentialBase || 2,
      linearIncrement: options.linearIncrement || 1000,
      
      // Conditional retry settings
      retryCondition: options.retryCondition || this.defaultRetryCondition,
      abortCondition: options.abortCondition || null,
      
      // Timeout settings
      timeout: options.timeout || 30000,
      timeoutMultiplier: options.timeoutMultiplier || 1.5,
      
      // Service identification
      serviceName: options.serviceName || 'unknown-service',
      operationName: options.operationName || 'unknown-operation',
      
      // Callbacks
      onRetry: options.onRetry || null,
      onSuccess: options.onSuccess || null,
      onFailure: options.onFailure || null,
      onAbort: options.onAbort || null,
      
      ...options
    };
    
    // Metrics
    this.metrics = {
      totalAttempts: 0,
      totalRetries: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalAborts: 0,
      averageAttempts: 0,
      retryReasons: new Map()
    };
    
    logger.debug('Retry mechanism initialized', {
      serviceName: this.options.serviceName,
      operationName: this.options.operationName,
      maxRetries: this.options.maxRetries,
      strategy: this.options.strategy,
      baseDelay: this.options.baseDelay
    });
  }
  
  // Default retry condition - retry on network errors and 5xx responses
  defaultRetryCondition(error, attempt, response) {
    // Don't retry client errors (4xx)
    if (response && response.status >= 400 && response.status < 500) {
      return false;
    }
    
    // Retry on network errors
    if (error && (
      error.code === 'ECONNRESET' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'REQUEST_TIMEOUT'
    )) {
      return true;
    }
    
    // Retry on server errors (5xx)
    if (response && response.status >= 500) {
      return true;
    }
    
    // Retry on specific error types
    if (error && error.message) {
      const retryableMessages = [
        'timeout',
        'connection reset',
        'socket hang up',
        'network error',
        'service unavailable'
      ];
      
      const message = error.message.toLowerCase();
      return retryableMessages.some(msg => message.includes(msg));
    }
    
    return false;
  }
  
  // Execute function with retry logic
  async execute(fn, ...args) {
    const startTime = Date.now();
    let lastError = null;
    let lastResponse = null;
    let previousDelay = 0;
    
    for (let attempt = 1; attempt <= this.options.maxRetries + 1; attempt++) {
      this.metrics.totalAttempts++;
      
      try {
        logger.debug('Executing attempt', {
          serviceName: this.options.serviceName,
          operationName: this.options.operationName,
          attempt,
          maxRetries: this.options.maxRetries
        });
        
        // Execute with timeout
        const result = await this.executeWithTimeout(fn, attempt, ...args);
        
        // Success!
        this.metrics.totalSuccesses++;
        this.updateAverageAttempts(attempt);
        
        const totalTime = Date.now() - startTime;
        
        logger.info('Operation succeeded', {
          serviceName: this.options.serviceName,
          operationName: this.options.operationName,
          attempt,
          totalTime,
          retriesUsed: attempt - 1
        });
        
        if (this.options.onSuccess) {
          this.options.onSuccess(result, attempt, totalTime);
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        lastResponse = error.response;
        
        // Check abort condition first
        if (this.options.abortCondition && this.options.abortCondition(error, attempt, lastResponse)) {
          this.metrics.totalAborts++;
          
          logger.warn('Operation aborted', {
            serviceName: this.options.serviceName,
            operationName: this.options.operationName,
            attempt,
            reason: 'abort_condition_met',
            error: error.message
          });
          
          if (this.options.onAbort) {
            this.options.onAbort(error, attempt);
          }
          
          throw error;
        }
        
        // Check if we should retry
        const shouldRetry = attempt <= this.options.maxRetries && 
                           this.options.retryCondition(error, attempt, lastResponse);
        
        if (!shouldRetry) {
          // No more retries
          this.metrics.totalFailures++;
          this.updateAverageAttempts(attempt);
          
          const totalTime = Date.now() - startTime;
          
          logger.error('Operation failed after all retries', {
            serviceName: this.options.serviceName,
            operationName: this.options.operationName,
            totalAttempts: attempt,
            totalTime,
            finalError: error.message,
            errorCode: error.code
          });
          
          if (this.options.onFailure) {
            this.options.onFailure(error, attempt, totalTime);
          }
          
          throw error;
        }
        
        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, previousDelay);
        previousDelay = delay;
        
        // Track retry reason
        const retryReason = this.getRetryReason(error, lastResponse);
        this.trackRetryReason(retryReason);
        
        this.metrics.totalRetries++;
        
        logger.warn('Operation failed, retrying', {
          serviceName: this.options.serviceName,
          operationName: this.options.operationName,
          attempt,
          nextAttempt: attempt + 1,
          delay,
          reason: retryReason,
          error: error.message,
          errorCode: error.code
        });
        
        if (this.options.onRetry) {
          this.options.onRetry(error, attempt, delay);
        }
        
        // Wait before next attempt
        await this.sleep(delay);
      }
    }
    
    // This should never be reached, but just in case
    throw lastError;
  }
  
  // Execute function with timeout
  async executeWithTimeout(fn, attempt, ...args) {
    const timeout = this.calculateTimeout(attempt);
    
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const timeoutError = new Error(`Operation timeout after ${timeout}ms (attempt ${attempt})`);
        timeoutError.code = 'REQUEST_TIMEOUT';
        timeoutError.timeout = timeout;
        timeoutError.attempt = attempt;
        reject(timeoutError);
      }, timeout);
      
      try {
        const result = await fn(...args);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }
  
  // Calculate delay based on strategy
  calculateDelay(attempt, previousDelay) {
    let delay;
    
    switch (this.options.strategy) {
      case RETRY_STRATEGIES.FIXED:
        delay = this.options.baseDelay;
        break;
        
      case RETRY_STRATEGIES.EXPONENTIAL:
        delay = this.options.baseDelay * Math.pow(this.options.exponentialBase, attempt - 1);
        break;
        
      case RETRY_STRATEGIES.LINEAR:
        delay = this.options.baseDelay + (this.options.linearIncrement * (attempt - 1));
        break;
        
      case RETRY_STRATEGIES.FIBONACCI:
        delay = this.calculateFibonacciDelay(attempt);
        break;
        
      default:
        delay = this.options.baseDelay;
    }
    
    // Apply maximum delay limit
    delay = Math.min(delay, this.options.maxDelay);
    
    // Apply jitter
    delay = this.applyJitter(delay, previousDelay);
    
    return Math.max(delay, 0);
  }
  
  // Calculate Fibonacci delay
  calculateFibonacciDelay(attempt) {
    if (attempt <= 1) return this.options.baseDelay;
    if (attempt === 2) return this.options.baseDelay;
    
    let a = this.options.baseDelay;
    let b = this.options.baseDelay;
    
    for (let i = 3; i <= attempt; i++) {
      const temp = a + b;
      a = b;
      b = temp;
    }
    
    return b;
  }
  
  // Apply jitter to delay
  applyJitter(delay, previousDelay) {
    switch (this.options.jitterType) {
      case JITTER_TYPES.NONE:
        return delay;
        
      case JITTER_TYPES.FULL:
        return Math.random() * delay;
        
      case JITTER_TYPES.EQUAL:
        return delay * 0.5 + (Math.random() * delay * 0.5);
        
      case JITTER_TYPES.DECORRELATED:
        // Decorrelated jitter: random between base delay and 3 * previous delay
        const min = this.options.baseDelay;
        const max = Math.max(min, previousDelay * 3);
        return min + Math.random() * (max - min);
        
      default:
        return delay;
    }
  }
  
  // Calculate timeout for attempt
  calculateTimeout(attempt) {
    return Math.min(
      this.options.timeout * Math.pow(this.options.timeoutMultiplier, attempt - 1),
      this.options.timeout * 5 // Maximum 5x original timeout
    );
  }
  
  // Get retry reason for logging
  getRetryReason(error, response) {
    if (response && response.status >= 500) {
      return `server_error_${response.status}`;
    }
    
    if (error.code) {
      return error.code.toLowerCase();
    }
    
    if (error.message) {
      if (error.message.toLowerCase().includes('timeout')) return 'timeout';
      if (error.message.toLowerCase().includes('network')) return 'network_error';
      if (error.message.toLowerCase().includes('connection')) return 'connection_error';
    }
    
    return 'unknown_error';
  }
  
  // Track retry reasons for metrics
  trackRetryReason(reason) {
    const current = this.metrics.retryReasons.get(reason) || 0;
    this.metrics.retryReasons.set(reason, current + 1);
  }
  
  // Update average attempts metric
  updateAverageAttempts(attempts) {
    const total = this.metrics.totalSuccesses + this.metrics.totalFailures;
    const current = this.metrics.averageAttempts;
    this.metrics.averageAttempts = ((current * (total - 1)) + attempts) / total;
  }
  
  // Sleep utility
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Get metrics
  getMetrics() {
    const retryReasons = {};
    for (const [reason, count] of this.metrics.retryReasons.entries()) {
      retryReasons[reason] = count;
    }
    
    return {
      serviceName: this.options.serviceName,
      operationName: this.options.operationName,
      strategy: this.options.strategy,
      jitterType: this.options.jitterType,
      totals: {
        attempts: this.metrics.totalAttempts,
        retries: this.metrics.totalRetries,
        successes: this.metrics.totalSuccesses,
        failures: this.metrics.totalFailures,
        aborts: this.metrics.totalAborts
      },
      averageAttempts: this.metrics.averageAttempts,
      retryReasons,
      successRate: this.metrics.totalSuccesses / (this.metrics.totalSuccesses + this.metrics.totalFailures) * 100 || 0
    };
  }
  
  // Reset metrics
  resetMetrics() {
    this.metrics = {
      totalAttempts: 0,
      totalRetries: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalAborts: 0,
      averageAttempts: 0,
      retryReasons: new Map()
    };
  }
}

// Convenience function to create retry wrapper
function withRetry(options = {}) {
  const retryMechanism = new RetryMechanism(options);
  
  return async function(fn, ...args) {
    return await retryMechanism.execute(fn, ...args);
  };
}

// Predefined retry configurations
const RETRY_CONFIGS = {
  // Network operations (aggressive retries)
  network: {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    strategy: RETRY_STRATEGIES.EXPONENTIAL,
    jitterType: JITTER_TYPES.EQUAL,
    exponentialBase: 2
  },
  
  // Database operations (moderate retries)
  database: {
    maxRetries: 3,
    baseDelay: 500,
    maxDelay: 10000,
    strategy: RETRY_STRATEGIES.EXPONENTIAL,
    jitterType: JITTER_TYPES.DECORRELATED,
    exponentialBase: 1.5
  },
  
  // API calls (conservative retries)
  api: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 15000,
    strategy: RETRY_STRATEGIES.EXPONENTIAL,
    jitterType: JITTER_TYPES.EQUAL,
    exponentialBase: 2
  },
  
  // Critical operations (minimal retries)
  critical: {
    maxRetries: 2,
    baseDelay: 2000,
    maxDelay: 8000,
    strategy: RETRY_STRATEGIES.LINEAR,
    jitterType: JITTER_TYPES.NONE,
    linearIncrement: 2000
  },
  
  // Background tasks (patient retries)
  background: {
    maxRetries: 10,
    baseDelay: 5000,
    maxDelay: 300000, // 5 minutes
    strategy: RETRY_STRATEGIES.FIBONACCI,
    jitterType: JITTER_TYPES.FULL
  }
};

// Convenience functions for common retry patterns
function networkRetry(options = {}) {
  return new RetryMechanism({ ...RETRY_CONFIGS.network, ...options });
}

function databaseRetry(options = {}) {
  return new RetryMechanism({ ...RETRY_CONFIGS.database, ...options });
}

function apiRetry(options = {}) {
  return new RetryMechanism({ ...RETRY_CONFIGS.api, ...options });
}

function criticalRetry(options = {}) {
  return new RetryMechanism({ ...RETRY_CONFIGS.critical, ...options });
}

function backgroundRetry(options = {}) {
  return new RetryMechanism({ ...RETRY_CONFIGS.background, ...options });
}

module.exports = {
  RetryMechanism,
  withRetry,
  networkRetry,
  databaseRetry,
  apiRetry,
  criticalRetry,
  backgroundRetry,
  RETRY_STRATEGIES,
  JITTER_TYPES,
  RETRY_CONFIGS
}; 