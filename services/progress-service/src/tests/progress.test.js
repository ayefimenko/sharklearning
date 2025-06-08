const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock the dependencies
jest.mock('pg', () => {
  const mockQuery = jest.fn();
  const mockPool = {
    query: mockQuery
  };
  return {
    Pool: jest.fn(() => mockPool)
  };
});

jest.mock('jsonwebtoken');

let app;
let mockQuery;

describe('Progress Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mock query function
    const { Pool } = require('pg');
    mockQuery = Pool().query;

    // Mock environment variables
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

    // Clear the require cache and require the app
    delete require.cache[require.resolve('../server.js')];
    app = require('../server.js');
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    // Ensure all timers are cleared
    jest.useRealTimers();
  });

  describe('Authentication Middleware', () => {
    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/overview');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    it('should reject requests with invalid token', async () => {
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(new Error('Invalid token'), null);
      });

      const response = await request(app)
        .get('/overview')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should accept requests with valid token', async () => {
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { userId: 1, email: 'test@example.com' });
      });

      mockQuery.mockResolvedValueOnce({
        rows: [{ completed_courses: 0, total_enrolled: 0, average_progress: 0 }]
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total_points: 0 }] });

      const response = await request(app)
        .get('/overview')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.service).toBe('progress-service');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Progress Overview', () => {
    beforeEach(() => {
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { userId: 1, email: 'test@example.com' });
      });
    });

    it('should return user progress overview', async () => {
      // Mock database responses
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ completed_courses: 2, total_enrolled: 5, average_progress: 65.5 }]
        })
        .mockResolvedValueOnce({
          rows: [
            {
              course_id: 1,
              course_title: 'Introduction to QA',
              track_title: 'QA Fundamentals',
              progress_percentage: 100,
              is_completed: true,
              updated_at: new Date()
            }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            {
              title: 'First Steps',
              description: 'Complete your first course',
              badge_icon: '🎯',
              points: 10,
              earned_at: new Date()
            }
          ]
        })
        .mockResolvedValueOnce({
          rows: [{ total_points: 10 }]
        });

      const response = await request(app)
        .get('/overview')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.stats).toEqual({
        completedCourses: 2,
        totalEnrolled: 5,
        averageProgress: 66,
        totalPoints: 10
      });
      expect(response.body.recentProgress).toHaveLength(1);
      expect(response.body.achievements).toHaveLength(1);
    });

    it('should handle empty progress data', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ completed_courses: 0, total_enrolled: 0, average_progress: null }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total_points: 0 }] });

      const response = await request(app)
        .get('/overview')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.stats).toEqual({
        completedCourses: 0,
        totalEnrolled: 0,
        averageProgress: 0,
        totalPoints: 0
      });
      expect(response.body.recentProgress).toHaveLength(0);
      expect(response.body.achievements).toHaveLength(0);
    });
  });

  describe('Course Progress', () => {
    beforeEach(() => {
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { userId: 1, email: 'test@example.com' });
      });
    });

    it('should return existing course progress', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          course_id: 1,
          user_id: 1,
          progress_percentage: 75,
          is_completed: false,
          started_at: new Date(),
          updated_at: new Date()
        }]
      });

      const response = await request(app)
        .get('/courses/1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.courseId).toBe(1);
      expect(response.body.progressPercentage).toBe(75);
      expect(response.body.isCompleted).toBe(false);
    });

    it('should return default progress for new course', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/courses/1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.courseId).toBe(1);
      expect(response.body.progressPercentage).toBe(0);
      expect(response.body.isCompleted).toBe(false);
      expect(response.body.startedAt).toBeNull();
      expect(response.body.updatedAt).toBeNull();
    });

    it('should handle invalid course ID', async () => {
      const response = await request(app)
        .get('/courses/invalid')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid course ID');
    });
  });

  describe('Update Course Progress', () => {
    beforeEach(() => {
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { userId: 1, email: 'test@example.com' });
      });
    });

    it('should create new progress record', async () => {
      // Mock course existence check
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ track_id: 1 }] 
      })
      // Mock upsert progress
      .mockResolvedValueOnce({
        rows: [{
          course_id: 1,
          track_id: 1,
          user_id: 1,
          progress_percentage: 25,
          is_completed: false,
          started_at: new Date(),
          completed_at: null,
          updated_at: new Date()
        }]
      });

      const response = await request(app)
        .put('/courses/1')
        .set('Authorization', 'Bearer valid-token')
        .send({ progressPercentage: 25 });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Progress updated successfully');
      expect(response.body.progress.progressPercentage).toBe(25);
      expect(response.body.progress.isCompleted).toBe(false);
    });

    it('should update existing progress record', async () => {
      // Mock course existence check
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ track_id: 1 }] 
      })
      // Mock upsert progress
      .mockResolvedValueOnce({
        rows: [{
          course_id: 1,
          track_id: 1,
          user_id: 1,
          progress_percentage: 100,
          is_completed: true,
          started_at: new Date(),
          completed_at: new Date(),
          updated_at: new Date()
        }]
      });

      const response = await request(app)
        .put('/courses/1')
        .set('Authorization', 'Bearer valid-token')
        .send({ progressPercentage: 100 });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Progress updated successfully');
      expect(response.body.progress.progressPercentage).toBe(100);
      expect(response.body.progress.isCompleted).toBe(true);
    });

    it('should validate progress percentage', async () => {
      const response = await request(app)
        .put('/courses/1')
        .set('Authorization', 'Bearer valid-token')
        .send({ progressPercentage: 150 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .put('/courses/1')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('Leaderboard', () => {
    beforeEach(() => {
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { userId: 1, email: 'test@example.com' });
      });
    });

    it('should return leaderboard data', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            first_name: 'John',
            last_name: 'Doe',
            profile_image: null,
            total_points: 50,
            achievement_count: 3
          },
          {
            id: 2,
            first_name: 'Jane',
            last_name: 'Smith',
            profile_image: null,
            total_points: 30,
            achievement_count: 2
          }
        ]
      });

      const response = await request(app)
        .get('/leaderboard')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].rank).toBe(1);
      expect(response.body[0].totalPoints).toBe(50);
      expect(response.body[1].rank).toBe(2);
      expect(response.body[1].totalPoints).toBe(30);
    });

    it('should handle empty leaderboard', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/leaderboard')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, { userId: 1, email: 'test@example.com' });
      });
    });

    it('should handle database connection errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/overview')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .put('/courses/1')
        .set('Authorization', 'Bearer valid-token')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });
  });
}); 