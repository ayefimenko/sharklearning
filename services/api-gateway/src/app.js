// API Gateway
// Centralized entry point for all microservices with routing, auth, and cross-cutting concerns

const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');

// Monitoring imports
const { tracingMiddleware } = require('../../../shared/monitoring/distributed-tracer');
const { metricsMiddleware } = require('../../../shared/monitoring/metrics-collector');
const { getMonitoringDashboard } = require('../../../shared/monitoring/monitoring-dashboard');
const { getHealthMonitor } = require('../../../shared/monitoring/health-monitor');

// Security and resilience imports
const { securityHeadersMiddleware } = require('../../../shared/middleware/security-headers');
const { enhancedRateLimiting } = require('../../../shared/middleware/enhanced-rate-limiting');
const { CircuitBreaker } = require('../../../shared/resilience/circuit-breaker');

const { logger } = require('../../../shared/utils/logger');
const { getSecretsManager } = require('../../../shared/security/secrets-manager');

const app = express();

// Initialize core services
const secretsManager = getSecretsManager();
const monitoringDashboard = getMonitoringDashboard({
  serviceName: 'api-gateway',
  version: '1.0.0'
});

const healthMonitor = getHealthMonitor({
  serviceName: 'api-gateway'
});

// Service registry
const serviceRegistry = {
  'user-service': {
    name: 'user-service',
    instances: [
      { url: 'http://user-service:8001', healthy: true, weight: 100 }
    ],
    healthEndpoint: '/health',
    circuitBreaker: new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 30000
    })
  },
  'content-service': {
    name: 'content-service', 
    instances: [
      { url: 'http://content-service:8002', healthy: true, weight: 100 }
    ],
    healthEndpoint: '/health',
    circuitBreaker: new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 30000
    })
  },
  'progress-service': {
    name: 'progress-service', 
    instances: [
      { url: 'http://progress-service:8003', healthy: true, weight: 100 }
    ],
    healthEndpoint: '/health',
    circuitBreaker: new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 30000
    })
  }
};

// Route configuration
const routeConfig = {
  '/api/users/login': { service: 'user-service', auth: false },
  '/api/users/register': { service: 'user-service', auth: false },
  '/api/users': { service: 'user-service', auth: true },
  '/api/content': { service: 'content-service', auth: false },
  '/api/progress': { service: 'progress-service', auth: true }
};

// Load balancer
class LoadBalancer {
  constructor() {
    this.roundRobinCounters = new Map();
  }
  
  getNextInstance(serviceName) {
    const service = serviceRegistry[serviceName];
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }
    
    const healthyInstances = service.instances.filter(i => i.healthy);
    if (healthyInstances.length === 0) {
      throw new Error(`No healthy instances for ${serviceName}`);
    }
    
    // Round-robin selection
    if (!this.roundRobinCounters.has(serviceName)) {
      this.roundRobinCounters.set(serviceName, 0);
    }
    
    const counter = this.roundRobinCounters.get(serviceName);
    const instance = healthyInstances[counter % healthyInstances.length];
    this.roundRobinCounters.set(serviceName, counter + 1);
    
    return instance;
  }
}

const loadBalancer = new LoadBalancer();

// Service health monitoring
async function checkServiceHealth() {
  for (const [serviceName, service] of Object.entries(serviceRegistry)) {
    for (const instance of service.instances) {
      try {
        const response = await axios.get(`${instance.url}${service.healthEndpoint}`, {
          timeout: 5000
        });
        
        instance.healthy = response.status === 200;
        instance.lastHealthCheck = Date.now();
        
      } catch (error) {
        instance.healthy = false;
        instance.lastHealthCheck = Date.now();
        
        logger.error('Service health check failed', {
          service: serviceName,
          instance: instance.url,
          error: error.message
        });
      }
    }
  }
}

// Authentication middleware
async function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided'
      });
    }
    
    const jwtSecret = await secretsManager.getSecret('jwt-secret');
    const decoded = jwt.verify(token, jwtSecret);
    
    req.user = decoded;
    if (req.span) {
      req.span.setTag('user.id', decoded.userId);
    }
    
    next();
  } catch (error) {
    res.status(401).json({
      error: 'Authentication failed',
      message: error.message
    });
  }
}

