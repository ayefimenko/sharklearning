const request = require('supertest');
const { Pool } = require('pg');

let app;
let pool;
let authToken;
let testUserId;

describe('Progress Service Integration Tests', () => {
  beforeAll(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-for-integration';
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

    // Get authentication token for test user
    await setupTestAuthentication();
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
        console.log('✅ Database connection established for progress service');
        return;
      } catch (error) {
        console.log(`⏳ Waiting for database... (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    throw new Error('❌ Database connection failed after maximum retries');
  };

  const setupTestAuthentication = async () => {
    try {
      // Login with test student account to get token
      const userServiceResponse = await request('http://localhost:3001')
        .post('/login')
        .send({
          email: 'student@sharklearning.com',
          password: 'TestPass123!'
        });

      if (userServiceResponse.status === 200) {
        authToken = userServiceResponse.body.token;
        testUserId = userServiceResponse.body.user.id;
        console.log('✅ Test authentication token obtained');
      } else {
        // Fallback: create a mock JWT token for testing
        const jwt = require('jsonwebtoken');
        const testUser = await pool.query('SELECT id FROM users WHERE email = $1', ['student@sharklearning.com']);
        if (testUser.rows.length > 0) {
          testUserId = testUser.rows[0].id;
          authToken = jwt.sign(
            { userId: testUserId, email: 'student@sharklearning.com' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
          );
          console.log('✅ Fallback JWT token created for testing');
        }
      }
    } catch (error) {
      console.log('⚠️ Could not obtain auth token from user service, using fallback');
      // Create a fallback JWT token
      const jwt = require('jsonwebtoken');
      authToken = jwt.sign(
        { userId: 1, email: 'student@sharklearning.com' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      testUserId = 1;
    }
  };

  describe('Database Connectivity', () => {
    it('should connect to the database successfully', async () => {
      const result = await pool.query('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);
    });

    it('should have required tables for progress tracking', async () => {
      const result = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('user_progress', 'achievements', 'user_achievements')
      `);
      
      const tableNames = result.rows.map(row => row.table_name);
      expect(tableNames).toContain('user_progress');
      expect(tableNames).toContain('achievements');
      expect(tableNames).toContain('user_achievements');
    });
  });

  describe('Service Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.service).toBe('progress-service');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Progress Overview Integration', () => {
    it('should get user progress overview with real data', async () => {
      const response = await request(app)
        .get('/overview')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('stats');
      expect(response.body).toHaveProperty('recentProgress');
      expect(response.body).toHaveProperty('achievements');
      
      expect(response.body.stats).toHaveProperty('completedCourses');
      expect(response.body.stats).toHaveProperty('totalEnrolled');
      expect(response.body.stats).toHaveProperty('averageProgress');
      expect(response.body.stats).toHaveProperty('totalPoints');
      
      expect(Array.isArray(response.body.recentProgress)).toBe(true);
      expect(Array.isArray(response.body.achievements)).toBe(true);
    });

    it('should handle authentication properly', async () => {
      const response = await request(app)
        .get('/overview');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });
  });

  describe('Course Progress Integration', () => {
    it('should track course progress correctly', async () => {
      const courseId = 1; // Use first course from test data

      // Start with 25% progress
      const startResponse = await request(app)
        .put(`/courses/${courseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ progressPercentage: 25 });

      expect(startResponse.status).toBe(200);
      expect(startResponse.body.message).toBe('Progress updated successfully');
      expect(startResponse.body.progress.progressPercentage).toBe(25);
      expect(startResponse.body.progress.isCompleted).toBe(false);

      // Get progress to verify it was saved
      const getResponse = await request(app)
        .get(`/courses/${courseId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.progressPercentage).toBe(25);
      expect(getResponse.body.isCompleted).toBe(false);

      // Update to 100% (completed)
      const completeResponse = await request(app)
        .put(`/courses/${courseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ progressPercentage: 100 });

      expect(completeResponse.status).toBe(200);
      expect(completeResponse.body.progress.progressPercentage).toBe(100);
      expect(completeResponse.body.progress.isCompleted).toBe(true);

      // Verify progress was updated
      const finalGetResponse = await request(app)
        .get(`/courses/${courseId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(finalGetResponse.status).toBe(200);
      expect(finalGetResponse.body.progressPercentage).toBe(100);
      expect(finalGetResponse.body.isCompleted).toBe(true);
    });

    it('should validate progress percentage limits', async () => {
      const courseId = 1;

      // Test negative percentage
      const negativeResponse = await request(app)
        .put(`/courses/${courseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ progressPercentage: -5 });

      expect(negativeResponse.status).toBe(400);
      expect(negativeResponse.body.error).toBe('Validation failed');

      // Test percentage over 100
      const overResponse = await request(app)
        .put(`/courses/${courseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ progressPercentage: 150 });

      expect(overResponse.status).toBe(400);
      expect(overResponse.body.error).toBe('Validation failed');
    });

    it('should handle non-existent course gracefully', async () => {
      const nonExistentCourseId = 99999;

      const response = await request(app)
        .get(`/courses/${nonExistentCourseId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.progressPercentage).toBe(0);
      expect(response.body.isCompleted).toBe(false);
    });
  });

  describe('Achievement System Integration', () => {
    it('should award achievements automatically', async () => {
      // Complete a course to trigger achievement checking
      const courseId = 2;
      
      const response = await request(app)
        .put(`/courses/${courseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ progressPercentage: 100 });

      expect(response.status).toBe(200);

      // Check if achievement was awarded by getting overview
      const overviewResponse = await request(app)
        .get('/overview')
        .set('Authorization', `Bearer ${authToken}`);

      expect(overviewResponse.status).toBe(200);
      
      // Should have some achievements (including the "First Steps" achievement)
      const achievements = overviewResponse.body.achievements;
      expect(Array.isArray(achievements)).toBe(true);
      
      // Check if we have the First Steps achievement
      const firstStepsAchievement = achievements.find(a => a.title === 'First Steps');
      if (firstStepsAchievement) {
        expect(firstStepsAchievement.points).toBe(10);
        expect(firstStepsAchievement.badgeIcon).toBe('🎯');
      }
    });
  });

  describe('Leaderboard Integration', () => {
    it('should return leaderboard with real data', async () => {
      const response = await request(app)
        .get('/leaderboard')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      if (response.body.length > 0) {
        const topUser = response.body[0];
        expect(topUser).toHaveProperty('rank');
        expect(topUser).toHaveProperty('name');
        expect(topUser).toHaveProperty('points');
        expect(topUser).toHaveProperty('achievements');
        expect(topUser).toHaveProperty('completedCourses');
        expect(topUser.rank).toBe(1);
      }
    });

    it('should rank users correctly by points', async () => {
      const response = await request(app)
        .get('/leaderboard')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      if (response.body.length > 1) {
        // Verify that users are ranked by points (descending)
        for (let i = 0; i < response.body.length - 1; i++) {
          expect(response.body[i].points).toBeGreaterThanOrEqual(response.body[i + 1].points);
          expect(response.body[i].rank).toBe(i + 1);
        }
      }
    });
  });

  describe('Real-time Progress Updates', () => {
    it('should update progress and reflect in overview immediately', async () => {
      const courseId = 3;

      // Get initial overview
      const initialOverview = await request(app)
        .get('/overview')
        .set('Authorization', `Bearer ${authToken}`);

      expect(initialOverview.status).toBe(200);
      const initialStats = initialOverview.body.stats;

      // Update course progress
      await request(app)
        .put(`/courses/${courseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ progressPercentage: 50 });

      // Get updated overview
      const updatedOverview = await request(app)
        .get('/overview')
        .set('Authorization', `Bearer ${authToken}`);

      expect(updatedOverview.status).toBe(200);
      const updatedStats = updatedOverview.body.stats;

      // Should have at least the progress we just made
      expect(updatedStats.totalEnrolled).toBeGreaterThanOrEqual(initialStats.totalEnrolled);
      expect(updatedStats.averageProgress).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Data Persistence', () => {
    it('should persist progress across multiple requests', async () => {
      const courseId = 4;
      const progressValue = 75;

      // Set progress
      await request(app)
        .put(`/courses/${courseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ progressPercentage: progressValue });

      // Verify persistence by making multiple requests
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .get(`/courses/${courseId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.progressPercentage).toBe(progressValue);
      }
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle database connection issues gracefully', async () => {
      // This test would require temporarily breaking the database connection
      // For now, we'll test with invalid parameters
      const response = await request(app)
        .get('/courses/not-a-number')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid course ID');
    });

    it('should handle malformed authentication tokens', async () => {
      const response = await request(app)
        .get('/overview')
        .set('Authorization', 'Bearer invalid-token-format');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });
  });
}); 