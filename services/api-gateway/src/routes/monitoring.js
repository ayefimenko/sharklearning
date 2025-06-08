const express = require('express');
const { Pool } = require('pg');
const { logInfo, logError } = require('../middleware/logger');

const router = express.Router();

// Initialize connections for health checks
let pgPool;

const initializeConnections = () => {
  // PostgreSQL connection
  if (process.env.DATABASE_URL) {
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }
};

// Initialize connections
initializeConnections();

// Health check for individual services
const checkServiceHealth = async (serviceName, url) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`${url}/health`, {
      signal: controller.signal,
      headers: { 'x-health-check': 'true' }
    });
    
    clearTimeout(timeoutId);
    
    const data = await response.json();
    return {
      status: response.ok ? 'healthy' : 'unhealthy',
      responseTime: data.responseTime || 'unknown',
      details: data
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      details: null
    };
  }
};

// Database health check
const checkDatabaseHealth = async () => {
  try {
    if (!pgPool) return { status: 'not_configured' };
    
    const start = Date.now();
    const result = await pgPool.query('SELECT 1 as health_check');
    const responseTime = Date.now() - start;
    
    return {
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      connections: pgPool.totalCount,
      idle: pgPool.idleCount,
      waiting: pgPool.waitingCount
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

// Redis health check (simplified)
const checkRedisHealth = async () => {
  return { status: 'not_configured', message: 'Redis health check not implemented' };
};

// Detailed health check endpoint
router.get('/health/detailed', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const [database, redis, userService, contentService, progressService] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
      checkServiceHealth('user-service', process.env.USER_SERVICE_URL || 'http://user-service:8000'),
      checkServiceHealth('content-service', process.env.CONTENT_SERVICE_URL || 'http://content-service:8000'),
      checkServiceHealth('progress-service', process.env.PROGRESS_SERVICE_URL || 'http://progress-service:8000')
    ]);

    const responseTime = Date.now() - startTime;
    const overallStatus = [database, redis, userService, contentService, progressService]
      .every(service => service.status === 'healthy' || service.status === 'not_configured') 
      ? 'healthy' : 'unhealthy';

    const healthReport = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      services: {
        database,
        redis,
        userService,
        contentService,
        progressService
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        version: process.version,
        platform: process.platform
      }
    };

    if (overallStatus === 'unhealthy') {
      logError(new Error('System health check failed'), {
        operation: 'health_check',
        services: Object.entries(healthReport.services)
          .filter(([, service]) => service.status === 'unhealthy')
          .map(([name]) => name)
      });
    }

    res.status(overallStatus === 'healthy' ? 200 : 503).json(healthReport);
  } catch (error) {
    logError(error, { operation: 'health_check_detailed' });
    res.status(500).json({
      status: 'error',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Simple health check (for load balancers)
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'api-gateway'
  });
});

// Readiness check (all dependencies available)
router.get('/ready', async (req, res) => {
  try {
    const [database, redis] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth()
    ]);

    const isReady = database.status === 'healthy' && 
                   (redis.status === 'healthy' || redis.status === 'not_configured');

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      dependencies: { database, redis }
    });
  } catch (error) {
    logError(error, { operation: 'readiness_check' });
    res.status(503).json({
      status: 'not_ready',
      error: 'Readiness check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Liveness check (service is alive)
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Metrics endpoint (Prometheus format)
router.get('/metrics', (req, res) => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  const metrics = [
    `# HELP nodejs_memory_usage_bytes Memory usage in bytes`,
    `# TYPE nodejs_memory_usage_bytes gauge`,
    `nodejs_memory_usage_bytes{type="rss"} ${memUsage.rss}`,
    `nodejs_memory_usage_bytes{type="heapTotal"} ${memUsage.heapTotal}`,
    `nodejs_memory_usage_bytes{type="heapUsed"} ${memUsage.heapUsed}`,
    `nodejs_memory_usage_bytes{type="external"} ${memUsage.external}`,
    ``,
    `# HELP nodejs_process_uptime_seconds Process uptime in seconds`,
    `# TYPE nodejs_process_uptime_seconds counter`,
    `nodejs_process_uptime_seconds ${process.uptime()}`,
    ``,
    `# HELP nodejs_cpu_usage_microseconds CPU usage in microseconds`,
    `# TYPE nodejs_cpu_usage_microseconds counter`,
    `nodejs_cpu_usage_microseconds{type="user"} ${cpuUsage.user}`,
    `nodejs_cpu_usage_microseconds{type="system"} ${cpuUsage.system}`,
    ``
  ].join('\n');

  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(metrics);
});

module.exports = router; 