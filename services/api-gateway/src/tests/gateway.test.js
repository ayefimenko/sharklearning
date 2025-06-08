const request = require('supertest');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Mock the proxy middleware
jest.mock('http-proxy-middleware');

// Mock morgan to return a simple middleware
jest.mock('morgan', () => {
  const morgan = jest.fn(() => (req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`${req.method} ${req.originalUrl}`);
    }
    next();
  });
  
  // Add token method
  morgan.token = jest.fn();
  morgan.compile = jest.fn((format) => format);
  
  return morgan;
});

let app;
let mockConfig;

describe('API Gateway', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset mock config
    mockConfig = {
      shouldError: false,
      errorType: 'ECONNREFUSED',
      shouldEchoBody: false,
      shouldReturnSize: false
    };
    
    // Mock createProxyMiddleware
    createProxyMiddleware.mockImplementation((config) => (req, res, next) => {
      // Store config for error handling
      if (mockConfig.shouldError) {
        const error = new Error('Service unavailable');
        error.code = mockConfig.errorType;
        if (config.onError) {
          config.onError(error, req, res);
        } else {
          res.status(503).json({ error: 'Service unavailable' });
        }
        return;
      }
      
      // Handle body echo test
      if (mockConfig.shouldEchoBody) {
        res.json({ receivedBody: req.body });
        return;
      }
      
      // Handle size test
      if (mockConfig.shouldReturnSize) {
        res.json({ size: JSON.stringify(req.body).length });
        return;
      }
      
      // Default mock proxy behavior
      if (req.originalUrl.includes('/api/users')) {
        res.json({ service: 'user-service', endpoint: req.originalUrl });
      } else if (req.originalUrl.includes('/api/content')) {
        res.json({ service: 'content-service', endpoint: req.originalUrl });
      } else if (req.originalUrl.includes('/api/progress')) {
        res.json({ service: 'progress-service', endpoint: req.originalUrl });
      } else {
        next();
      }
    });

    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret';

    // Require the app after setting up mocks
    delete require.cache[require.resolve('../server.js')];
    app = require('../server.js');
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.NODE_ENV;
    delete process.env.JWT_SECRET;
  });

  describe('Health Check Endpoints', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.service).toBe('api-gateway');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should return API documentation', async () => {
      const response = await request(app).get('/api');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('SharkLearning API Gateway');
      expect(response.body.version).toBe('1.0.0');
      expect(response.body.endpoints).toBeDefined();
      expect(response.body.endpoints.users).toContain('/api/users');
      expect(response.body.endpoints.content).toContain('/api/content');
      expect(response.body.endpoints.progress).toContain('/api/progress');
    });
  });

  describe('Proxy Routing', () => {
    it('should proxy requests to user service', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('x-request-id', 'test-123');

      expect(response.status).toBe(200);
      expect(response.body.service).toBe('user-service');
      expect(response.body.endpoint).toBe('/api/users/profile');
    });

    it('should proxy requests to content service', async () => {
      const response = await request(app)
        .get('/api/content/tracks')
        .set('x-request-id', 'test-456');

      expect(response.status).toBe(200);
      expect(response.body.service).toBe('content-service');
      expect(response.body.endpoint).toBe('/api/content/tracks');
    });

    it('should proxy requests to progress service', async () => {
      const response = await request(app)
        .post('/api/progress/update')
        .set('x-request-id', 'test-789')
        .send({ userId: 1, courseId: 1, progress: 50 });

      expect(response.status).toBe(200);
      expect(response.body.service).toBe('progress-service');
      expect(response.body.endpoint).toBe('/api/progress/update');
    });
  });

  describe('Request ID Handling', () => {
    it('should add request ID if not present', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-request-id']).toMatch(/^req-\d+-\w+$/);
    });

    it('should preserve existing request ID', async () => {
      const customRequestId = 'custom-request-id-123';
      const response = await request(app)
        .get('/health')
        .set('x-request-id', customRequestId);

      expect(response.headers['x-request-id']).toBe(customRequestId);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const response = await request(app).get('/unknown-endpoint');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Endpoint not found');
      expect(response.body.path).toBe('/unknown-endpoint');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should handle proxy errors gracefully', async () => {
      // Configure mock to simulate error
      mockConfig.shouldError = true;

      const response = await request(app).get('/api/users/test');

      expect(response.status).toBe(503);
    });
  });

  describe('Rate Limiting', () => {
    it('should accept requests within rate limit', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    });

    // Note: Testing actual rate limiting would require making many requests
    // This is more of an integration test that would be better in a separate suite
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/health');

      // Helmet should add these headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.headers['x-xss-protection']).toBe('0');
    });
  });

  describe('CORS Handling', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/users/register')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should allow configured origins', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });
  });

  describe('Request Logging', () => {
    it('should log requests in development mode', async () => {
      // Set NODE_ENV to development for this test
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Re-require the app with development environment
      delete require.cache[require.resolve('../server.js')];
      app = require('../server.js');

      await request(app).get('/health');

      // In development mode, requests should be logged
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('Body Parsing', () => {
    it('should parse JSON bodies', async () => {
      const testData = { test: 'data' };
      
      // Configure mock to echo body
      mockConfig.shouldEchoBody = true;

      const response = await request(app)
        .post('/api/users/test')
        .send(testData);

      expect(response.body.receivedBody).toEqual(testData);
    });

    it('should handle large payloads within limit', async () => {
      const largeData = { data: 'x'.repeat(1000) }; // Small test payload
      
      // Configure mock to return size
      mockConfig.shouldReturnSize = true;

      const response = await request(app)
        .post('/api/users/test')
        .send(largeData);

      expect(response.status).toBe(200);
      expect(response.body.size).toBeGreaterThan(1000);
    });
  });
}); 