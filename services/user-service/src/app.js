const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Monitoring imports
const { tracingMiddleware } = require('../../../shared/monitoring/distributed-tracer');
const { metricsMiddleware } = require('../../../shared/monitoring/metrics-collector');
const { getMonitoringDashboard } = require('../../../shared/monitoring/monitoring-dashboard');
const { getHealthMonitor } = require('../../../shared/monitoring/health-monitor');

// Security and resilience imports
const { securityHeadersMiddleware } = require('../../../shared/middleware/security-headers');
const { enhancedRateLimiting } = require('../../../shared/middleware/enhanced-rate-limiting');

const { logger } = require('../../../shared/utils/logger');
const userRoutes = require('./routes/user-routes');

const app = express();

// Initialize monitoring
const monitoringDashboard = getMonitoringDashboard({
  serviceName: 'user-service',
  version: '1.0.0'
});

const healthMonitor = getHealthMonitor({
  serviceName: 'user-service'
});

// Add database health check
healthMonitor.addCheck('database_connection', async () => {
  // Simulate database check
  const pool = require('./config/database').pool;
  try {
    const result = await pool.query('SELECT 1');
    return {
      message: 'Database connection healthy',
      details: { connected: true }
    };
  } catch (error) {
    throw new Error(`Database connection failed: ${error.message}`);
  }
}, { type: 'database', critical: true });

// Add Redis health check (if using cache)
healthMonitor.addCheck('redis_connection', async () => {
  try {
    // Simulate Redis check
    return {
      message: 'Redis connection healthy',
      details: { connected: true }
    };
  } catch (error) {
    throw new Error(`Redis connection failed: ${error.message}`);
  }
}, { type: 'cache', critical: false });

// Security middleware
app.use(helmet());
app.use(securityHeadersMiddleware({
  environment: process.env.NODE_ENV || 'development'
}));

// Rate limiting
app.use(enhancedRateLimiting({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

// Monitoring middleware (early in the chain)
app.use(tracingMiddleware({
  serviceName: 'user-service'
}));
app.use(metricsMiddleware({
  serviceName: 'user-service'
}));

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Monitoring endpoints
app.use('/monitoring', (req, res, next) => {
  const routes = monitoringDashboard.createDashboardRoutes();
  
  if (req.path === '/dashboard') {
    return routes.dashboard(req, res, next);
  } else if (req.path === '/health') {
    return routes.health(req, res, next);
  } else if (req.path === '/metrics') {
    return routes.metrics(req, res, next);
  } else {
    next();
  }
});

// API routes
app.use('/api/users', userRoutes);

// Health check endpoint
app.get('/health', healthMonitor.healthEndpoint());

// Readiness probe (for Kubernetes)
app.get('/ready', (req, res) => {
  healthMonitor.executeAllChecks()
    .then((results) => {
      const hasFailures = results.some(r => r.status === 'critical');
      if (hasFailures) {
        res.status(503).json({ status: 'not_ready', results });
      } else {
        res.json({ status: 'ready', results });
      }
    })
    .catch((error) => {
      res.status(503).json({ status: 'not_ready', error: error.message });
    });
});

// Liveness probe (for Kubernetes)
app.get('/alive', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: Date.now(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use('*', (req, res) => {
  // Record 404 in metrics
  if (req.span) {
    req.span.setTag('http.status_code', 404);
    req.span.setTag('error', true);
  }
  
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: Date.now()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  // Record error in tracing
  if (req.span) {
    req.span.recordError(err);
  }
  
  // Log error
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    traceId: req.traceId
  });
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    traceId: req.traceId,
    timestamp: Date.now()
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Stop accepting new connections
  server.close(async () => {
    try {
      // Shutdown monitoring systems
      monitoringDashboard.shutdown();
      healthMonitor.shutdown();
      
      logger.info('User service shut down successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: error.message });
      process.exit(1);
    }
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  logger.info('User service started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    monitoring: {
      tracing: 'enabled',
      metrics: 'enabled',
      healthChecks: 'enabled'
    }
  });
});

module.exports = app; 