// Distributed Tracing System
// Provides request tracing across microservices with performance monitoring

const { logger } = require('../utils/logger');
const crypto = require('crypto');

// Trace context headers (following OpenTelemetry standards)
const TRACE_HEADERS = {
  TRACE_ID: 'x-trace-id',
  SPAN_ID: 'x-span-id',
  PARENT_SPAN_ID: 'x-parent-span-id',
  TRACE_STATE: 'x-trace-state',
  REQUEST_ID: 'x-request-id',
  CORRELATION_ID: 'x-correlation-id',
  SERVICE_NAME: 'x-service-name',
  OPERATION_NAME: 'x-operation-name'
};

// Span types
const SPAN_TYPES = {
  HTTP: 'http',
  DATABASE: 'database',
  CACHE: 'cache',
  EXTERNAL: 'external',
  INTERNAL: 'internal',
  MESSAGE_QUEUE: 'message_queue',
  AUTHENTICATION: 'authentication',
  BUSINESS_LOGIC: 'business_logic'
};

// Span status codes
const SPAN_STATUS = {
  OK: 'OK',
  ERROR: 'ERROR',
  TIMEOUT: 'TIMEOUT',
  CANCELLED: 'CANCELLED'
};

class Span {
  constructor(options = {}) {
    this.traceId = options.traceId || crypto.randomBytes(16).toString('hex');
    this.spanId = options.spanId || crypto.randomBytes(8).toString('hex');
    this.parentSpanId = options.parentSpanId || null;
    this.operationName = options.operationName || 'unknown-operation';
    this.serviceName = options.serviceName || 'unknown-service';
    this.spanType = options.spanType || SPAN_TYPES.INTERNAL;
    
    // Timing
    this.startTime = Date.now();
    this.endTime = null;
    this.duration = null;
    
    // Status and metadata
    this.status = SPAN_STATUS.OK;
    this.tags = new Map();
    this.logs = [];
    this.baggage = new Map();
    
    // Set default tags
    this.setTag('service.name', this.serviceName);
    this.setTag('operation.name', this.operationName);
    this.setTag('span.type', this.spanType);
    this.setTag('span.id', this.spanId);
    this.setTag('trace.id', this.traceId);
    
    if (this.parentSpanId) {
      this.setTag('parent.span.id', this.parentSpanId);
    }
    
    // Track span hierarchy
    this.children = [];
    this.isFinished = false;
    
    logger.debug('Span created', {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      operationName: this.operationName,
      serviceName: this.serviceName
    });
  }
  
  // Set a tag on the span
  setTag(key, value) {
    this.tags.set(key, value);
    return this;
  }
  
  // Set multiple tags
  setTags(tags) {
    for (const [key, value] of Object.entries(tags)) {
      this.setTag(key, value);
    }
    return this;
  }
  
  // Add a log entry
  log(message, level = 'info', fields = {}) {
    const logEntry = {
      timestamp: Date.now(),
      level,
      message,
      fields: { ...fields }
    };
    
    this.logs.push(logEntry);
    
    logger.debug('Span log added', {
      traceId: this.traceId,
      spanId: this.spanId,
      message,
      level,
      fields
    });
    
    return this;
  }
  
  // Set baggage (cross-service metadata)
  setBaggage(key, value) {
    this.baggage.set(key, value);
    return this;
  }
  
  // Get baggage
  getBaggage(key) {
    return this.baggage.get(key);
  }
  
  // Record an error
  recordError(error) {
    this.status = SPAN_STATUS.ERROR;
    this.setTag('error', true);
    this.setTag('error.message', error.message);
    this.setTag('error.name', error.name);
    this.setTag('error.stack', error.stack);
    
    if (error.code) {
      this.setTag('error.code', error.code);
    }
    
    this.log('Error occurred', 'error', {
      error: error.message,
      errorCode: error.code,
      errorStack: error.stack
    });
    
    logger.warn('Span error recorded', {
      traceId: this.traceId,
      spanId: this.spanId,
      error: error.message,
      errorCode: error.code
    });
    
    return this;
  }
  
  // Record HTTP details
  recordHttp(details) {
    this.setTag('http.method', details.method);
    this.setTag('http.url', details.url);
    this.setTag('http.route', details.route);
    
    if (details.statusCode) {
      this.setTag('http.status_code', details.statusCode);
      
      if (details.statusCode >= 400) {
        this.status = SPAN_STATUS.ERROR;
        this.setTag('error', true);
      }
    }
    
    if (details.userAgent) {
      this.setTag('http.user_agent', details.userAgent);
    }
    
    if (details.requestSize) {
      this.setTag('http.request.size', details.requestSize);
    }
    
    if (details.responseSize) {
      this.setTag('http.response.size', details.responseSize);
    }
    
    return this;
  }
  
  // Record database details
  recordDatabase(details) {
    this.setTag('db.type', details.type || 'postgresql');
    this.setTag('db.name', details.database);
    
    if (details.query) {
      // Sanitize query for logging (remove sensitive data)
      const sanitizedQuery = this.sanitizeQuery(details.query);
      this.setTag('db.statement', sanitizedQuery);
    }
    
    if (details.table) {
      this.setTag('db.table', details.table);
    }
    
    if (details.rowsAffected !== undefined) {
      this.setTag('db.rows_affected', details.rowsAffected);
    }
    
    return this;
  }
  
