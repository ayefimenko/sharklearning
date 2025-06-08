// Monitoring Dashboard API
// Combines metrics, tracing, and health monitoring into unified dashboard

const { getMetricsCollector } = require('./metrics-collector');
const { getTracer } = require('./distributed-tracer');
const { getHealthMonitor } = require('./health-monitor');
const { logger } = require('../utils/logger');

class MonitoringDashboard {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'unknown-service';
    this.version = options.version || '1.0.0';
    this.enableRealTime = options.enableRealTime !== false;
    
    // Initialize monitoring components
    this.metricsCollector = getMetricsCollector({ serviceName: this.serviceName });
    this.tracer = getTracer({ serviceName: this.serviceName });
    this.healthMonitor = getHealthMonitor({ serviceName: this.serviceName });
    
    // Dashboard data cache
    this.dashboardCache = {
      data: null,
      lastUpdate: 0,
      cacheInterval: options.cacheInterval || 5000 // 5 seconds
    };
    
    logger.info('Monitoring dashboard initialized', {
      serviceName: this.serviceName,
      enableRealTime: this.enableRealTime
    });
  }
  
  // Get comprehensive service overview
  async getServiceOverview() {
    try {
      const [healthStatus, metrics, traces] = await Promise.all([
        this.getHealthData(),
        this.getMetricsData(),
        this.getTracingData()
      ]);
      
      const overview = {
        service: {
          name: this.serviceName,
          version: this.version,
          timestamp: Date.now(),
          uptime: process.uptime()
        },
        health: healthStatus,
        metrics: metrics.summary,
        tracing: traces.summary,
        performance: this.calculatePerformanceScore(healthStatus, metrics),
        alerts: this.generateAlerts(healthStatus, metrics)
      };
      
      return overview;
    } catch (error) {
      logger.error('Failed to get service overview', { error: error.message });
      throw error;
    }
  }
  
  // Get detailed health monitoring data
  async getHealthData() {
    try {
      await this.healthMonitor.executeAllChecks();
      return this.healthMonitor.getHealthStatus();
    } catch (error) {
      logger.error('Failed to get health data', { error: error.message });
      return {
        service: this.serviceName,
        status: 'critical',
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
  
  // Get metrics data with summaries
  getMetricsData() {
    try {
      const allMetrics = this.metricsCollector.getAllMetrics();
      
      return {
        timestamp: Date.now(),
        summary: {
          totalMetrics: Object.keys(allMetrics).length,
          http: this.summarizeHttpMetrics(allMetrics),
          system: this.summarizeSystemMetrics(allMetrics)
        },
        detailed: allMetrics
      };
    } catch (error) {
      logger.error('Failed to get metrics data', { error: error.message });
      return {
        timestamp: Date.now(),
        error: error.message,
        summary: {},
        detailed: {}
      };
    }
  }
  
  // Get distributed tracing data
  getTracingData() {
    try {
      const tracerMetrics = this.tracer.getMetrics();
      const recentTraces = this.tracer.getTraces(20);
      
      return {
        timestamp: Date.now(),
        summary: {
          activeSpans: tracerMetrics.activeSpans,
          finishedSpans: tracerMetrics.finishedSpans,
          spansCreated: tracerMetrics.spansCreated
        },
        recentTraces: recentTraces.slice(0, 10)
      };
    } catch (error) {
      logger.error('Failed to get tracing data', { error: error.message });
      return {
        timestamp: Date.now(),
        error: error.message,
        summary: {},
        recentTraces: []
      };
    }
  }
  
  // Summarize HTTP metrics
  summarizeHttpMetrics(allMetrics) {
    const httpRequestsTotal = this.findMetric(allMetrics, 'http_requests_total');
    const httpDuration = this.findMetric(allMetrics, 'http_request_duration');
    
    return {
      totalRequests: httpRequestsTotal ? httpRequestsTotal.value : 0,
      averageResponseTime: httpDuration ? httpDuration.value.average : 0
    };
  }
  
  // Summarize system metrics
  summarizeSystemMetrics(allMetrics) {
    const memoryHeapUsed = this.findMetric(allMetrics, 'memory_heap_used');
    const memoryHeapTotal = this.findMetric(allMetrics, 'memory_heap_total');
    
    const heapUsed = memoryHeapUsed ? memoryHeapUsed.value : 0;
    const heapTotal = memoryHeapTotal ? memoryHeapTotal.value : 1;
    
    return {
      memoryUsage: {
        used: Math.round(heapUsed / 1024 / 1024),
        total: Math.round(heapTotal / 1024 / 1024),
        percentage: Math.round((heapUsed / heapTotal) * 100)
      },
      uptime: process.uptime()
    };
  }
  
  // Find metric by name pattern
  findMetric(allMetrics, namePattern) {
    for (const [identifier, metric] of Object.entries(allMetrics)) {
      if (metric.name.includes(namePattern)) {
        return metric;
      }
    }
    return null;
  }
  
  // Calculate overall performance score (0-100)
  calculatePerformanceScore(healthStatus, metrics) {
    let score = 100;
    
    if (healthStatus.status === 'critical') score -= 40;
    else if (healthStatus.status === 'unhealthy') score -= 30;
    else if (healthStatus.status === 'degraded') score -= 15;
    
    const memoryPercentage = metrics.summary.system?.memoryUsage?.percentage || 0;
    if (memoryPercentage > 90) score -= 20;
    else if (memoryPercentage > 80) score -= 10;
    
    return Math.max(0, Math.min(100, score));
  }
  
  // Generate alerts based on metrics and health
  generateAlerts(healthStatus, metrics) {
    const alerts = [];
    
    if (healthStatus.status === 'critical') {
      alerts.push({
        level: 'critical',
        title: 'Critical Health Status',
        message: 'Service has critical health check failures',
        timestamp: Date.now()
      });
    }
    
    const memoryPercentage = metrics.summary.system?.memoryUsage?.percentage || 0;
    if (memoryPercentage > 90) {
      alerts.push({
        level: 'critical',
        title: 'High Memory Usage',
        message: `Memory usage at ${memoryPercentage}%`,
        timestamp: Date.now()
      });
    }
    
    return alerts;
  }
  
  // Get cached dashboard data
  async getCachedDashboardData() {
    const now = Date.now();
    
    if (this.dashboardCache.data && 
        (now - this.dashboardCache.lastUpdate) < this.dashboardCache.cacheInterval) {
      return this.dashboardCache.data;
    }
    
    // Refresh cache
    const data = await this.getServiceOverview();
    this.dashboardCache.data = data;
    this.dashboardCache.lastUpdate = now;
    
    return data;
  }
  
  // Express middleware for dashboard endpoints
  createDashboardRoutes() {
    return {
      // Main dashboard endpoint
      dashboard: async (req, res) => {
        try {
          const data = await this.getCachedDashboardData();
          res.json(data);
        } catch (error) {
          logger.error('Dashboard endpoint error', { error: error.message });
          res.status(500).json({
            error: 'Failed to get dashboard data',
            message: error.message
          });
        }
      },
      
      // Health endpoint
      health: this.healthMonitor.healthEndpoint(),
      
      // Metrics endpoint (Prometheus format)
      metrics: (req, res) => {
        try {
          const format = req.query.format || 'json';
          
          if (format === 'prometheus') {
            res.set('Content-Type', 'text/plain');
            res.send(this.metricsCollector.getPrometheusMetrics());
          } else {
            res.json(this.metricsCollector.getAllMetrics());
          }
        } catch (error) {
          logger.error('Metrics endpoint error', { error: error.message });
          res.status(500).json({ error: error.message });
        }
      },
      
      // Tracing endpoint
      traces: (req, res) => {
        try {
          const limit = parseInt(req.query.limit) || 50;
          const traces = this.tracer.getTraces(limit);
          res.json({
            traces,
            metrics: this.tracer.getMetrics(),
            timestamp: Date.now()
          });
        } catch (error) {
          logger.error('Traces endpoint error', { error: error.message });
          res.status(500).json({ error: error.message });
        }
      },
      
      // Real-time metrics WebSocket endpoint (if enabled)
      realtime: this.enableRealTime ? this.createRealTimeHandler() : null
    };
  }
  
  // Create real-time WebSocket handler
  createRealTimeHandler() {
    return (ws, req) => {
      logger.info('Real-time monitoring connection established');
      
      const sendUpdate = async () => {
        try {
          const data = await this.getCachedDashboardData();
          ws.send(JSON.stringify({
            type: 'dashboard_update',
            data,
            timestamp: Date.now()
          }));
        } catch (error) {
          logger.error('Failed to send real-time update', { error: error.message });
        }
      };
      
      // Send initial data
      sendUpdate();
      
      // Send updates every 5 seconds
      const interval = setInterval(sendUpdate, 5000);
      
      ws.on('close', () => {
        clearInterval(interval);
        logger.info('Real-time monitoring connection closed');
      });
      
      ws.on('error', (error) => {
        clearInterval(interval);
        logger.error('Real-time monitoring connection error', { error: error.message });
      });
    };
  }
  
  // Get system information
  getSystemInfo() {
    return {
      service: this.serviceName,
      version: this.version,
      node: {
        version: process.version,
        platform: process.platform,
        architecture: process.arch
      },
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      pid: process.pid,
      timestamp: Date.now()
    };
  }
  
  // Shutdown monitoring
  shutdown() {
    this.healthMonitor.shutdown();
    this.metricsCollector.shutdown();
    this.tracer.shutdown();
    
    logger.info('Monitoring dashboard shut down');
  }
}

// Global dashboard instance
let globalDashboard = null;

function getMonitoringDashboard(options = {}) {
  if (!globalDashboard) {
    globalDashboard = new MonitoringDashboard(options);
  }
  return globalDashboard;
}

// Express router factory
function createMonitoringRouter(options = {}) {
  const express = require('express');
  const router = express.Router();
  const dashboard = getMonitoringDashboard(options);
  const routes = dashboard.createDashboardRoutes();
  
  // Dashboard routes
  router.get('/dashboard', routes.dashboard);
  router.get('/health', routes.health);
  router.get('/metrics', routes.metrics);
  router.get('/traces', routes.traces);
  router.get('/system', (req, res) => res.json(dashboard.getSystemInfo()));
  
  return router;
}

module.exports = {
  MonitoringDashboard,
  getMonitoringDashboard,
  createMonitoringRouter
}; 