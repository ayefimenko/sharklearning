// Circuit Breaker Pattern Implementation
// Provides fault tolerance and prevents cascading failures in microservices

const { logger } = require('../utils/logger');
const EventEmitter = require('events');

// Circuit Breaker States
const STATES = {
  CLOSED: 'CLOSED',       // Normal operation
  OPEN: 'OPEN',           // Circuit is open, failing fast
  HALF_OPEN: 'HALF_OPEN'  // Testing if service has recovered
};

class CircuitBreaker extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Failure threshold settings
      failureThreshold: options.failureThreshold || 5,        // Number of failures before opening
      successThreshold: options.successThreshold || 3,        // Successful calls to close from half-open
      timeout: options.timeout || 30000,                      // Timeout for requests (ms)
      resetTimeout: options.resetTimeout || 60000,            // Time before trying half-open (ms)
      
      // Monitoring window settings
      monitoringWindow: options.monitoringWindow || 60000,    // Time window for failure counting (ms)
      minimumRequests: options.minimumRequests || 10,         // Minimum requests before considering failure rate
      
      // Advanced settings
      errorThresholdPercentage: options.errorThresholdPercentage || 50, // Error percentage to open circuit
      volumeThreshold: options.volumeThreshold || 20,         // Minimum volume of requests
      enableSnapshots: options.enableSnapshots !== false,    // Enable metric snapshots
      maxSnapshots: options.maxSnapshots || 100,             // Maximum snapshots to keep
      
      // Custom error detection
      isErrorFunction: options.isErrorFunction || this.defaultIsError,
      
      // Fallback function
      fallbackFunction: options.fallbackFunction || null,
      
      // Service identification
      serviceName: options.serviceName || 'unknown-service',
      
      ...options
    };
    
    // Internal state
    this.state = STATES.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = Date.now();
    this.lastFailureTime = null;
    
    // Metrics and monitoring
    this.metrics = {
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalTimeouts: 0,
      averageResponseTime: 0,
      recentRequests: []
    };
    
    // Snapshots for time-based analysis
    this.snapshots = [];
    
    // Start monitoring
    this.startMonitoring();
    
    logger.info('Circuit breaker initialized', {
      serviceName: this.options.serviceName,
      failureThreshold: this.options.failureThreshold,
      resetTimeout: this.options.resetTimeout,
      timeout: this.options.timeout
    });
  }
  
  // Default error detection function
  defaultIsError(error, response) {
    // Consider it an error if:
    // 1. It's an actual error/exception
    // 2. HTTP status >= 500 (server errors)
    // 3. Timeout
    if (error) return true;
    if (response && response.status >= 500) return true;
    return false;
  }
  
  // Execute function with circuit breaker protection
  async execute(fn, ...args) {
    const startTime = Date.now();
    
    // Check if circuit should be open
    if (this.isOpen()) {
      const error = new Error(`Circuit breaker is OPEN for service: ${this.options.serviceName}`);
      error.code = 'CIRCUIT_BREAKER_OPEN';
      
      logger.warn('Circuit breaker blocking request', {
        serviceName: this.options.serviceName,
        state: this.state,
        failures: this.failures,
        nextAttempt: new Date(this.nextAttempt).toISOString()
      });
      
      this.emit('fallback', { serviceName: this.options.serviceName, error });
      
      // Try fallback if available
      if (this.options.fallbackFunction) {
        try {
          const fallbackResult = await this.options.fallbackFunction(...args);
          this.recordMetric('fallback_success', Date.now() - startTime);
          return fallbackResult;
        } catch (fallbackError) {
          this.recordMetric('fallback_failure', Date.now() - startTime);
          throw fallbackError;
        }
      }
      
      throw error;
    }
    
    try {
      // Execute the function with timeout
      const result = await this.executeWithTimeout(fn, ...args);
      
      // Record success
      this.onSuccess(Date.now() - startTime);
      
      return result;
    } catch (error) {
      // Record failure
      this.onFailure(error, Date.now() - startTime);
      throw error;
    }
  }
  
  // Execute function with timeout
  async executeWithTimeout(fn, ...args) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const timeoutError = new Error(`Request timeout after ${this.options.timeout}ms`);
        timeoutError.code = 'REQUEST_TIMEOUT';
        timeoutError.timeout = this.options.timeout;
        reject(timeoutError);
      }, this.options.timeout);
      
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
  
  // Handle successful execution
  onSuccess(responseTime) {
    this.metrics.totalRequests++;
    this.metrics.totalSuccesses++;
    this.updateAverageResponseTime(responseTime);
    this.addRecentRequest(true, responseTime);
    
    if (this.state === STATES.HALF_OPEN) {
      this.successes++;
      logger.debug('Circuit breaker half-open success', {
        serviceName: this.options.serviceName,
        successes: this.successes,
        threshold: this.options.successThreshold
      });
      
      if (this.successes >= this.options.successThreshold) {
        this.reset();
      }
    } else if (this.state === STATES.CLOSED) {
      // Reset failure count on successful request
      this.failures = Math.max(0, this.failures - 1);
    }
    
    this.recordMetric('success', responseTime);
    this.emit('success', { serviceName: this.options.serviceName, responseTime });
  }
  
  // Handle failed execution
  onFailure(error, responseTime) {
    this.metrics.totalRequests++;
    this.metrics.totalFailures++;
    
    if (error.code === 'REQUEST_TIMEOUT') {
      this.metrics.totalTimeouts++;
    }
    
    this.updateAverageResponseTime(responseTime);
    this.addRecentRequest(false, responseTime, error);
    
    // Check if this is actually an error
    if (!this.options.isErrorFunction(error)) {
      this.recordMetric('non_error', responseTime);
      return;
    }
    
    this.failures++;
    this.lastFailureTime = Date.now();
    
    logger.warn('Circuit breaker recorded failure', {
      serviceName: this.options.serviceName,
      failures: this.failures,
      threshold: this.options.failureThreshold,
      error: error.message,
      errorCode: error.code
    });
    
    // Check if we should open the circuit
    if (this.shouldOpen()) {
      this.open();
    }
    
    this.recordMetric('failure', responseTime, error);
    this.emit('failure', { serviceName: this.options.serviceName, error, responseTime });
  }
  
  // Determine if circuit should be opened
  shouldOpen() {
    // Already open or insufficient data
    if (this.state === STATES.OPEN) return false;
    
    // Simple threshold check
    if (this.failures >= this.options.failureThreshold) {
      return true;
    }
    
    // Percentage-based check with sufficient volume
    const recentWindow = this.getRecentRequests();
    if (recentWindow.length >= this.options.volumeThreshold) {
      const recentFailures = recentWindow.filter(req => !req.success).length;
      const failureRate = (recentFailures / recentWindow.length) * 100;
      
      if (failureRate >= this.options.errorThresholdPercentage) {
        logger.warn('Circuit breaker opening due to error rate', {
          serviceName: this.options.serviceName,
          failureRate: `${failureRate.toFixed(2)}%`,
          threshold: `${this.options.errorThresholdPercentage}%`,
          totalRequests: recentWindow.length
        });
        return true;
      }
    }
    
    return false;
  }
  
  // Open the circuit
  open() {
    this.state = STATES.OPEN;
    this.nextAttempt = Date.now() + this.options.resetTimeout;
    
    logger.error('Circuit breaker OPENED', {
      serviceName: this.options.serviceName,
      failures: this.failures,
      lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      nextAttempt: new Date(this.nextAttempt).toISOString(),
      resetTimeout: this.options.resetTimeout
    });
    
    this.emit('open', {
      serviceName: this.options.serviceName,
      failures: this.failures,
      nextAttempt: this.nextAttempt
    });
    
    // Schedule automatic half-open attempt
    setTimeout(() => {
      if (this.state === STATES.OPEN) {
        this.halfOpen();
      }
    }, this.options.resetTimeout);
  }
  
  // Move to half-open state
  halfOpen() {
    this.state = STATES.HALF_OPEN;
    this.successes = 0;
    
    logger.info('Circuit breaker moved to HALF-OPEN', {
      serviceName: this.options.serviceName,
      successThreshold: this.options.successThreshold
    });
    
    this.emit('halfOpen', { serviceName: this.options.serviceName });
  }
  
  // Reset circuit breaker to closed state
  reset() {
    const previousState = this.state;
    this.state = STATES.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = Date.now();
    
    logger.info('Circuit breaker CLOSED', {
      serviceName: this.options.serviceName,
      previousState,
      totalRequests: this.metrics.totalRequests,
      totalFailures: this.metrics.totalFailures
    });
    
    this.emit('close', { serviceName: this.options.serviceName, previousState });
  }
  
  // Check if circuit is open
  isOpen() {
    if (this.state === STATES.OPEN) {
      // Check if it's time to try half-open
      if (Date.now() >= this.nextAttempt) {
        this.halfOpen();
        return false;
      }
      return true;
    }
    return false;
  }
  
  // Get current state information
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      nextAttempt: this.nextAttempt,
      lastFailureTime: this.lastFailureTime,
      metrics: { ...this.metrics },
      serviceName: this.options.serviceName
    };
  }
  
  // Update average response time
  updateAverageResponseTime(responseTime) {
    const total = this.metrics.totalRequests;
    const current = this.metrics.averageResponseTime;
    this.metrics.averageResponseTime = ((current * (total - 1)) + responseTime) / total;
  }
  
  // Add request to recent requests buffer
  addRecentRequest(success, responseTime, error = null) {
    const request = {
      timestamp: Date.now(),
      success,
      responseTime,
      error: error ? error.message : null
    };
    
    this.metrics.recentRequests.push(request);
    
    // Keep only requests within monitoring window
    const cutoff = Date.now() - this.options.monitoringWindow;
    this.metrics.recentRequests = this.metrics.recentRequests.filter(
      req => req.timestamp > cutoff
    );
  }
  
  // Get recent requests within monitoring window
  getRecentRequests() {
    const cutoff = Date.now() - this.options.monitoringWindow;
    return this.metrics.recentRequests.filter(req => req.timestamp > cutoff);
  }
  
  // Record metric snapshot
  recordMetric(type, responseTime, error = null) {
    if (!this.options.enableSnapshots) return;
    
    const metric = {
      timestamp: Date.now(),
      type,
      responseTime,
      state: this.state,
      serviceName: this.options.serviceName,
      error: error ? { message: error.message, code: error.code } : null
    };
    
    this.snapshots.push(metric);
    
    // Keep only recent snapshots
    if (this.snapshots.length > this.options.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.options.maxSnapshots);
    }
  }
  
  // Start monitoring and health checks
  startMonitoring() {
    // Periodic health reporting
    setInterval(() => {
      this.reportHealth();
    }, 30000); // Every 30 seconds
    
    // Cleanup old data
    setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute
  }
  
  // Report circuit breaker health
  reportHealth() {
    const recentRequests = this.getRecentRequests();
    const recentFailures = recentRequests.filter(req => !req.success).length;
    const failureRate = recentRequests.length > 0 
      ? (recentFailures / recentRequests.length) * 100 
      : 0;
    
    logger.debug('Circuit breaker health report', {
      serviceName: this.options.serviceName,
      state: this.state,
      totalRequests: this.metrics.totalRequests,
      totalFailures: this.metrics.totalFailures,
      recentRequests: recentRequests.length,
      recentFailures,
      failureRate: `${failureRate.toFixed(2)}%`,
      averageResponseTime: `${this.metrics.averageResponseTime.toFixed(2)}ms`
    });
  }
  
  // Cleanup old data
  cleanup() {
    const cutoff = Date.now() - (this.options.monitoringWindow * 2);
    
    // Clean recent requests
    this.metrics.recentRequests = this.metrics.recentRequests.filter(
      req => req.timestamp > cutoff
    );
    
    // Clean snapshots
    this.snapshots = this.snapshots.filter(
      snapshot => snapshot.timestamp > cutoff
    );
  }
  
  // Get comprehensive metrics
  getMetrics() {
    const recentRequests = this.getRecentRequests();
    const recentFailures = recentRequests.filter(req => !req.success).length;
    
    return {
      serviceName: this.options.serviceName,
      state: this.state,
      currentFailures: this.failures,
      currentSuccesses: this.successes,
      thresholds: {
        failure: this.options.failureThreshold,
        success: this.options.successThreshold,
        errorPercentage: this.options.errorThresholdPercentage
      },
      totals: {
        requests: this.metrics.totalRequests,
        successes: this.metrics.totalSuccesses,
        failures: this.metrics.totalFailures,
        timeouts: this.metrics.totalTimeouts
      },
      recent: {
        requests: recentRequests.length,
        failures: recentFailures,
        failureRate: recentRequests.length > 0 
          ? (recentFailures / recentRequests.length) * 100 
          : 0
      },
      performance: {
        averageResponseTime: this.metrics.averageResponseTime
      },
      timing: {
        lastFailure: this.lastFailureTime,
        nextAttempt: this.nextAttempt
      }
    };
  }
}

module.exports = { CircuitBreaker, STATES }; 