  // Sanitize database queries for logging
  sanitizeQuery(query) {
    // Remove potential sensitive data patterns
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
      .replace(/password\s*=\s*"[^"]*"/gi, 'password="***"')
      .replace(/token\s*=\s*'[^']*'/gi, "token='***'")
      .replace(/secret\s*=\s*'[^']*'/gi, "secret='***'")
      .substring(0, 1000); // Limit query length
  }
  
  // Create a child span
  createChild(operationName, options = {}) {
    const childSpan = new Span({
      traceId: this.traceId,
      parentSpanId: this.spanId,
      operationName,
      serviceName: options.serviceName || this.serviceName,
      spanType: options.spanType || SPAN_TYPES.INTERNAL,
      ...options
    });
    
    // Copy baggage to child
    for (const [key, value] of this.baggage.entries()) {
      childSpan.setBaggage(key, value);
    }
    
    this.children.push(childSpan);
    return childSpan;
  }
  
  // Finish the span
  finish(status = null) {
    if (this.isFinished) {
      logger.warn('Attempted to finish already finished span', {
        traceId: this.traceId,
        spanId: this.spanId
      });
      return this;
    }
    
    this.endTime = Date.now();
    this.duration = this.endTime - this.startTime;
    this.isFinished = true;
    
    if (status) {
      this.status = status;
    }
    
    this.setTag('duration_ms', this.duration);
    
    // Emit span finished event for exporters
    this.emit('finished');
    
    logger.debug('Span finished', {
      traceId: this.traceId,
      spanId: this.spanId,
      duration: this.duration,
      status: this.status,
      operationName: this.operationName
    });
    
    return this;
  }
  
  // Get span context for propagation
  getContext() {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      baggage: Object.fromEntries(this.baggage.entries())
    };
  }
  
  // Convert to JSON for export
  toJSON() {
    const tags = Object.fromEntries(this.tags.entries());
    const baggage = Object.fromEntries(this.baggage.entries());
    
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      operationName: this.operationName,
      serviceName: this.serviceName,
      spanType: this.spanType,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      status: this.status,
      tags,
      logs: this.logs,
      baggage,
      isFinished: this.isFinished
    };
  }
  
  // Event emission for span lifecycle
  emit(event, data = {}) {
    // This would integrate with your event system
    logger.debug('Span event emitted', {
      event,
      traceId: this.traceId,
      spanId: this.spanId,
      data
    });
  }
}

class DistributedTracer {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'unknown-service';
    this.activeSpans = new Map();
    this.finishedSpans = [];
    this.maxFinishedSpans = options.maxFinishedSpans || 1000;
    this.samplingRate = options.samplingRate || 1.0; // 100% sampling by default
    
    // Exporters for sending trace data
    this.exporters = [];
    
    // Metrics
    this.metrics = {
      spansCreated: 0,
      spansFinished: 0,
      tracesStarted: 0,
      errorsRecorded: 0
    };
    
