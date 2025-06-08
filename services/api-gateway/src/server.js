const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { createLogger, requestIdMiddleware, logError, logInfo } = require('./middleware/logger');
const { rateLimiters, logRateLimit } = require('./middleware/userRateLimit');
// const monitoringRoutes = require('./routes/monitoring'); // Temporarily disabled
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Request ID and logging
app.use(requestIdMiddleware);
app.use(createLogger());

// Rate limiting with user-specific limits
app.use(logRateLimit); // Log rate limit events
app.use('/api/users/login', rateLimiters.auth);
app.use('/api/users/register', rateLimiters.auth);
app.use('/api/users/forgot-password', rateLimiters.auth);
app.use('/api/users/reset-password', rateLimiters.auth);
app.use('/api/content/search', rateLimiters.search);
app.use('/api/users/upload', rateLimiters.upload);
app.use('/api/content/upload', rateLimiters.upload);
app.use(rateLimiters.general); // General rate limiting for all other endpoints

// Compression
app.use(compression());

// Monitoring routes (temporarily disabled)
// app.use('/monitoring', monitoringRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'api-gateway'
  });
});

// Service routes with proxy
const services = {
  '/api/users': {
    target: process.env.USER_SERVICE_URL || 'http://user-service:8000',
    pathRewrite: { '^/api/users': '' }
  },
  '/api/content': {
    target: process.env.CONTENT_SERVICE_URL || 'http://content-service:8000',
    pathRewrite: { '^/api/content': '' }
  },
  '/api/progress': {
    target: process.env.PROGRESS_SERVICE_URL || 'http://progress-service:8000',
    pathRewrite: { '^/api/progress': '' }
  },
  '/api/notifications': {
    target: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:8000',
    pathRewrite: { '^/api/notifications': '' }
  }
};

// Create proxy middleware for each service
Object.entries(services).forEach(([path, config]) => {
  app.use(path, createProxyMiddleware({
    target: config.target,
    changeOrigin: true,
    pathRewrite: config.pathRewrite,
    timeout: 30000, // 30 second timeout
    proxyTimeout: 30000, // 30 second proxy timeout
    onError: (err, req, res) => {
      const errorDetails = {
        error: 'Service temporarily unavailable',
        service: path.replace('/api/', ''),
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      };
      
      console.error(`❌ Proxy error for ${path}:`, {
        error: err.message,
        code: err.code,
        target: config.target,
        method: req.method,
        url: req.originalUrl,
        requestId: errorDetails.requestId
      });
      
      // Determine appropriate status code
      let statusCode = 503;
      if (err.code === 'ECONNREFUSED') statusCode = 503;
      else if (err.code === 'ETIMEDOUT') statusCode = 504;
      else if (err.code === 'ENOTFOUND') statusCode = 502;
      
      res.status(statusCode).json(errorDetails);
    },
    onProxyReq: (proxyReq, req, res) => {
      // Add request ID for tracing
      const requestId = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      proxyReq.setHeader('x-request-id', requestId);
      req.headers['x-request-id'] = requestId;
      
      // Log proxy requests in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 Proxying ${req.method} ${req.originalUrl} to ${config.target} [${requestId}]`);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      // Add response headers for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Response ${proxyRes.statusCode} for ${req.method} ${req.originalUrl} [${req.headers['x-request-id']}]`);
      }
    }
  }));
});

// API documentation endpoint (with body parsing for non-proxy routes)
app.get('/api', express.json({ limit: '10mb' }), express.urlencoded({ extended: true, limit: '10mb' }), (req, res) => {
  res.json({
    name: 'SharkLearning API Gateway',
    version: '1.0.0',
    description: 'API Gateway for SharkLearning microservices',
    endpoints: {
      users: '/api/users - User management service',
      content: '/api/content - Learning content service',
      progress: '/api/progress - Progress tracking service',
      notifications: '/api/notifications - Notification service'
    },
    health: '/health - Health check endpoint'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logError(err, {
    method: req.method,
    url: req.originalUrl,
    requestId: req.headers['x-request-id'],
    userAgent: req.headers['user-agent']
  });
  
  res.status(500).json({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id']
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    logInfo('API Gateway started successfully', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      url: `http://localhost:${PORT}`,
      services: Object.keys(services).length
    });
  });
}

// Export app for testing
module.exports = app; 