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

let app;
let mockQuery;

describe('Quiz System Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mock query function
    const { Pool } = require('pg');
    mockQuery = Pool().query;

    // Mock environment variables
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET = 'test-secret';

    // Clear the require cache and require the app
    delete require.cache[require.resolve('../server.js')];
    app = require('../server.js');
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
  });

  describe('GET /courses/:courseId/quizzes', () => {
    it('should get all quizzes for a course', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            title: 'QA Fundamentals Quiz',
            description: 'Test your knowledge of basic QA principles',
            time_limit_minutes: 10,
            passing_score: 70,
            max_attempts: 3,
            is_published: true,
            lesson_id: 3,
            lesson_title: 'QA Knowledge Check',
            lesson_order: 3,
            created_at: new Date('2025-06-08T16:37:31.725Z'),
            updated_at: new Date('2025-06-08T16:37:31.725Z')
          },
          {
            id: 2,
            title: 'Advanced QA Quiz',
            description: 'Test advanced QA concepts',
            time_limit_minutes: 15,
            passing_score: 80,
            max_attempts: 2,
            is_published: true,
            lesson_id: 4,
            lesson_title: 'Advanced Concepts',
            lesson_order: 4,
            created_at: new Date('2025-06-08T16:37:31.725Z'),
            updated_at: new Date('2025-06-08T16:37:31.725Z')
          }
        ]
      });

      const response = await request(app).get('/courses/1/quizzes');

      expect(response.status).toBe(200);
      expect(response.body.quizzes).toHaveLength(2);
      expect(response.body.quizzes[0]).toMatchObject({
        id: 1,
        title: 'QA Fundamentals Quiz',
        description: 'Test your knowledge of basic QA principles',
        timeLimitMinutes: 10,
        passingScore: 70,
        maxAttempts: 3,
        isPublished: true,
        lessonId: 3,
        lessonTitle: 'QA Knowledge Check',
        lessonOrder: 3
      });
    });

    it('should handle invalid course ID', async () => {
      const response = await request(app).get('/courses/invalid/quizzes');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid course ID');
    });

    it('should return empty array for course with no quizzes', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/courses/1/quizzes');

      expect(response.status).toBe(200);
      expect(response.body.quizzes).toHaveLength(0);
    });

    it('should only return published quizzes', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            title: 'Published Quiz',
            description: 'This quiz is published',
            time_limit_minutes: 10,
            passing_score: 70,
            max_attempts: 3,
            is_published: true,
            lesson_id: 3,
            lesson_title: 'Test Lesson',
            lesson_order: 3,
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      });

      const response = await request(app).get('/courses/1/quizzes');

      expect(response.status).toBe(200);
      expect(response.body.quizzes).toHaveLength(1);
      expect(response.body.quizzes[0].isPublished).toBe(true);
    });
  });

  describe('GET /quizzes/:quizId', () => {
    it('should get quiz details with questions (without correct answers)', async () => {
      // Mock quiz details query
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          title: 'QA Fundamentals Quiz',
          description: 'Test your knowledge of basic QA principles',
          time_limit_minutes: 10,
          passing_score: 70,
          max_attempts: 3,
          lesson_id: 3,
          lesson_title: 'QA Knowledge Check',
          course_id: 1,
          created_at: new Date('2025-06-08T16:37:31.725Z'),
          updated_at: new Date('2025-06-08T16:37:31.725Z')
        }]
      })
      // Mock questions query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            question_text: 'What is the primary goal of software testing?',
            question_type: 'multiple_choice',
            answer_options: ['To find defects and ensure quality', 'To prove the software works perfectly', 'To delay the release', 'To increase development time'],
            points: 2,
            order_index: 1
          },
          {
            id: 2,
            question_text: 'True or False: Testing can prove software is bug-free',
            question_type: 'true_false',
            answer_options: ['true', 'false'],
            points: 1,
            order_index: 2
          }
        ]
      });

      const response = await request(app).get('/quizzes/1');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 1,
        title: 'QA Fundamentals Quiz',
        description: 'Test your knowledge of basic QA principles',
        timeLimitMinutes: 10,
        passingScore: 70,
        maxAttempts: 3,
        lessonId: 3,
        lessonTitle: 'QA Knowledge Check',
        courseId: 1,
        totalQuestions: 2,
        totalPoints: 3
      });
      
      expect(response.body.questions).toHaveLength(2);
      expect(response.body.questions[0]).toMatchObject({
        id: 1,
        questionText: 'What is the primary goal of software testing?',
        questionType: 'multiple_choice',
        answerOptions: ['To find defects and ensure quality', 'To prove the software works perfectly', 'To delay the release', 'To increase development time'],
        points: 2,
        orderIndex: 1
      });
      
      // Ensure correct answers are not included
      expect(response.body.questions[0]).not.toHaveProperty('correctAnswer');
    });

    it('should handle invalid quiz ID', async () => {
      const response = await request(app).get('/quizzes/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid quiz ID');
    });

    it('should handle non-existent quiz', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/quizzes/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Quiz not found');
    });

    it('should handle quiz with no questions', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          title: 'Empty Quiz',
          description: 'A quiz with no questions',
          time_limit_minutes: 10,
          passing_score: 70,
          max_attempts: 3,
          lesson_id: 3,
          lesson_title: 'Test Lesson',
          course_id: 1,
          created_at: new Date(),
          updated_at: new Date()
        }]
      })
      .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/quizzes/1');

      expect(response.status).toBe(200);
      expect(response.body.questions).toHaveLength(0);
      expect(response.body.totalQuestions).toBe(0);
      expect(response.body.totalPoints).toBe(0);
    });
  });

  describe('POST /quizzes/:quizId/submit', () => {
    const validToken = jwt.sign({ id: 1, email: 'test@example.com', role: 'student' }, 'test-secret');

    it('should submit quiz answers and calculate score correctly', async () => {
      // Mock quiz details query
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          title: 'QA Fundamentals Quiz',
          passing_score: 70,
          max_attempts: 3
        }]
      })
      // Mock questions with correct answers query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            question_text: 'What is the primary goal of software testing?',
            question_type: 'multiple_choice',
            correct_answer: 'To find defects and ensure quality',
            points: 2
          },
          {
            id: 2,
            question_text: 'True or False: Testing can prove software is bug-free',
            question_type: 'true_false',
            correct_answer: 'false',
            points: 1
          }
        ]
      })
      // Mock previous attempts query
      .mockResolvedValueOnce({ rows: [] })
      // Mock insert quiz attempt
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          user_id: 1,
          quiz_id: 1,
          score: 100,
          total_points: 3,
          passed: true,
          submitted_at: new Date()
        }]
      });

      const response = await request(app)
        .post('/quizzes/1/submit')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          answers: [
            { questionId: 1, selectedAnswer: 'To find defects and ensure quality' },
            { questionId: 2, selectedAnswer: 'false' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        score: 100,
        totalPoints: 3,
        earnedPoints: 3,
        passed: true,
        passingScore: 70
      });
      
      expect(response.body.results).toHaveLength(2);
      expect(response.body.results[0]).toMatchObject({
        questionId: 1,
        isCorrect: true,
        earnedPoints: 2
      });
    });

    it('should calculate partial scores correctly', async () => {
      // Mock quiz details
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          title: 'QA Fundamentals Quiz',
          passing_score: 70,
          max_attempts: 3
        }]
      })
      // Mock questions with correct answers
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            question_text: 'Question 1',
            question_type: 'multiple_choice',
            correct_answer: 'Correct Answer',
            points: 2
          },
          {
            id: 2,
            question_text: 'Question 2',
            question_type: 'multiple_choice',
            correct_answer: 'Another Correct Answer',
            points: 3
          }
        ]
      })
      // Mock previous attempts
      .mockResolvedValueOnce({ rows: [] })
      // Mock insert
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          user_id: 1,
          quiz_id: 1,
          score: 40,
          total_points: 5,
          passed: false,
          submitted_at: new Date()
        }]
      });

      const response = await request(app)
        .post('/quizzes/1/submit')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          answers: [
            { questionId: 1, selectedAnswer: 'Correct Answer' },
            { questionId: 2, selectedAnswer: 'Wrong Answer' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        score: 40,
        totalPoints: 5,
        earnedPoints: 2,
        passed: false
      });
    });

    it('should reject submission without authentication', async () => {
      const response = await request(app)
        .post('/quizzes/1/submit')
        .send({
          answers: [
            { questionId: 1, selectedAnswer: 'Some answer' }
          ]
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    it('should reject submission with invalid token', async () => {
      const response = await request(app)
        .post('/quizzes/1/submit')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          answers: [
            { questionId: 1, selectedAnswer: 'Some answer' }
          ]
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should handle invalid quiz ID', async () => {
      const response = await request(app)
        .post('/quizzes/invalid/submit')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          answers: [
            { questionId: 1, selectedAnswer: 'Some answer' }
          ]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid quiz ID');
    });

    it('should handle non-existent quiz', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/quizzes/999/submit')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          answers: [
            { questionId: 1, selectedAnswer: 'Some answer' }
          ]
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Quiz not found');
    });

    it('should reject submission when max attempts exceeded', async () => {
      // Mock quiz details
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          title: 'QA Fundamentals Quiz',
          passing_score: 70,
          max_attempts: 2
        }]
      })
      // Mock previous attempts (already at max)
      .mockResolvedValueOnce({
        rows: [
          { id: 1, attempt_number: 1 },
          { id: 2, attempt_number: 2 }
        ]
      });

      const response = await request(app)
        .post('/quizzes/1/submit')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          answers: [
            { questionId: 1, selectedAnswer: 'Some answer' }
          ]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Maximum attempts exceeded');
    });

    it('should validate answer format', async () => {
      const response = await request(app)
        .post('/quizzes/1/submit')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          answers: [
            { questionId: 'invalid', selectedAnswer: 'Some answer' }
          ]
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should require answers array', async () => {
      const response = await request(app)
        .post('/quizzes/1/submit')
        .set('Authorization', `Bearer ${validToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('Database Error Handling', () => {
    it('should handle database errors gracefully in quiz listing', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app).get('/courses/1/quizzes');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should handle database errors gracefully in quiz details', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app).get('/quizzes/1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should handle database errors gracefully in quiz submission', async () => {
      const validToken = jwt.sign({ id: 1, email: 'test@example.com', role: 'student' }, 'test-secret');
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .post('/quizzes/1/submit')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          answers: [
            { questionId: 1, selectedAnswer: 'Some answer' }
          ]
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('Quiz Data Validation', () => {
    it('should handle missing question data gracefully', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          title: 'Test Quiz',
          description: 'Test description',
          time_limit_minutes: 10,
          passing_score: 70,
          max_attempts: 3,
          lesson_id: 3,
          lesson_title: 'Test Lesson',
          course_id: 1,
          created_at: new Date(),
          updated_at: new Date()
        }]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            question_text: null, // Missing question text
            question_type: 'multiple_choice',
            answer_options: ['Option 1', 'Option 2'],
            points: 2,
            order_index: 1
          }
        ]
      });

      const response = await request(app).get('/quizzes/1');

      expect(response.status).toBe(200);
      expect(response.body.questions).toHaveLength(1);
      expect(response.body.questions[0].questionText).toBeNull();
    });

    it('should handle malformed answer options', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          title: 'Test Quiz',
          description: 'Test description',
          time_limit_minutes: 10,
          passing_score: 70,
          max_attempts: 3,
          lesson_id: 3,
          lesson_title: 'Test Lesson',
          course_id: 1,
          created_at: new Date(),
          updated_at: new Date()
        }]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            question_text: 'Test question',
            question_type: 'multiple_choice',
            answer_options: null, // Malformed options
            points: 2,
            order_index: 1
          }
        ]
      });

      const response = await request(app).get('/quizzes/1');

      expect(response.status).toBe(200);
      expect(response.body.questions[0].answerOptions).toBeNull();
    });
  });
});