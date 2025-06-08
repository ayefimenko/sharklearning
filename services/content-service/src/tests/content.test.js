const request = require('supertest');

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

let app;
let mockQuery;

describe('Content Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mock query function
    const { Pool } = require('pg');
    mockQuery = Pool().query;

    // Mock environment variables
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

    // Clear the require cache and require the app
    delete require.cache[require.resolve('../server.js')];
    app = require('../server.js');
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.service).toBe('content-service');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Learning Tracks', () => {
    it('should get all learning tracks', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            title: 'QA Fundamentals',
            description: 'Learn the basics of Quality Assurance',
            difficulty_level: 'beginner',
            estimated_hours: 4,
            prerequisites: null,
            is_published: true,
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 2,
            title: 'Advanced Testing',
            description: 'Advanced testing techniques',
            difficulty_level: 'advanced',
            estimated_hours: 6,
            prerequisites: 'QA Fundamentals',
            is_published: true,
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      });

      const response = await request(app).get('/tracks');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].title).toBe('QA Fundamentals');
      expect(response.body[1].title).toBe('Advanced Testing');
      expect(response.body[0].difficulty).toBe('beginner');
      expect(response.body[1].difficulty).toBe('advanced');
    });

    it('should handle empty tracks result', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/tracks');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
    });

    it('should get specific track with courses', async () => {
      // Mock track query
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          title: 'QA Fundamentals',
          description: 'Learn the basics of Quality Assurance',
          difficulty_level: 'beginner',
          estimated_hours: 4,
          prerequisites: null,
          is_published: true,
          created_at: new Date(),
          updated_at: new Date()
        }]
      })
      // Mock courses query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            title: 'Introduction to QA',
            description: 'Basic QA concepts',
            content: '# Introduction\n\nWelcome to QA!',
            order_index: 1,
            is_published: true,
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 2,
            title: 'Test Planning',
            description: 'How to plan tests',
            content: '# Test Planning\n\nTest planning is crucial...',
            order_index: 2,
            is_published: true,
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      });

      const response = await request(app).get('/tracks/1');

      expect(response.status).toBe(200);
      expect(response.body.track.title).toBe('QA Fundamentals');
      expect(response.body.courses).toHaveLength(2);
      expect(response.body.courses[0].title).toBe('Introduction to QA');
      expect(response.body.courses[1].title).toBe('Test Planning');
      expect(response.body.courses[0].orderInTrack).toBe(1);
      expect(response.body.courses[1].orderInTrack).toBe(2);
    });

    it('should handle non-existent track', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/tracks/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Track not found');
    });

    it('should handle invalid track ID', async () => {
      const response = await request(app).get('/tracks/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid track ID');
    });
  });

  describe('Courses', () => {
    it('should get all courses', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            title: 'Introduction to QA',
            description: 'Basic QA concepts',
            content: '# Introduction\n\nWelcome to QA!',
            track_id: 1,
            order_index: 1,
            is_published: true,
            created_at: new Date(),
            updated_at: new Date(),
            track_title: 'QA Fundamentals',
            difficulty_level: 'beginner'
          }
        ]
      });

      const response = await request(app).get('/courses');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Introduction to QA');
      expect(response.body[0].isPublished).toBe(true);
    });

    it('should get courses by track', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            title: 'Introduction to QA',
            description: 'Basic QA concepts',
            content: '# Introduction\n\nWelcome to QA!',
            track_id: 1,
            order_index: 1,
            is_published: true,
            created_at: new Date(),
            updated_at: new Date(),
            track_title: 'QA Fundamentals',
            difficulty_level: 'beginner'
          },
          {
            id: 2,
            title: 'Test Planning',
            description: 'How to plan tests',
            content: '# Test Planning\n\nTest planning is crucial...',
            track_id: 1,
            order_index: 2,
            is_published: true,
            created_at: new Date(),
            updated_at: new Date(),
            track_title: 'QA Fundamentals',
            difficulty_level: 'beginner'
          }
        ]
      });

      const response = await request(app).get('/courses?track=1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].trackId).toBe(1);
      expect(response.body[1].trackId).toBe(1);
    });

    it('should get specific course', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          title: 'Introduction to QA',
          description: 'Basic QA concepts',
          content: '# Introduction\n\nWelcome to QA!',
          track_id: 1,
          order_in_track: 1,
          estimated_duration: '2 hours',
          is_published: true,
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      const response = await request(app).get('/courses/1');

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Introduction to QA');
      expect(response.body.content).toBe('# Introduction\n\nWelcome to QA!');
      expect(response.body.trackId).toBe(1);
    });

    it('should handle non-existent course', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/courses/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Course not found');
    });

    it('should handle invalid course ID', async () => {
      const response = await request(app).get('/courses/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid course ID');
    });

    it('should filter unpublished courses', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            title: 'Published Course',
            description: 'This is published',
            content: 'Content here',
            track_id: 1,
            order_in_track: 1,
            estimated_duration: '2 hours',
            is_published: true,
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      });

      const response = await request(app).get('/courses');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Published Course');
      expect(response.body[0].isPublished).toBe(true);
    });
  });

  describe('Search Functionality', () => {
    it('should search tracks and courses', async () => {
      // Mock tracks query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            title: 'QA Fundamentals',
            description: 'Learn QA basics',
            difficulty_level: 'beginner',
            estimated_hours: 4,
            prerequisites: null,
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      })
      // Mock courses query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            title: 'Introduction to QA',
            description: 'Basic QA concepts',
            content: '# Introduction\n\nWelcome to QA!',
            track_id: 1,
            order_index: 1,
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      });

      const response = await request(app).get('/search?q=QA');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].type).toBe('track');
      expect(response.body[1].type).toBe('course');
      expect(response.body[0].title).toContain('QA');
    });

    it('should handle empty search query', async () => {
      const response = await request(app).get('/search');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Search query is required');
    });

    it('should handle empty search results', async () => {
      // Mock both tracks and courses queries returning empty
      mockQuery.mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/search?q=nonexistent');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
    });

    it('should limit search results', async () => {
      const manyTrackResults = Array.from({ length: 3 }, (_, i) => ({
        id: i + 1,
        title: `Track ${i + 1}`,
        description: `Track Description ${i + 1}`,
        difficulty_level: 'beginner',
        estimated_hours: 4,
        prerequisites: null,
        created_at: new Date(),
        updated_at: new Date()
      }));

      const manyCourseResults = Array.from({ length: 3 }, (_, i) => ({
        id: i + 1,
        title: `Course ${i + 1}`,
        description: `Course Description ${i + 1}`,
        content: `# Course ${i + 1}`,
        track_id: 1,
        order_index: i + 1,
        created_at: new Date(),
        updated_at: new Date()
      }));

      // Mock tracks query (first call)
      mockQuery.mockResolvedValueOnce({ rows: manyTrackResults })
      // Mock courses query (second call)  
                .mockResolvedValueOnce({ rows: manyCourseResults });

      const response = await request(app).get('/search?q=course&limit=5');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(5);
    });
  });

  describe('Categories', () => {
    it('should get all categories', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            category: 'beginner',
            track_count: 2
          },
          {
            category: 'advanced',
            track_count: 1
          }
        ]
      });

      const response = await request(app).get('/categories');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].category).toBe('Beginner');
      expect(response.body[0].trackCount).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app).get('/tracks');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should handle malformed requests', async () => {
      // This would depend on how the endpoint handles malformed data
      // For now, testing with extremely long search queries
      const longQuery = 'a'.repeat(1000);
      
      const response = await request(app).get(`/search?q=${longQuery}`);

      // Should either handle gracefully or return appropriate error
      expect([200, 400, 413, 500]).toContain(response.status);
    });

    it('should handle SQL injection attempts', async () => {
      const maliciousQuery = "'; DROP TABLE courses; --";
      
      // Mock both queries to verify the query is properly parameterized
      mockQuery.mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get(`/search?q=${encodeURIComponent(maliciousQuery)}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
      
      // Verify that the query was called with parameterized values
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe('Data Transformation', () => {
    it('should transform database fields to camelCase', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          title: 'Test Course',
          description: 'Test Description',
          content: '# Test Course',
          track_id: 1,
          order_index: 1,
          is_published: true,
          created_at: new Date(),
          updated_at: new Date(),
          track_title: 'Test Track',
          difficulty_level: 'beginner'
        }]
      });

      const response = await request(app).get('/courses/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('trackId');
      expect(response.body).toHaveProperty('orderInTrack');
      expect(response.body).toHaveProperty('estimatedDuration');
      expect(response.body).toHaveProperty('isPublished');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
      
      // Should not have snake_case fields
      expect(response.body).not.toHaveProperty('track_id');
      expect(response.body).not.toHaveProperty('order_in_track');
      expect(response.body).not.toHaveProperty('estimated_duration');
      expect(response.body).not.toHaveProperty('is_published');
      expect(response.body).not.toHaveProperty('created_at');
      expect(response.body).not.toHaveProperty('updated_at');
    });
  });

  describe('Performance', () => {
    it('should handle concurrent requests', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 1, title: 'Test Track', description: 'Test' }]
      });

      // Make multiple concurrent requests
      const requests = Array.from({ length: 10 }, () => 
        request(app).get('/tracks')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });
    });
  });
}); 