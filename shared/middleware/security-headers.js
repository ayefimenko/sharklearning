// Enhanced Security Headers Middleware
// Implements comprehensive security headers for modern web security

const { logger } = require('../utils/logger');

// Security configuration
const SECURITY_CONFIG = {
  // Content Security Policy
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for some frontend frameworks - should be removed in production
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for some CSS frameworks
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "data:"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "blob:"
      ],
      connectSrc: [
        "'self'",
        "https://api.sharklearning.com",
        "wss://api.sharklearning.com"
      ],
      mediaSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: []
    },
    reportUri: '/api/csp-report'
  },
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // Additional security headers
  headers: {
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    xDNSPrefetchControl: 'off',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'speaker=()',
      'fullscreen=(self)',
      'sync-xhr=()'
    ].join(', ')
  }
};

// Generate CSP header value
function generateCSPHeader(config = SECURITY_CONFIG.csp) {
  const directives = [];
  
  for (const [directive, sources] of Object.entries(config.directives)) {
    // Convert camelCase to kebab-case
    const kebabDirective = directive.replace(/([A-Z])/g, '-$1').toLowerCase();
    
    if (sources.length === 0) {
      directives.push(kebabDirective);
    } else {
      directives.push(`${kebabDirective} ${sources.join(' ')}`);
    }
  }
  
  let cspValue = directives.join('; ');
  
  if (config.reportUri) {
    cspValue += `; report-uri ${config.reportUri}`;
  }
  
  return cspValue;
}

// Main security headers middleware
function securityHeaders(options = {}) {
  const config = {
    ...SECURITY_CONFIG,
    ...options
  };
  
  return (req, res, next) => {
    try {
      // Content Security Policy
      if (config.csp && !config.csp.disabled) {
        const cspValue = generateCSPHeader(config.csp);
        res.setHeader('Content-Security-Policy', cspValue);
        
        // Also set report-only header for testing
        if (config.csp.reportOnly) {
          res.setHeader('Content-Security-Policy-Report-Only', cspValue);
        }
      }
      
      // HTTP Strict Transport Security (only for HTTPS)
      if (config.hsts && (req.secure || req.headers['x-forwarded-proto'] === 'https')) {
        let hstsValue = `max-age=${config.hsts.maxAge}`;
        if (config.hsts.includeSubDomains) {
          hstsValue += '; includeSubDomains';
        }
        if (config.hsts.preload) {
          hstsValue += '; preload';
        }
        res.setHeader('Strict-Transport-Security', hstsValue);
      }
      
      // X-Frame-Options
      if (config.headers.xFrameOptions) {
        res.setHeader('X-Frame-Options', config.headers.xFrameOptions);
      }
      
      // X-Content-Type-Options
      if (config.headers.xContentTypeOptions) {
        res.setHeader('X-Content-Type-Options', config.headers.xContentTypeOptions);
      }
      
      // X-DNS-Prefetch-Control
      if (config.headers.xDNSPrefetchControl) {
        res.setHeader('X-DNS-Prefetch-Control', config.headers.xDNSPrefetchControl);
      }
      
      // Referrer Policy
      if (config.headers.referrerPolicy) {
        res.setHeader('Referrer-Policy', config.headers.referrerPolicy);
      }
      
      // Permissions Policy (formerly Feature Policy)
      if (config.headers.permissionsPolicy) {
        res.setHeader('Permissions-Policy', config.headers.permissionsPolicy);
      }
      
      // X-Permitted-Cross-Domain-Policies
      res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
      
      // Cross-Origin Embedder Policy
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      
      // Cross-Origin Opener Policy
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      
      // Cross-Origin Resource Policy
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      
      // Remove server information
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');
      
      logger.debug('Security headers applied', {
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        requestId: req.headers['x-request-id']
      });
      
      next();
    } catch (error) {
      logger.error('Error applying security headers', {
        error: error.message,
        path: req.path,
        method: req.method,
        requestId: req.headers['x-request-id']
      });
      
      // Continue even if security headers fail to avoid breaking the app
      next();
    }
  };
}

// CSP violation reporting endpoint
function cspReportHandler() {
  return (req, res) => {
    try {
      const report = req.body;
      
      logger.warn('CSP Violation Report', {
        violatedDirective: report['violated-directive'],
        blockedUri: report['blocked-uri'],
        documentUri: report['document-uri'],
        originalPolicy: report['original-policy'],
        disposition: report.disposition,
        statusCode: report['status-code'],
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      
      // In production, you might want to send this to a monitoring service
      // await sendToMonitoringService(report);
      
      res.status(204).end();
    } catch (error) {
      logger.error('Error processing CSP report', {
        error: error.message,
        body: req.body
      });
      res.status(400).json({ error: 'Invalid CSP report' });
    }
  };
}

// Security headers for API responses
function apiSecurityHeaders() {
  return (req, res, next) => {
    // Additional headers for API endpoints
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    // Prevent MIME type sniffing
    if (res.getHeader('Content-Type') && res.getHeader('Content-Type').startsWith('application/json')) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
    
    next();
  };
}

// Enhanced CORS configuration
function enhancedCors(options = {}) {
  const defaultOptions = {
    origin: function(origin, callback) {
      // In development, allow all origins
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      
      // In production, use allowlist
      const allowedOrigins = options.allowedOrigins || [
        'https://sharklearning.com',
        'https://www.sharklearning.com',
        'https://app.sharklearning.com'
      ];
      
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked request', {
          origin,
          allowedOrigins,
          userAgent: req.get('User-Agent')
        });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Request-ID',
      'X-Correlation-ID'
    ],
    exposedHeaders: [
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],
    maxAge: 86400 // 24 hours
  };
  
  return { ...defaultOptions, ...options };
}

// Security middleware for different environments
function getSecurityConfig(environment = 'development') {
  const configs = {
    development: {
      csp: {
        ...SECURITY_CONFIG.csp,
        reportOnly: true, // Use report-only mode in development
        directives: {
          ...SECURITY_CONFIG.csp.directives,
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'", // Allow eval in development
            "https://cdn.jsdelivr.net",
            "https://cdnjs.cloudflare.com"
          ]
        }
      },
      hsts: {
        ...SECURITY_CONFIG.hsts,
        maxAge: 0 // Disable HSTS in development
      }
    },
    
    production: {
      ...SECURITY_CONFIG,
      csp: {
        ...SECURITY_CONFIG.csp,
        reportOnly: false, // Enforce CSP in production
        directives: {
          ...SECURITY_CONFIG.csp.directives,
          scriptSrc: [
            "'self'",
            "https://cdn.jsdelivr.net"
            // Remove unsafe-inline and unsafe-eval
          ]
        }
      }
    },
    
    staging: {
      ...SECURITY_CONFIG,
      csp: {
        ...SECURITY_CONFIG.csp,
        reportOnly: true // Use report-only mode in staging for testing
      }
    }
  };
  
  return configs[environment] || configs.development;
}

module.exports = {
  securityHeaders,
  apiSecurityHeaders,
  cspReportHandler,
  enhancedCors,
  getSecurityConfig,
  generateCSPHeader,
  SECURITY_CONFIG
}; 