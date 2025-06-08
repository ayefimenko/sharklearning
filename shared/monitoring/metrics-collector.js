// Metrics Collection System
// Provides comprehensive monitoring and observability for microservices

const { logger } = require('../utils/logger');
const EventEmitter = require('events');

// Metric types
const METRIC_TYPES = {
  COUNTER: 'counter',           // Monotonically increasing values
  GAUGE: 'gauge',              // Current value that can go up or down
  HISTOGRAM: 'histogram',       // Distribution of values
  TIMER: 'timer',              // Duration measurements
  SET: 'set'                   // Count of unique values
};

// Time units
const TIME_UNITS = {
  NANOSECONDS: 'ns',
  MICROSECONDS: 'μs',
  MILLISECONDS: 'ms',
  SECONDS: 's'
};

class Metric {
  constructor(name, type, description = '', labels = {}) {
    this.name = name;
    this.type = type;
    this.description = description;
    this.labels = { ...labels };
    this.createdAt = Date.now();
    this.lastUpdated = Date.now();
  }
  
  // Get metric identifier including labels
  getIdentifier() {
    const labelString = Object.entries(this.labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    
    return labelString ? `${this.name}{${labelString}}` : this.name;
  }
  
  // Update last modified time
  touch() {
    this.lastUpdated = Date.now();
  }
}

class Counter extends Metric {
  constructor(name, description = '', labels = {}) {
    super(name, METRIC_TYPES.COUNTER, description, labels);
    this.value = 0;
  }
  
  // Increment counter
  inc(amount = 1) {
    if (amount < 0) {
      throw new Error('Counter can only be incremented with non-negative values');
    }
    
    this.value += amount;
    this.touch();
    
    logger.debug('Counter incremented', {
      metric: this.name,
      amount,
      newValue: this.value,
      labels: this.labels
    });
    
    return this;
  }
  
  // Get current value
  getValue() {
    return this.value;
  }
  
  // Reset counter (for testing)
  reset() {
    this.value = 0;
    this.touch();
    return this;
  }
}

class Gauge extends Metric {
  constructor(name, description = '', labels = {}) {
    super(name, METRIC_TYPES.GAUGE, description, labels);
    this.value = 0;
  }
  
  // Set gauge value
  set(value) {
    this.value = value;
    this.touch();
    
    logger.debug('Gauge set', {
      metric: this.name,
      value,
      labels: this.labels
    });
    
    return this;
  }
  
  // Increment gauge
  inc(amount = 1) {
    this.value += amount;
    this.touch();
    return this;
  }
  
  // Decrement gauge
  dec(amount = 1) {
    this.value -= amount;
    this.touch();
    return this;
  }
  
  // Get current value
  getValue() {
    return this.value;
  }
}

class Histogram extends Metric {
  constructor(name, description = '', buckets = null, labels = {}) {
    super(name, METRIC_TYPES.HISTOGRAM, description, labels);
    
    // Default buckets for response time measurements
    this.buckets = buckets || [
      0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 300, 600, 1800, 3600
    ];
    
    this.bucketCounts = new Array(this.buckets.length).fill(0);
    this.count = 0;
    this.sum = 0;
    this.values = []; // Keep recent values for percentile calculation
    this.maxValues = 1000; // Limit stored values
  }
  
  // Observe a value
  observe(value) {
    this.count++;
    this.sum += value;
    this.values.push(value);
    
    // Limit stored values
    if (this.values.length > this.maxValues) {
      this.values = this.values.slice(-this.maxValues);
    }
    
    // Update bucket counts
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) {
        this.bucketCounts[i]++;
      }
    }
    
    this.touch();
    
    logger.debug('Histogram observation', {
      metric: this.name,
      value,
      count: this.count,
      labels: this.labels
    });
    