// Service proxy function
async function proxyToService(req, res, serviceName) {
  try {
    const instance = loadBalancer.getNextInstance(serviceName);
    const service = serviceRegistry[serviceName];
    
    const proxyRequest = async () => {
      const targetUrl = `${instance.url}${req.originalUrl}`;
      
      const config = {
        method: req.method,
        url: targetUrl,
        headers: {
          ...req.headers,
          'x-correlation-id': req.correlationId || 'gateway-' + Date.now(),
          'x-gateway-source': 'api-gateway'
        },
        data: req.body,
        timeout: 30000
      };
      
      delete config.headers.host;
      
      const response = await axios(config);
      
      // Copy response headers
      Object.entries(response.headers).forEach(([key, value]) => {
        if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
          res.set(key, value);
        }
      });
      
      res.status(response.status).json(response.data);
    };
    
    // Execute with circuit breaker
    await service.circuitBreaker.execute(proxyRequest);
    
  } catch (error) {
    logger.error('Service proxy error', {
      service: serviceName,
      error: error.message,
      url: req.originalUrl
    });
    
    if (error.message.includes('Circuit breaker is OPEN')) {
      res.status(503).json({
        error: 'Service temporarily unavailable',
        message: `${serviceName} is experiencing issues`
      });
    } else {
      res.status(502).json({
        error: 'Gateway error',
        message: 'Failed to process request'
      });
    }
  }
}

// Middleware setup
app.use(helmet());
app.use(securityHeadersMiddleware());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

app.use(enhancedRateLimiting({
  windowMs: 15 * 60 * 1000,
  max: 200
}));

app.use(tracingMiddleware({ serviceName: 'api-gateway' }));
app.use(metricsMiddleware({ serviceName: 'api-gateway' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Gateway endpoints
app.get('/gateway/status', (req, res) => {
  const serviceStatuses = {};
  
  for (const [serviceName, service] of Object.entries(serviceRegistry)) {
    const healthyInstances = service.instances.filter(i => i.healthy).length;
    serviceStatuses[serviceName] = {
      healthy: healthyInstances,
      total: service.instances.length,
      status: healthyInstances > 0 ? 'healthy' : 'unhealthy'
    };
  }
  
  res.json({
    gateway: 'sharklearning-api-gateway',
    version: '1.0.0',
    status: 'operational',
    services: serviceStatuses
  });
});

app.use('/gateway/monitoring', (req, res, next) => {
  const routes = monitoringDashboard.createDashboardRoutes();
  
  if (req.path === '/dashboard') {
    return routes.dashboard(req, res);
  } else if (req.path === '/health') {
    return routes.health(req, res);
  } else if (req.path === '/metrics') {
    return routes.metrics(req, res);
  } else {
    next();
  }
});

// Route handlers - Order matters! More specific routes first
const sortedRoutes = Object.entries(routeConfig).sort((a, b) => b[0].length - a[0].length);

for (const [path, config] of sortedRoutes) {
  app.use(path, (req, res, next) => {
    if (config.auth) {
      authMiddleware(req, res, () => {
        proxyToService(req, res, config.service);
      });
    } else {
      proxyToService(req, res, config.service);
    }
  });
}

// Health endpoints
app.get('/health', healthMonitor.healthEndpoint());
app.get('/ready', async (req, res) => {
  try {
    const results = await healthMonitor.executeAllChecks();
    const hasFailures = results.some(r => r.status === 'critical');
    res.status(hasFailures ? 503 : 200).json({
      status: hasFailures ? 'not_ready' : 'ready',
      results
    });
  } catch (error) {
    res.status(503).json({ status: 'not_ready', error: error.message });
  }
});

app.get('/alive', (req, res) => {
  res.json({ status: 'alive', timestamp: Date.now() });
});

// Error handlers
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    availableRoutes: Object.keys(routeConfig)
  });
});

app.use((err, req, res, next) => {
  logger.error('Gateway error', { error: err.message, url: req.originalUrl });
  res.status(500).json({
    error: 'Gateway error',
    message: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message
  });
});

// Start health checking
setInterval(checkServiceHealth, 30000);

const PORT = process.env.GATEWAY_PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info('API Gateway started', {
    port: PORT,
    registeredServices: Object.keys(serviceRegistry),
    registeredRoutes: Object.keys(routeConfig)
  });
  
  checkServiceHealth();
});

module.exports = app; 