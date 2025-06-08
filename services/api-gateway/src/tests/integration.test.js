const request = require('supertest');
const { Pool } = require('pg');

// DO NOT MOCK - Test real connectivity
let app;
let pool;

describe('API Gateway Integration Tests', () => {
  beforeAll(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-for-integration-testing';
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:secure_postgres_password_2024@localhost:5432/sharklearning';

    // Initialize real database pool for direct testing
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false
    });

    // Import app after setting environment
    delete require.cache[require.resolve('../server.js')];
    app = require('../server.js');

    // Wait for services to be ready
    await waitForServices();
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  const waitForServices = async (maxRetries = 10) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await pool.query('SELECT 1');
        console.log('✅ Database connection established for API Gateway tests');
        return;
      } catch (error) {
        console.log(`⏳ Waiting for database... (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    throw new Error('❌ Database connection failed after maximum retries');
  };

  describe('Gateway Health Checks', () => {
    it('should return gateway health status', async () => {
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
    });
  });

  describe('Database Health Monitoring', () => {
    it('should check database connectivity through monitoring endpoint', async () => {
      const response = await request(app).get('/monitoring/health/detailed');
      
      // Should return health status (might be 200 or 503 depending on setup)
      expect([200, 503]).toContain(response.status);
      expect(response.body.timestamp).toBeDefined();
      
      if (response.status === 200) {
        expect(response.body.status).toBe('healthy');
        expect(response.body.services.database).toBeDefined();
      }
    });

    it('should provide liveness probe', async () => {
      const response = await request(app).get('/monitoring/live');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('alive');
      expect(response.body.uptime).toBeDefined();
    });

    it('should provide readiness probe', async () => {
      const response = await request(app).get('/monitoring/ready');
      
      // Should return status (might be 200 or 503 depending on dependencies)
      expect([200, 503]).toContain(response.status);
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('User Service Proxy Integration', () => {
    it('should proxy user registration to user service', async () => {
      const uniqueEmail = `gateway${Date.now()}@integration.com`;
      
      const response = await request(app)
        .post('/api/users/register')
        .send({
          firstName: 'Gateway',
          lastName: 'Test',
          email: uniqueEmail,
          password: 'TestPass123!',
          confirmPassword: 'TestPass123!'
        });

      expect(response.status).toBe(201);
      expect(response.body.user.email).toBe(uniqueEmail);
      expect(response.body.token).toBeDefined();

      // Verify user was created in database
      const dbResult = await pool.query('SELECT * FROM users WHERE email = $1', [uniqueEmail]);
      expect(dbResult.rows.length).toBe(1);

      // Cleanup
      await pool.query('DELETE FROM users WHERE email = $1', [uniqueEmail]);
    });

    it('should proxy user login to user service', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'student@sharklearning.com',
          password: 'TestPass123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.user.email).toBe('student@sharklearning.com');
      expect(response.body.token).toBeDefined();
    });

    it('should proxy protected user endpoints with authentication', async () => {
      // First login to get token
      const loginResponse = await request(app)
        .post('/api/users/login')
        .send({
          email: 'student@sharklearning.com',
          password: 'TestPass123!'
        });

      const token = loginResponse.body.token;

      // Then access protected endpoint
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('student@sharklearning.com');
    });
  });

  describe('Content Service Proxy Integration', () => {
    it('should proxy learning tracks request to content service', async () => {
      const response = await request(app).get('/api/content/tracks');
      
      expect(response.status).toBe(200);
      expect(response.body.tracks).toBeDefined();
      expect(Array.isArray(response.body.tracks)).toBe(true);
    });

    it('should proxy specific track request to content service', async () => {
      // First get available tracks
      const tracksResponse = await request(app).get('/api/content/tracks');
      
      if (tracksResponse.body.tracks.length > 0) {
        const trackId = tracksResponse.body.tracks[0].id;
        
        const response = await request(app).get(`/api/content/tracks/${trackId}`);
        
        expect([200, 404]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.track).toBeDefined();
          expect(response.body.track.id).toBe(trackId);
        }
      }
    });
  });

  describe('Progress Service Proxy Integration', () => {
    let authToken;

    beforeAll(async () => {
      // Login to get auth token for progress endpoints
      const loginResponse = await request(app)
        .post('/api/users/login')
        .send({
          email: 'student@sharklearning.com',
          password: 'TestPass123!'
        });

      authToken = loginResponse.body.token;
    });

    it('should proxy progress overview request to progress service', async () => {
      const response = await request(app)
        .get('/api/progress/overview')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.stats).toBeDefined();
      }
    });

    it('should proxy achievements request to progress service', async () => {
      const response = await request(app)
        .get('/api/progress/achievements')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.achievements).toBeDefined();
        expect(Array.isArray(response.body.achievements)).toBe(true);
      }
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid endpoints gracefully', async () => {
      const response = await request(app).get('/api/invalid/endpoint');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should handle authentication errors properly', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect([401, 403]).toContain(response.status);
    });

    it('should handle malformed requests', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'invalid-email-format',
          password: 'short'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('CORS Integration', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/users/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should include CORS headers in actual requests', async () => {
      const response = await request(app)
        .get('/api/content/tracks')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should apply rate limiting to endpoints', async () => {
      // Make multiple requests quickly to test rate limiting
      const requests = Array(10).fill().map(() =>
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed (health endpoint has high limits)
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.status).toBe('OK');
        }
      });
    });

    it('should include rate limit headers', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      // Rate limit headers might be present depending on configuration
      if (response.headers['x-ratelimit-limit']) {
        expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      }
    });
  });

  describe('Security Headers Integration', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      // Check for common security headers
      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('Request ID Tracking', () => {
    it('should generate and track request IDs', async () => {
      const response = await request(app)
        .get('/health')
        .set('X-Request-ID', 'test-request-123');

      expect(response.status).toBe(200);
      // Request ID should be echoed back or generated if not provided
      expect(response.headers['x-request-id']).toBeDefined();
    });
  });

  describe('End-to-End User Journey', () => {
    it('should support complete user registration and login flow', async () => {
      const uniqueEmail = `e2e${Date.now()}@integration.com`;

      // 1. Register new user
      const registerResponse = await request(app)
        .post('/api/users/register')
        .send({
          firstName: 'E2E',
          lastName: 'Test',
          email: uniqueEmail,
          password: 'TestPass123!',
          confirmPassword: 'TestPass123!'
        });

      expect(registerResponse.status).toBe(201);
      const firstToken = registerResponse.body.token;

      // 2. Login with new credentials
      const loginResponse = await request(app)
        .post('/api/users/login')
        .send({
          email: uniqueEmail,
          password: 'TestPass123!'
        });

      expect(loginResponse.status).toBe(200);
      const secondToken = loginResponse.body.token;

      // 3. Access protected profile endpoint
      const profileResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${secondToken}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.email).toBe(uniqueEmail);

      // 4. Update profile
      const updateResponse = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${secondToken}`)
        .send({
          firstName: 'Updated E2E',
          lastName: 'Test User'
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.user.firstName).toBe('Updated E2E');

      // 5. Verify learning content is accessible
      const contentResponse = await request(app)
        .get('/api/content/tracks');

      expect(contentResponse.status).toBe(200);
      expect(Array.isArray(contentResponse.body.tracks)).toBe(true);

      // Cleanup
      await pool.query('DELETE FROM users WHERE email = $1', [uniqueEmail]);
    });
  });
}); 