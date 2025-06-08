const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Mock the dependencies before requiring anything else
jest.mock('pg', () => {
  const mockQuery = jest.fn();
  const mockPool = {
    query: mockQuery
  };
  return {
    Pool: jest.fn(() => mockPool)
  };
});
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

// Import the app (we'll need to modify server.js to export the app)
let app;
let mockQuery;

describe('User Service Authentication', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Get the mock query function
    const { Pool } = require('pg');
    mockQuery = Pool().query;

    // Mock JWT_SECRET environment variable
    process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

    // Require the app after setting up mocks
    delete require.cache[require.resolve('../server.js')];
    app = require('../server.js');
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
  });

  describe('POST /register', () => {
    it('should register a new user successfully', async () => {
      // Mock bcrypt hash
      bcrypt.hash.mockResolvedValue('hashed-password');
      
      // Mock JWT sign
      jwt.sign.mockReturnValue('mock-jwt-token');

      // Mock database queries
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // Check if user exists (should be empty)
        .mockResolvedValueOnce({ // Insert new user
          rows: [{
            id: 1,
            email: 'test@example.com',
            first_name: 'John',
            last_name: 'Doe',
            role: 'student',
            created_at: new Date()
          }]
        });

      const response = await request(app)
        .post('/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'test@example.com',
          password: 'TestPass123',
          confirmPassword: 'TestPass123'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.token).toBe('mock-jwt-token');
      expect(bcrypt.hash).toHaveBeenCalledWith('TestPass123', 12);
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'test@example.com',
          password: 'weak',
          confirmPassword: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('Password must be 6-128 characters')
          })
        ])
      );
    });

    it('should reject registration with mismatched passwords', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'test@example.com',
          password: 'TestPass123',
          confirmPassword: 'DifferentPass123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'Password confirmation does not match password'
          })
        ])
      );
    });

    it('should reject registration with existing email', async () => {
      // Mock database query to return existing user
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ id: 1, email: 'test@example.com' }] 
      });

      const response = await request(app)
        .post('/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'test@example.com',
          password: 'TestPass123',
          confirmPassword: 'TestPass123'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Email already registered');
    });

    it('should reject registration with invalid email format', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'invalid-email',
          password: 'TestPass123',
          confirmPassword: 'TestPass123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject registration with XSS attempt', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          firstName: '<script>alert("xss")</script>',
          lastName: 'Doe',
          email: 'test@example.com',
          password: 'TestPass123',
          confirmPassword: 'TestPass123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid input detected');
    });
  });

  describe('POST /login', () => {
    it('should login user with valid credentials', async () => {
      // Mock bcrypt compare
      bcrypt.compare.mockResolvedValue(true);
      
      // Mock JWT sign
      jwt.sign.mockReturnValue('mock-jwt-token');

      // Mock database query to return user
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: 'test@example.com',
          password_hash: 'hashed-password',
          first_name: 'John',
          last_name: 'Doe',
          role: 'student',
          is_active: true
        }]
      });

      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'TestPass123'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.token).toBe('mock-jwt-token');
      expect(bcrypt.compare).toHaveBeenCalledWith('TestPass123', 'hashed-password');
    });

    it('should reject login with invalid email', async () => {
      // Mock database query to return no user
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPass123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject login with wrong password', async () => {
      // Mock bcrypt compare to return false
      bcrypt.compare.mockResolvedValue(false);

      // Mock database query to return user
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: 'test@example.com',
          password_hash: 'hashed-password',
          first_name: 'John',
          last_name: 'Doe',
          role: 'student',
          is_active: true
        }]
      });

      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject login for inactive account', async () => {
      // Mock database query to return inactive user
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: 'test@example.com',
          password_hash: 'hashed-password',
          first_name: 'John',
          last_name: 'Doe',
          role: 'student',
          is_active: false
        }]
      });

      const response = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'TestPass123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Account is deactivated');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.service).toBe('user-service');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Authentication Middleware', () => {
    it('should accept valid JWT token', async () => {
      // Mock JWT verify
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { userId: 1, email: 'test@example.com', role: 'student' });
      });

      // Mock database query for profile
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          role: 'student',
          profile_image: null,
          created_at: new Date()
        }]
      });

      const response = await request(app)
        .get('/profile')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('test@example.com');
    });

    it('should reject request without token', async () => {
      const response = await request(app).get('/profile');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    it('should reject request with invalid token', async () => {
      // Mock JWT verify to call callback with error
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(new Error('Invalid token'), null);
      });

      const response = await request(app)
        .get('/profile')
        .set('Authorization', 'Bearer invalid-jwt-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });
  });
}); 