    logger.info('Distributed tracer initialized', {
      serviceName: this.serviceName,
      samplingRate: this.samplingRate
    });
  }
  
  // Start a new trace
  startTrace(operationName, options = {}) {
    // Check sampling decision
    if (!this.shouldSample()) {
      return new NoOpSpan(); // Return no-op span if not sampling
    }
    
    const span = new Span({
      operationName,
      serviceName: options.serviceName || this.serviceName,
      spanType: options.spanType || SPAN_TYPES.INTERNAL,
      ...options
    });
    
    this.activeSpans.set(span.spanId, span);
    this.metrics.spansCreated++;
    this.metrics.tracesStarted++;
    
    return span;
  }
  
  // Continue a trace from context
  continueTrace(context, operationName, options = {}) {
    if (!this.shouldSample()) {
      return new NoOpSpan();
    }
    
    const span = new Span({
      traceId: context.traceId,
      parentSpanId: context.spanId,
      operationName,
      serviceName: options.serviceName || this.serviceName,
      spanType: options.spanType || SPAN_TYPES.INTERNAL,
      ...options
    });
    
    // Restore baggage
    if (context.baggage) {
      for (const [key, value] of Object.entries(context.baggage)) {
        span.setBaggage(key, value);
      }
    }
    
    this.activeSpans.set(span.spanId, span);
    this.metrics.spansCreated++;
    
    return span;
  }
  
  // Extract trace context from headers
  extractFromHeaders(headers) {
    const traceId = headers[TRACE_HEADERS.TRACE_ID];
    const spanId = headers[TRACE_HEADERS.SPAN_ID];
    
    if (!traceId || !spanId) {
      return null;
    }
    
    const context = {
      traceId,
      spanId,
      baggage: {}
    };
    
    // Extract baggage from headers
    for (const [key, value] of Object.entries(headers)) {
      if (key.startsWith('baggage-')) {
        const baggageKey = key.substring(8); // Remove 'baggage-' prefix
        context.baggage[baggageKey] = value;
      }
    }
    
    return context;
  }
  
  // Inject trace context into headers
  injectIntoHeaders(span, headers = {}) {
    headers[TRACE_HEADERS.TRACE_ID] = span.traceId;
    headers[TRACE_HEADERS.SPAN_ID] = span.spanId;
    headers[TRACE_HEADERS.SERVICE_NAME] = span.serviceName;
    headers[TRACE_HEADERS.OPERATION_NAME] = span.operationName;
    
    if (span.parentSpanId) {
      headers[TRACE_HEADERS.PARENT_SPAN_ID] = span.parentSpanId;
    }
    
    // Inject baggage
    for (const [key, value] of span.baggage.entries()) {
      headers[`baggage-${key}`] = value;
    }
    
    return headers;
  }
  
  // Finish a span
  finishSpan(span) {
    if (!span.isFinished) {
      span.finish();
    }
    
    // Move from active to finished
    this.activeSpans.delete(span.spanId);
    this.finishedSpans.push(span);
    this.metrics.spansFinished++;
    
    // Limit finished spans in memory
    if (this.finishedSpans.length > this.maxFinishedSpans) {
      this.finishedSpans = this.finishedSpans.slice(-this.maxFinishedSpans);
    }
    
    // Export span to external systems
    this.exportSpan(span);
    
    return span;
  }
  
  // Export span to external tracing systems
  exportSpan(span) {
    for (const exporter of this.exporters) {
      try {
        exporter.export(span);
      } catch (error) {
        logger.error('Failed to export span', {
          exporter: exporter.name,
          spanId: span.spanId,
          traceId: span.traceId,
          error: error.message
        });
      }
    }
  }
  
  // Add an exporter
  addExporter(exporter) {
    this.exporters.push(exporter);
    logger.info('Trace exporter added', { exporter: exporter.name });
  }
  
  // Sampling decision
  shouldSample() {
    return Math.random() < this.samplingRate;
  }
  
  // Get metrics
  getMetrics() {
    return {
      ...this.metrics,
      activeSpans: this.activeSpans.size,
      finishedSpans: this.finishedSpans.length,
      exporters: this.exporters.length
    };
  }
  
  // Get traces for debugging
  getTraces(limit = 50) {
    return this.finishedSpans
      .slice(-limit)
      .map(span => span.toJSON());
  }
  
  // Clean up resources
  shutdown() {
    // Finish all active spans
    for (const span of this.activeSpans.values()) {
      this.finishSpan(span);
    }
    
    // Shutdown exporters
    for (const exporter of this.exporters) {
      if (exporter.shutdown) {
        exporter.shutdown();
      }
    }
    
    logger.info('Distributed tracer shut down');
  }
}

// No-op span for when sampling is disabled
class NoOpSpan {
  setTag() { return this; }
  setTags() { return this; }
  log() { return this; }
  setBaggage() { return this; }
  getBaggage() { return null; }
  recordError() { return this; }
  recordHttp() { return this; }
  recordDatabase() { return this; }
  createChild() { return new NoOpSpan(); }
  finish() { return this; }
  getContext() { return {}; }
  toJSON() { return {}; }
  
  get traceId() { return 'noop'; }
  get spanId() { return 'noop'; }
  get isFinished() { return true; }
}

// Global tracer instance
let globalTracer = null;

function getTracer(options = {}) {
  if (!globalTracer) {
    globalTracer = new DistributedTracer(options);
  }
  return globalTracer;
}

// Convenience middleware for Express
function tracingMiddleware(options = {}) {
  const tracer = getTracer(options);
  
  return (req, res, next) => {
    const operationName = `${req.method} ${req.route?.path || req.path}`;
    
    // Try to continue existing trace or start new one
    const context = tracer.extractFromHeaders(req.headers);
    const span = context 
      ? tracer.continueTrace(context, operationName, { spanType: SPAN_TYPES.HTTP })
      : tracer.startTrace(operationName, { spanType: SPAN_TYPES.HTTP });
    
    // Record HTTP details
    span.recordHttp({
      method: req.method,
      url: req.url,
      route: req.route?.path,
      userAgent: req.get('User-Agent')
    });
    
    // Set baggage from request
    if (req.user?.userId) {
      span.setBaggage('user.id', req.user.userId);
    }
    
    // Add to request for downstream use
    req.span = span;
    req.traceId = span.traceId;
    
    // Add trace headers to response
    res.set(TRACE_HEADERS.TRACE_ID, span.traceId);
    res.set(TRACE_HEADERS.SPAN_ID, span.spanId);
    
    // Finish span when response ends
    res.on('finish', () => {
      span.recordHttp({
        statusCode: res.statusCode,
        responseSize: res.get('Content-Length')
      });
      
      tracer.finishSpan(span);
    });
    
    next();
  };
}

module.exports = {
  DistributedTracer,
  Span,
  getTracer,
  tracingMiddleware,
  TRACE_HEADERS,
  SPAN_TYPES,
  SPAN_STATUS
}; 