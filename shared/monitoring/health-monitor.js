// Health Monitoring System
// Provides comprehensive health checks and dependency monitoring

const { logger } = require('../utils/logger');
const EventEmitter = require('events');

// Health status levels
const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  CRITICAL: 'critical'
};

// Check types
const CHECK_TYPES = {
  DATABASE: 'database',
  EXTERNAL_API: 'external_api',
  CACHE: 'cache',
  MESSAGE_QUEUE: 'message_queue',
  FILE_SYSTEM: 'file_system',
  MEMORY: 'memory',
  CPU: 'cpu',
  DISK: 'disk',
  CUSTOM: 'custom'
};

class HealthCheck {
  constructor(name, checkFunction, options = {}) {
    this.name = name;
    this.checkFunction = checkFunction;
    this.type = options.type || CHECK_TYPES.CUSTOM;
    this.timeout = options.timeout || 5000;
    this.critical = options.critical || false;
    this.enabled = options.enabled !== false;
    
    this.lastStatus = HEALTH_STATUS.HEALTHY;
    this.consecutiveFailures = 0;
    this.totalChecks = 0;
    this.totalFailures = 0;
  }
  
  async execute() {
    if (!this.enabled) {
      return {
        name: this.name,
        status: HEALTH_STATUS.HEALTHY,
        message: 'Check disabled',
        timestamp: Date.now()
      };
    }
    
    this.totalChecks++;
    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        this.checkFunction(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), this.timeout)
        )
      ]);
      
      this.consecutiveFailures = 0;
      this.lastStatus = HEALTH_STATUS.HEALTHY;
      
      return {
        name: this.name,
        type: this.type,
        status: HEALTH_STATUS.HEALTHY,
        message: result.message || 'Check passed',
        details: result.details || {},
        timestamp: Date.now(),
        responseTime: Date.now() - startTime
      };
      
    } catch (error) {
      this.consecutiveFailures++;
      this.totalFailures++;
      
      const status = this.consecutiveFailures >= 3 
        ? (this.critical ? HEALTH_STATUS.CRITICAL : HEALTH_STATUS.UNHEALTHY)
        : HEALTH_STATUS.DEGRADED;
      
      this.lastStatus = status;
      
      return {
        name: this.name,
        type: this.type,
        status,
        message: `Check failed: ${error.message}`,
        error: error.message,
        timestamp: Date.now(),
        responseTime: Date.now() - startTime,
        consecutiveFailures: this.consecutiveFailures
      };
    }
  }
}

class HealthMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.serviceName = options.serviceName || 'unknown-service';
    this.version = options.version || '1.0.0';
    this.checks = new Map();
    this.monitoringInterval = options.monitoringInterval || 30000; // 30 seconds
    this.enableScheduledChecks = options.enableScheduledChecks !== false;
    
    // Overall service health
    this.serviceHealth = {
      status: HEALTH_STATUS.HEALTHY,
      lastUpdate: Date.now(),
      uptime: Date.now()
    };
    
    // Built-in system checks
    this.enableSystemChecks = options.enableSystemChecks !== false;
    
    if (this.enableSystemChecks) {
      this.initializeSystemChecks();
    }
    
    // Start monitoring
    if (this.enableScheduledChecks) {
      this.startScheduledChecks();
    }
    
    logger.info('Health monitor initialized', {
      serviceName: this.serviceName,
      enableSystemChecks: this.enableSystemChecks,
      enableScheduledChecks: this.enableScheduledChecks,
      monitoringInterval: this.monitoringInterval
    });
  }
  
  // Initialize built-in system health checks
  initializeSystemChecks() {
    // Memory usage check
    this.addCheck('memory_usage', async () => {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;
      const heapTotalMB = usage.heapTotal / 1024 / 1024;
      const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;
      
      if (heapUsagePercent > 90) {
        throw new Error(`Memory usage critical: ${heapUsagePercent.toFixed(2)}%`);
      } else if (heapUsagePercent > 80) {
        throw new Error(`Memory usage high: ${heapUsagePercent.toFixed(2)}%`);
      }
      
      return {
        message: `Memory usage normal: ${heapUsagePercent.toFixed(2)}%`,
        details: {
          heapUsed: `${heapUsedMB.toFixed(2)} MB`,
          heapTotal: `${heapTotalMB.toFixed(2)} MB`,
          heapUsagePercent: `${heapUsagePercent.toFixed(2)}%`,
          rss: `${(usage.rss / 1024 / 1024).toFixed(2)} MB`
        }
      };
    }, {
      type: CHECK_TYPES.MEMORY,
      critical: true,
      degradedThreshold: 2,
      unhealthyThreshold: 3
    });
    
    // Event loop lag check
    this.addCheck('event_loop_lag', async () => {
      const start = process.hrtime.bigint();
      
      return new Promise((resolve, reject) => {
        setImmediate(() => {
          const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
          
          if (lag > 100) {
            reject(new Error(`Event loop lag critical: ${lag.toFixed(2)}ms`));
          } else if (lag > 50) {
            reject(new Error(`Event loop lag high: ${lag.toFixed(2)}ms`));
          } else {
            resolve({
              message: `Event loop lag normal: ${lag.toFixed(2)}ms`,
              details: { lag: `${lag.toFixed(2)}ms` }
            });
          }
        });
      });
    }, {
      type: CHECK_TYPES.CPU,
      critical: false,
      degradedThreshold: 3,
      unhealthyThreshold: 5
    });
    
    // Process uptime check
    this.addCheck('process_uptime', async () => {
      const uptime = process.uptime();
      const uptimeHours = uptime / 3600;
      
      return {
        message: `Process running for ${uptimeHours.toFixed(2)} hours`,
        details: {
          uptime: `${uptime.toFixed(2)} seconds`,
          uptimeHours: `${uptimeHours.toFixed(2)} hours`,
          pid: process.pid
        }
      };
    }, {
      type: CHECK_TYPES.CUSTOM,
      critical: false
    });
  }
  
  // Add a health check
  addCheck(name, checkFunction, options = {}) {
    const healthCheck = new HealthCheck(name, checkFunction, options);
    this.checks.set(name, healthCheck);
    
    logger.info('Health check added', {
      name,
      type: options.type || CHECK_TYPES.CUSTOM,
      critical: options.critical || false
    });
    
    return healthCheck;
  }
  
  // Remove a health check
  removeCheck(name) {
    const removed = this.checks.delete(name);
    if (removed) {
      logger.info('Health check removed', { name });
    }
    return removed;
  }
  
  // Execute a specific health check
  async executeCheck(name) {
    const check = this.checks.get(name);
    if (!check) {
      throw new Error(`Health check '${name}' not found`);
    }
    
    return await check.execute();
  }
  
  // Execute all health checks
  async executeAllChecks() {
    const results = [];
    
    for (const [name, check] of this.checks.entries()) {
      try {
        const result = await check.execute();
        results.push(result);
        
        // Emit check completed event
        this.emit('checkCompleted', result);
        
        // Emit status change event if status changed
        if (result.status !== check.lastStatus) {
          this.emit('statusChanged', {
            name,
            oldStatus: check.lastStatus,
            newStatus: result.status,
            result
          });
        }
        
      } catch (error) {
        logger.error('Health check execution failed', {
          name,
          error: error.message
        });
        
        results.push({
          name,
          status: HEALTH_STATUS.CRITICAL,
          message: `Check execution failed: ${error.message}`,
          error: error.message,
          timestamp: Date.now()
        });
      }
    }
    
    // Update overall service health
    this.updateServiceHealth(results);
    
    return results;
  }
  
  // Update overall service health based on check results
  updateServiceHealth(checkResults) {
    let overallStatus = HEALTH_STATUS.HEALTHY;
    let criticalFailures = 0;
    let unhealthyFailures = 0;
    let degradedFailures = 0;
    
    for (const result of checkResults) {
      const check = this.checks.get(result.name);
      
      switch (result.status) {
        case HEALTH_STATUS.CRITICAL:
          criticalFailures++;
          if (check && check.critical) {
            overallStatus = HEALTH_STATUS.CRITICAL;
          }
          break;
        case HEALTH_STATUS.UNHEALTHY:
          unhealthyFailures++;
          if (overallStatus !== HEALTH_STATUS.CRITICAL) {
            overallStatus = HEALTH_STATUS.UNHEALTHY;
          }
          break;
        case HEALTH_STATUS.DEGRADED:
          degradedFailures++;
          if (overallStatus === HEALTH_STATUS.HEALTHY) {
            overallStatus = HEALTH_STATUS.DEGRADED;
          }
          break;
      }
    }
    
    const previousStatus = this.serviceHealth.status;
    this.serviceHealth.status = overallStatus;
    this.serviceHealth.lastUpdate = Date.now();
    
    // Emit service health change event
    if (previousStatus !== overallStatus) {
      this.emit('serviceHealthChanged', {
        oldStatus: previousStatus,
        newStatus: overallStatus,
        criticalFailures,
        unhealthyFailures,
        degradedFailures,
        totalChecks: checkResults.length
      });
      
      logger.warn('Service health status changed', {
        serviceName: this.serviceName,
        oldStatus: previousStatus,
        newStatus: overallStatus,
        criticalFailures,
        unhealthyFailures,
        degradedFailures
      });
    }
  }
  
  // Start scheduled health checks
  startScheduledChecks() {
    if (this.scheduledInterval) {
      return; // Already started
    }
    
    this.scheduledInterval = setInterval(async () => {
      try {
        await this.executeAllChecks();
      } catch (error) {
        logger.error('Scheduled health check execution failed', {
          error: error.message
        });
      }
    }, this.monitoringInterval);
    
    logger.info('Scheduled health checks started', {
      interval: this.monitoringInterval
    });
  }
  
  // Stop scheduled health checks
  stopScheduledChecks() {
    if (this.scheduledInterval) {
      clearInterval(this.scheduledInterval);
      this.scheduledInterval = null;
      logger.info('Scheduled health checks stopped');
    }
  }
  
  // Get overall health status
  getHealthStatus() {
    const checkSummaries = {};
    for (const [name, check] of this.checks.entries()) {
      checkSummaries[name] = check.getSummary();
    }
    
    const uptime = Date.now() - this.serviceHealth.uptime;
    
    return {
      service: this.serviceName,
      version: this.version,
      status: this.serviceHealth.status,
      timestamp: this.serviceHealth.lastUpdate,
      uptime: {
        seconds: Math.floor(uptime / 1000),
        human: this.formatUptime(uptime)
      },
      checks: checkSummaries,
      summary: {
        total: this.checks.size,
        healthy: Object.values(checkSummaries).filter(c => c.lastStatus === HEALTH_STATUS.HEALTHY).length,
        degraded: Object.values(checkSummaries).filter(c => c.lastStatus === HEALTH_STATUS.DEGRADED).length,
        unhealthy: Object.values(checkSummaries).filter(c => c.lastStatus === HEALTH_STATUS.UNHEALTHY).length,
        critical: Object.values(checkSummaries).filter(c => c.lastStatus === HEALTH_STATUS.CRITICAL).length
      }
    };
  }
  
  // Format uptime in human readable format
  formatUptime(uptimeMs) {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
  
  // Express middleware for health endpoint
  healthEndpoint() {
    return async (req, res) => {
      try {
        const healthStatus = this.getHealthStatus();
        
        // Set HTTP status based on health
        let httpStatus = 200;
        switch (healthStatus.status) {
          case HEALTH_STATUS.DEGRADED:
            httpStatus = 200; // Still operational
            break;
          case HEALTH_STATUS.UNHEALTHY:
            httpStatus = 503; // Service unavailable
            break;
          case HEALTH_STATUS.CRITICAL:
            httpStatus = 503; // Service unavailable
            break;
        }
        
        res.status(httpStatus).json(healthStatus);
      } catch (error) {
        logger.error('Health endpoint error', { error: error.message });
        res.status(500).json({
          service: this.serviceName,
          status: HEALTH_STATUS.CRITICAL,
          error: 'Health check system failure',
          timestamp: Date.now()
        });
      }
    };
  }
  
  // Readiness probe endpoint (for Kubernetes)
  readinessEndpoint() {
    return async (req, res) => {
      try {
        const healthStatus = this.getHealthStatus();
        
        if (healthStatus.status === HEALTH_STATUS.CRITICAL) {
          res.status(503).json({
            status: 'not_ready',
            message: 'Service has critical health check failures'
          });
        } else {
          res.status(200).json({
            status: 'ready',
            message: 'Service is ready to accept traffic'
          });
        }
      } catch (error) {
        res.status(503).json({
          status: 'not_ready',
          error: error.message
        });
      }
    };
  }
  
  // Liveness probe endpoint (for Kubernetes)
  livenessEndpoint() {
    return async (req, res) => {
      try {
        // Simple check - if we can respond, we're alive
        res.status(200).json({
          status: 'alive',
          timestamp: Date.now(),
          uptime: process.uptime()
        });
      } catch (error) {
        res.status(500).json({
          status: 'dead',
          error: error.message
        });
      }
    };
  }
  
  // Shutdown health monitor
  shutdown() {
    this.stopScheduledChecks();
    this.checks.clear();
    logger.info('Health monitor shut down');
  }
}

// Global health monitor instance
let globalHealthMonitor = null;

function getHealthMonitor(options = {}) {
  if (!globalHealthMonitor) {
    globalHealthMonitor = new HealthMonitor(options);
  }
  return globalHealthMonitor;
}

module.exports = {
  HealthMonitor,
  HealthCheck,
  getHealthMonitor,
  HEALTH_STATUS,
  CHECK_TYPES
}; 