    return this;
  }
  
  // Get average value
  getAverage() {
    return this.count > 0 ? this.sum / this.count : 0;
  }
  
  // Get percentile
  getPercentile(percentile) {
    if (this.values.length === 0) return 0;
    
    const sorted = [...this.values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
  
  // Get histogram data
  getValue() {
    return {
      count: this.count,
      sum: this.sum,
      average: this.getAverage(),
      buckets: this.buckets.map((bucket, i) => ({
        le: bucket,
        count: this.bucketCounts[i]
      })),
      percentiles: {
        p50: this.getPercentile(50),
        p90: this.getPercentile(90),
        p95: this.getPercentile(95),
        p99: this.getPercentile(99)
      }
    };
  }
}

class Timer extends Metric {
  constructor(name, description = '', labels = {}) {
    super(name, METRIC_TYPES.TIMER, description, labels);
    this.histogram = new Histogram(name, description, null, labels);
    this.activeTimers = new Map();
  }
  
  // Start timing
  start(id = 'default') {
    const startTime = process.hrtime.bigint();
    this.activeTimers.set(id, startTime);
    
    logger.debug('Timer started', {
      metric: this.name,
      timerId: id,
      labels: this.labels
    });
    
    return id;
  }
  
  // End timing and record duration
  end(id = 'default') {
    const startTime = this.activeTimers.get(id);
    if (!startTime) {
      logger.warn('Timer end called without start', {
        metric: this.name,
        timerId: id
      });
      return 0;
    }
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    this.activeTimers.delete(id);
    this.histogram.observe(duration);
    this.touch();
    
    logger.debug('Timer ended', {
      metric: this.name,
      timerId: id,
      duration: `${duration.toFixed(3)}ms`,
      labels: this.labels
    });
    
    return duration;
  }
  
  // Time a function execution
  async time(fn, id = 'default') {
    this.start(id);
    try {
      const result = await fn();
      this.end(id);
      return result;
    } catch (error) {
      this.end(id);
      throw error;
    }
  }
  
  // Get timer statistics
  getValue() {
    return this.histogram.getValue();
  }
}

class MetricsCollector extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.serviceName = options.serviceName || 'unknown-service';
    this.metrics = new Map();
    this.defaultLabels = {
      service: this.serviceName,
      version: options.version || '1.0.0',
      environment: options.environment || process.env.NODE_ENV || 'development'
    };
    
    // System metrics collection
    this.collectSystemMetrics = options.collectSystemMetrics !== false;
    this.systemMetricsInterval = options.systemMetricsInterval || 10000; // 10 seconds
    
    // Initialize built-in metrics
    this.initializeBuiltInMetrics();
    
    // Start system metrics collection
    if (this.collectSystemMetrics) {
      this.startSystemMetricsCollection();
    }
    
    logger.info('Metrics collector initialized', {
      serviceName: this.serviceName,
      collectSystemMetrics: this.collectSystemMetrics
    });
  }
  
  // Initialize built-in metrics
  initializeBuiltInMetrics() {
    // HTTP request metrics
    this.httpRequestsTotal = this.counter('http_requests_total', 'Total HTTP requests');
    this.httpRequestDuration = this.histogram('http_request_duration_seconds', 'HTTP request duration');
    this.httpRequestSize = this.histogram('http_request_size_bytes', 'HTTP request size');
    this.httpResponseSize = this.histogram('http_response_size_bytes', 'HTTP response size');
    
    // Database metrics
    this.dbConnectionsActive = this.gauge('db_connections_active', 'Active database connections');
    this.dbQueryDuration = this.histogram('db_query_duration_seconds', 'Database query duration');
    this.dbQueriesTotal = this.counter('db_queries_total', 'Total database queries');
    
    // Application metrics
    this.requestsInFlight = this.gauge('requests_in_flight', 'Requests currently being processed');
    this.errorsTotal = this.counter('errors_total', 'Total errors');
    
    // Circuit breaker metrics
    this.circuitBreakerState = this.gauge('circuit_breaker_state', 'Circuit breaker state (0=closed, 1=open, 2=half-open)');
    this.circuitBreakerTrips = this.counter('circuit_breaker_trips_total', 'Circuit breaker trips');
    
    // Cache metrics
    this.cacheHits = this.counter('cache_hits_total', 'Cache hits');
    this.cacheMisses = this.counter('cache_misses_total', 'Cache misses');
    this.cacheOperationDuration = this.histogram('cache_operation_duration_seconds', 'Cache operation duration');
  }
  
  // Create or get counter
  counter(name, description = '', labels = {}) {
    const fullLabels = { ...this.defaultLabels, ...labels };
    const metric = new Counter(name, description, fullLabels);
    const identifier = metric.getIdentifier();
    
    if (this.metrics.has(identifier)) {
      return this.metrics.get(identifier);
    }
    
    this.metrics.set(identifier, metric);
    return metric;
  }
  
  // Create or get gauge
  gauge(name, description = '', labels = {}) {
    const fullLabels = { ...this.defaultLabels, ...labels };
    const metric = new Gauge(name, description, fullLabels);
    const identifier = metric.getIdentifier();
    
    if (this.metrics.has(identifier)) {
      return this.metrics.get(identifier);
    }
    
    this.metrics.set(identifier, metric);
    return metric;
  }
  
  // Create or get histogram
  histogram(name, description = '', buckets = null, labels = {}) {
    const fullLabels = { ...this.defaultLabels, ...labels };
    const metric = new Histogram(name, description, buckets, fullLabels);
    const identifier = metric.getIdentifier();
    
    if (this.metrics.has(identifier)) {
      return this.metrics.get(identifier);
    }
    
    this.metrics.set(identifier, metric);
    return metric;
  }
  
  // Create or get timer
  timer(name, description = '', labels = {}) {
    const fullLabels = { ...this.defaultLabels, ...labels };
    const metric = new Timer(name, description, fullLabels);
    const identifier = metric.getIdentifier();
    
    if (this.metrics.has(identifier)) {
      return this.metrics.get(identifier);
    }
    
    this.metrics.set(identifier, metric);
    return metric;
  }
  
  // Record HTTP request
  recordHttpRequest(method, route, statusCode, duration, requestSize = 0, responseSize = 0) {
    const labels = { method, route, status_code: statusCode.toString() };
    
    this.counter('http_requests_total', 'Total HTTP requests', labels).inc();
    this.histogram('http_request_duration_seconds', 'HTTP request duration', null, labels).observe(duration / 1000);
    
    if (requestSize > 0) {
      this.histogram('http_request_size_bytes', 'HTTP request size', null, labels).observe(requestSize);
    }
    
    if (responseSize > 0) {
      this.histogram('http_response_size_bytes', 'HTTP response size', null, labels).observe(responseSize);
    }
  }
  
  // Record database query
  recordDatabaseQuery(operation, table, duration, success = true) {
    const labels = { operation, table, success: success.toString() };
    
    this.counter('db_queries_total', 'Total database queries', labels).inc();
    this.histogram('db_query_duration_seconds', 'Database query duration', null, labels).observe(duration / 1000);
  }
  
  // Record error
  recordError(errorType, errorCode = 'unknown') {
    const labels = { type: errorType, code: errorCode };
    this.counter('errors_total', 'Total errors', labels).inc();
  }
  
  // Start system metrics collection
  startSystemMetricsCollection() {
    this.systemMetricsTimer = setInterval(() => {
      this.collectSystemMetrics();
    }, this.systemMetricsInterval);
    
    logger.debug('System metrics collection started');
  }
  
  // Collect system metrics
  collectSystemMetrics() {
    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      this.gauge('nodejs_memory_heap_used_bytes', 'Node.js heap memory used').set(memUsage.heapUsed);
      this.gauge('nodejs_memory_heap_total_bytes', 'Node.js heap memory total').set(memUsage.heapTotal);
      this.gauge('nodejs_memory_external_bytes', 'Node.js external memory').set(memUsage.external);
      this.gauge('nodejs_memory_rss_bytes', 'Node.js resident set size').set(memUsage.rss);
      
      // CPU usage (simplified)
      const cpuUsage = process.cpuUsage();
      this.gauge('nodejs_cpu_user_seconds_total', 'Node.js CPU user time').set(cpuUsage.user / 1000000);
      this.gauge('nodejs_cpu_system_seconds_total', 'Node.js CPU system time').set(cpuUsage.system / 1000000);
      
      // Process info
      this.gauge('nodejs_process_uptime_seconds', 'Node.js process uptime').set(process.uptime());
      this.gauge('nodejs_process_pid', 'Node.js process PID').set(process.pid);
      
      // Event loop lag (simplified)
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
        this.histogram('nodejs_eventloop_lag_seconds', 'Node.js event loop lag').observe(lag / 1000);
      });
      
    } catch (error) {
      logger.error('Error collecting system metrics', { error: error.message });
    }
  }
  
  // Stop system metrics collection
  stopSystemMetricsCollection() {
    if (this.systemMetricsTimer) {
      clearInterval(this.systemMetricsTimer);
      this.systemMetricsTimer = null;
      logger.debug('System metrics collection stopped');
    }
  }
  
  // Get all metrics
  getAllMetrics() {
    const metrics = {};
    
    for (const [identifier, metric] of this.metrics.entries()) {
      metrics[identifier] = {
        name: metric.name,
        type: metric.type,
        description: metric.description,
        labels: metric.labels,
        value: metric.getValue(),
        lastUpdated: metric.lastUpdated
      };
    }
    
    return metrics;
  }
  
  // Get metrics in Prometheus format
  getPrometheusMetrics() {
    let output = '';
    
    for (const [identifier, metric] of this.metrics.entries()) {
      output += `# HELP ${metric.name} ${metric.description}\n`;
      output += `# TYPE ${metric.name} ${metric.type}\n`;
      
      if (metric.type === METRIC_TYPES.HISTOGRAM) {
        const value = metric.getValue();
        const labelString = this.formatPrometheusLabels(metric.labels);
        
        // Histogram buckets
        for (const bucket of value.buckets) {
          const bucketLabels = { ...metric.labels, le: bucket.le };
          const bucketLabelString = this.formatPrometheusLabels(bucketLabels);
          output += `${metric.name}_bucket${bucketLabelString} ${bucket.count}\n`;
        }
        
        // Count and sum
        output += `${metric.name}_count${labelString} ${value.count}\n`;
        output += `${metric.name}_sum${labelString} ${value.sum}\n`;
      } else {
        const labelString = this.formatPrometheusLabels(metric.labels);
        output += `${metric.name}${labelString} ${metric.getValue()}\n`;
      }
      
      output += '\n';
    }
    
    return output;
  }
  
  // Format labels for Prometheus
  formatPrometheusLabels(labels) {
    const labelPairs = Object.entries(labels)
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    
    return labelPairs ? `{${labelPairs}}` : '';
  }
  
  // Health check
  getHealthStatus() {
    const now = Date.now();
    const staleThreshold = 300000; // 5 minutes
    
    let healthyMetrics = 0;
    let staleMetrics = 0;
    
    for (const metric of this.metrics.values()) {
      if (now - metric.lastUpdated > staleThreshold) {
        staleMetrics++;
      } else {
        healthyMetrics++;
      }
    }
    
    return {
      status: staleMetrics === 0 ? 'healthy' : 'degraded',
      totalMetrics: this.metrics.size,
      healthyMetrics,
      staleMetrics,
      systemMetricsEnabled: this.collectSystemMetrics,
      uptime: process.uptime()
    };
  }
  
  // Cleanup
  shutdown() {
    this.stopSystemMetricsCollection();
    this.metrics.clear();
    logger.info('Metrics collector shut down');
  }
}

// Global metrics collector
let globalCollector = null;

function getMetricsCollector(options = {}) {
  if (!globalCollector) {
    globalCollector = new MetricsCollector(options);
  }
  return globalCollector;
}

// Express middleware for automatic HTTP metrics
function metricsMiddleware(options = {}) {
  const collector = getMetricsCollector(options);
  
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Increment requests in flight
    collector.requestsInFlight.inc();
    
    // Track request size
    const requestSize = parseInt(req.get('Content-Length') || '0', 10);
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const responseSize = parseInt(res.get('Content-Length') || '0', 10);
      
      // Record metrics
      collector.recordHttpRequest(
        req.method,
        req.route?.path || req.path,
        res.statusCode,
        duration,
        requestSize,
        responseSize
      );
      
      // Decrement requests in flight
      collector.requestsInFlight.dec();
      
      // Record errors
      if (res.statusCode >= 400) {
        const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
        collector.recordError(errorType, res.statusCode.toString());
      }
    });
    
    next();
  };
}

module.exports = {
  MetricsCollector,
  Counter,
  Gauge,
  Histogram,
  Timer,
  getMetricsCollector,
  metricsMiddleware,
  METRIC_TYPES,
  TIME_UNITS
}; 