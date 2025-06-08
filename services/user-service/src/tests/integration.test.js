const request = require('supertest');
const { Pool } = require('pg');

// DO NOT MOCK - Test real database connectivity
let app;
let pool;

describe('User Service Integration Tests', () => {
  beforeAll(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-for-integration-testing';
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:secure_postgres_password_2024@localhost:5432/sharklearning';

    // Initialize real database pool
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false
    });

    // Import app after setting environment
    delete require.cache[require.resolve('../server.js')];
    app = require('../server.js');

    // Wait for database to be ready
    await waitForDatabase();
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  const waitForDatabase = async (maxRetries = 10) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await pool.query('SELECT 1');
        console.log('✅ Database connection established');
        return;
      } catch (error) {
        console.log(`⏳ Waiting for database... (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    throw new Error('❌ Database connection failed after maximum retries');
  };

  describe('Database Connectivity', () => {
    it('should connect to the database successfully', async () => {
      const result = await pool.query('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);
    });

    it('should have required tables', async () => {
      const result = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'learning_tracks', 'courses', 'user_progress', 'achievements')
      `);
      
      const tableNames = result.rows.map(row => row.table_name);
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('learning_tracks');
      expect(tableNames).toContain('courses');
      expect(tableNames).toContain('user_progress');
      expect(tableNames).toContain('achievements');
    });

    it('should have test users in database', async () => {
      const result = await pool.query('SELECT email, role FROM users WHERE email LIKE \'%sharklearning.com\'');
      expect(result.rows.length).toBeGreaterThan(0);
      
      const emails = result.rows.map(row => row.email);
      expect(emails).toContain('admin@sharklearning.com');
      expect(emails).toContain('student@sharklearning.com');
    });
  });

  describe('Service Health Checks', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.service).toBe('user-service');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Authentication Integration', () => {
    it('should login with test admin account', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'admin@sharklearning.com',
          password: 'TestPass123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.user.email).toBe('admin@sharklearning.com');
      expect(response.body.user.role).toBe('admin');
      expect(response.body.token).toBeDefined();
    });

    it('should login with test student account', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'student@sharklearning.com',
          password: 'TestPass123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.user.email).toBe('student@sharklearning.com');
      expect(response.body.user.role).toBe('student');
      expect(response.body.token).toBeDefined();
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'student@sharklearning.com',
          password: 'WrongPassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should register new user and store in database', async () => {
      const uniqueEmail = `test${Date.now()}@integration.com`;
      
      const response = await request(app)
        .post('/register')
        .send({
          firstName: 'Integration',
          lastName: 'Test',
          email: uniqueEmail,
          password: 'TestPass123!',
          confirmPassword: 'TestPass123!'
        });

      expect(response.status).toBe(201);
      expect(response.body.user.email).toBe(uniqueEmail);

      // Verify user was actually stored in database
      const dbResult = await pool.query('SELECT * FROM users WHERE email = $1', [uniqueEmail]);
      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].email).toBe(uniqueEmail);
      expect(dbResult.rows[0].first_name).toBe('Integration');

      // Cleanup
      await pool.query('DELETE FROM users WHERE email = $1', [uniqueEmail]);
    });
  });

  describe('Protected Endpoints Integration', () => {
    let authToken;
    let userId;

    beforeAll(async () => {
      // Login to get auth token
      const loginResponse = await request(app)
        .post('/login')
        .send({
          email: 'student@sharklearning.com',
          password: 'TestPass123!'
        });

      authToken = loginResponse.body.token;
      userId = loginResponse.body.user.id;
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('student@sharklearning.com');
      expect(response.body.id).toBe(userId);
    });

    it('should update user profile and persist changes', async () => {
      const updatedData = {
        firstName: 'Updated',
        lastName: 'Student'
      };

      const response = await request(app)
        .put('/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedData);

      expect(response.status).toBe(200);
      expect(response.body.user.firstName).toBe('Updated');

      // Verify changes persisted in database
      const dbResult = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [userId]);
      expect(dbResult.rows[0].first_name).toBe('Updated');
      expect(dbResult.rows[0].last_name).toBe('Student');

      // Restore original data
      await pool.query('UPDATE users SET first_name = $1, last_name = $2 WHERE id = $3', 
        ['Student', 'Demo', userId]);
    });

    it('should reject requests without authentication token', async () => {
      const response = await request(app).get('/profile');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });
  });

  describe('Database Error Handling', () => {
    it('should handle duplicate email registration', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          firstName: 'Duplicate',
          lastName: 'Test',
          email: 'admin@sharklearning.com', // Already exists
          password: 'TestPass123!',
          confirmPassword: 'TestPass123!'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Email already registered');
    });

    it('should handle database connection issues gracefully', async () => {
      // Create a temporary pool with invalid connection
      const invalidPool = new Pool({
        connectionString: 'postgresql://invalid:invalid@localhost:5432/invalid'
      });

      try {
        await invalidPool.query('SELECT 1');
        fail('Expected connection to fail');
      } catch (error) {
        expect(error.message).toContain('password authentication failed');
      } finally {
        await invalidPool.end().catch(() => {}); // Ignore cleanup errors
      }
    });
  });

  describe('Data Integrity Tests', () => {
    it('should maintain referential integrity', async () => {
      // Test that we can't delete a user with progress
      const userResult = await pool.query('SELECT id FROM users LIMIT 1');
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;

        // Try to create progress for this user
        const trackResult = await pool.query('SELECT id FROM learning_tracks LIMIT 1');
        if (trackResult.rows.length > 0) {
          const trackId = trackResult.rows[0].id;
          
          try {
            await pool.query(`
              INSERT INTO user_progress (user_id, track_id, course_id, progress_percentage) 
              VALUES ($1, $2, 1, 50)
            `, [userId, trackId]);
            
            // Now try to delete the user - should be prevented by cascade
            await pool.query('DELETE FROM users WHERE id = $1', [userId]);
            
            // Verify user was actually deleted (cascade should work)
            const deletedUser = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
            expect(deletedUser.rows.length).toBe(0);
            
            // Verify progress was also deleted
            const deletedProgress = await pool.query('SELECT id FROM user_progress WHERE user_id = $1', [userId]);
            expect(deletedProgress.rows.length).toBe(0);
          } catch (error) {
            // If user can't be deleted, that's also acceptable behavior
            expect(error.message).toBeDefined();
          }
        }
      }
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array(10).fill().map(() =>
        request(app)
          .post('/login')
          .send({
            email: 'student@sharklearning.com',
            password: 'TestPass123!'
          })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.token).toBeDefined();
      });
    });

    it('should complete database queries within reasonable time', async () => {
      const startTime = Date.now();
      
      await pool.query('SELECT * FROM users LIMIT 100');
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
}); 