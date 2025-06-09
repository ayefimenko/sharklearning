const express = require('express');
const { Pool } = require('pg');
const { body, validationResult } = require('express-validator');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'content-service',
    timestamp: new Date().toISOString()
  });
});

// Get all learning tracks
app.get('/tracks', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, description, difficulty_level, estimated_hours, is_published, created_at, updated_at FROM learning_tracks WHERE is_published = true ORDER BY created_at DESC'
    );

    const tracks = result.rows.map(track => ({
      id: track.id,
      title: track.title,
      description: track.description,
      difficultyLevel: track.difficulty_level,
      estimatedHours: track.estimated_hours,
      isPublished: track.is_published,
      createdAt: track.created_at,
      updatedAt: track.updated_at
    }));

    res.json({ tracks });
  } catch (error) {
    console.error('Tracks fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single learning track with courses
app.get('/tracks/:id', async (req, res) => {
  try {
    const trackId = parseInt(req.params.id);
    
    if (isNaN(trackId)) {
      return res.status(400).json({ error: 'Invalid track ID' });
    }

    // Get track details
    const trackResult = await pool.query(
      'SELECT id, title, description, difficulty_level, estimated_hours, is_published, created_at, updated_at FROM learning_tracks WHERE id = $1',
      [trackId]
    );

    if (trackResult.rows.length === 0) {
      return res.status(404).json({ error: 'Track not found' });
    }

    // Get courses for this track
    const coursesResult = await pool.query(
      'SELECT id, title, description, content, order_index, is_published, created_at, updated_at FROM courses WHERE track_id = $1 AND is_published = true ORDER BY order_index',
      [trackId]
    );

    const track = trackResult.rows[0];
    const courses = coursesResult.rows.map(course => ({
      id: course.id,
      title: course.title,
      description: course.description,
      content: course.content,
      orderInTrack: course.order_index,
      estimatedDuration: '2 hours',
      isPublished: course.is_published,
      createdAt: course.created_at,
      updatedAt: course.updated_at
    }));

    res.json({
      track: {
        id: track.id,
        title: track.title,
        description: track.description,
        difficultyLevel: track.difficulty_level,
        estimatedHours: track.estimated_hours,
        isPublished: track.is_published,
        createdAt: track.created_at,
        updatedAt: track.updated_at
      },
      courses
    });
  } catch (error) {
    console.error('Track fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all courses
app.get('/courses', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.title, c.description, c.content, c.track_id, c.order_index, c.is_published, c.created_at, c.updated_at,
             t.title as track_title, t.difficulty_level
      FROM courses c
      JOIN learning_tracks t ON c.track_id = t.id
      WHERE c.is_published = true AND t.is_published = true
      ORDER BY t.id, c.order_index
    `);

    const courses = result.rows.map(course => ({
      id: course.id,
      title: course.title,
      description: course.description,
      content: course.content,
      trackId: course.track_id,
      orderInTrack: course.order_index,
      estimatedDuration: '2 hours',
      isPublished: course.is_published,
      createdAt: course.created_at,
      updatedAt: course.updated_at
    }));

    res.json(courses);
  } catch (error) {
    console.error('Courses fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single course with lessons
app.get('/courses/:id', async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);
    
    if (isNaN(courseId)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }

    const result = await pool.query(`
      SELECT c.id, c.title, c.description, c.content, c.track_id, c.order_index, c.is_published, c.created_at, c.updated_at,
             t.id as track_id, t.title as track_title, t.difficulty_level
      FROM courses c
      JOIN learning_tracks t ON c.track_id = t.id
      WHERE c.id = $1
    `, [courseId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Get lessons for this course
    const lessonsResult = await pool.query(`
      SELECT id, title, content, order_index, lesson_type, duration_minutes, is_published, created_at, updated_at
      FROM lessons
      WHERE course_id = $1 AND is_published = true
      ORDER BY order_index
    `, [courseId]);

    const course = result.rows[0];
    const lessons = lessonsResult.rows.map(lesson => ({
      id: lesson.id,
      title: lesson.title,
      content: lesson.content,
      orderIndex: lesson.order_index,
      lessonType: lesson.lesson_type,
      durationMinutes: lesson.duration_minutes,
      isPublished: lesson.is_published,
      createdAt: lesson.created_at,
      updatedAt: lesson.updated_at
    }));

    res.json({
      id: course.id,
      title: course.title,
      description: course.description,
      content: course.content,
      trackId: course.track_id,
      orderInTrack: course.order_index,
      estimatedDuration: '2 hours',
      isPublished: course.is_published,
      createdAt: course.created_at,
      updatedAt: course.updated_at,
      lessons: lessons
    });
  } catch (error) {
    console.error('Course fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get lessons for a specific course
app.get('/courses/:id/lessons', async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);
    
    if (isNaN(courseId)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }

    const result = await pool.query(`
      SELECT id, title, content, order_index, lesson_type, duration_minutes, is_published, created_at, updated_at
      FROM lessons
      WHERE course_id = $1 AND is_published = true
      ORDER BY order_index
    `, [courseId]);

    const lessons = result.rows.map(lesson => ({
      id: lesson.id,
      title: lesson.title,
      content: lesson.content,
      orderIndex: lesson.order_index,
      lessonType: lesson.lesson_type,
      durationMinutes: lesson.duration_minutes,
      isPublished: lesson.is_published,
      createdAt: lesson.created_at,
      updatedAt: lesson.updated_at
    }));

    res.json({ lessons });
  } catch (error) {
    console.error('Lessons fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single lesson
app.get('/lessons/:id', async (req, res) => {
  try {
    const lessonId = parseInt(req.params.id);
    
    if (isNaN(lessonId)) {
      return res.status(400).json({ error: 'Invalid lesson ID' });
    }

    const result = await pool.query(`
      SELECT l.id, l.title, l.content, l.order_index, l.lesson_type, l.duration_minutes, l.is_published, l.created_at, l.updated_at,
             c.id as course_id, c.title as course_title, c.track_id,
             t.title as track_title
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      JOIN learning_tracks t ON c.track_id = t.id
      WHERE l.id = $1
    `, [lessonId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const lesson = result.rows[0];
    
    // Get quiz if this is a quiz lesson
    let quiz = null;
    if (lesson.lesson_type === 'quiz') {
      const quizResult = await pool.query(`
        SELECT q.id, q.title, q.description, q.time_limit_minutes, q.passing_score, q.max_attempts
        FROM quizzes q
        WHERE q.lesson_id = $1 AND q.is_published = true
      `, [lessonId]);

      if (quizResult.rows.length > 0) {
        const quizData = quizResult.rows[0];
        
        // Get quiz questions
        const questionsResult = await pool.query(`
          SELECT id, question_text, question_type, answer_options, points, order_index
          FROM quiz_questions
          WHERE quiz_id = $1
          ORDER BY order_index
        `, [quizData.id]);

        quiz = {
          id: quizData.id,
          title: quizData.title,
          description: quizData.description,
          timeLimitMinutes: quizData.time_limit_minutes,
          passingScore: quizData.passing_score,
          maxAttempts: quizData.max_attempts,
          questions: questionsResult.rows.map(q => ({
            id: q.id,
            questionText: q.question_text,
            questionType: q.question_type,
            answerOptions: q.answer_options,
            points: q.points,
            orderIndex: q.order_index
          }))
        };
      }
    }

    res.json({
      id: lesson.id,
      title: lesson.title,
      content: lesson.content,
      orderIndex: lesson.order_index,
      lessonType: lesson.lesson_type,
      durationMinutes: lesson.duration_minutes,
      isPublished: lesson.is_published,
      createdAt: lesson.created_at,
      updatedAt: lesson.updated_at,
      courseId: lesson.course_id,
      courseTitle: lesson.course_title,
      trackId: lesson.track_id,
      trackTitle: lesson.track_title,
      quiz: quiz
    });
  } catch (error) {
    console.error('Lesson fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create learning track (admin only)
app.post('/tracks', authenticateToken, [
  body('title').trim().isLength({ min: 1, max: 255 }),
  body('description').optional().trim(),
  body('difficultyLevel').isIn(['beginner', 'intermediate', 'advanced']),
  body('estimatedHours').isInt({ min: 1 })
], async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, difficultyLevel, estimatedHours } = req.body;

    const result = await pool.query(
      'INSERT INTO learning_tracks (title, description, difficulty_level, estimated_hours) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, description, difficultyLevel, estimatedHours]
    );

    const track = result.rows[0];
    res.status(201).json({
      message: 'Learning track created successfully',
      track: {
        id: track.id,
        title: track.title,
        description: track.description,
        difficultyLevel: track.difficulty_level,
        estimatedHours: track.estimated_hours,
        isPublished: track.is_published,
        createdAt: track.created_at
      }
    });
  } catch (error) {
    console.error('Track creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search tracks and courses
app.get('/search', async (req, res) => {
  try {
    const { q: query, limit = 50 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const searchLimit = parseInt(limit);
    
    // Search tracks
    const tracksResult = await pool.query(`
      SELECT id, title, description, difficulty_level, estimated_hours, prerequisites, created_at, updated_at
      FROM learning_tracks 
      WHERE is_published = true 
      AND (title ILIKE $1 OR description ILIKE $1)
      ORDER BY created_at DESC
      LIMIT $2
    `, [`%${query}%`, Math.floor(searchLimit / 2)]);
    
    // Search courses
    const coursesResult = await pool.query(`
      SELECT c.id, c.title, c.description, c.content, c.track_id, c.order_index, c.created_at, c.updated_at
      FROM courses c
      JOIN learning_tracks t ON c.track_id = t.id
      WHERE c.is_published = true AND t.is_published = true
      AND (c.title ILIKE $1 OR c.description ILIKE $1 OR c.content ILIKE $1)
      ORDER BY c.created_at DESC
      LIMIT $2
    `, [`%${query}%`, Math.floor(searchLimit / 2)]);
    
    const results = [
      ...tracksResult.rows.map(track => ({
        type: 'track',
        id: track.id,
        title: track.title,
        description: track.description,
        difficulty: track.difficulty_level,
        estimatedDuration: track.estimated_hours + ' hours',
        prerequisites: track.prerequisites,
        createdAt: track.created_at,
        updatedAt: track.updated_at
      })),
      ...coursesResult.rows.map(course => ({
        type: 'course',
        id: course.id,
        title: course.title,
        description: course.description,
        content: course.content,
        trackId: course.track_id,
        orderInTrack: course.order_index,
        estimatedDuration: '2 hours',
        createdAt: course.created_at,
        updatedAt: course.updated_at
      }))
    ].slice(0, searchLimit);
    
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get categories (aggregated by difficulty level)
app.get('/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT difficulty_level as category, COUNT(*) as track_count
      FROM learning_tracks 
      WHERE is_published = true
      GROUP BY difficulty_level
      ORDER BY 
        CASE difficulty_level 
          WHEN 'beginner' THEN 1
          WHEN 'intermediate' THEN 2
          WHEN 'advanced' THEN 3
          ELSE 4
        END
    `);
    
    const categories = result.rows.map(row => ({
      category: row.category.charAt(0).toUpperCase() + row.category.slice(1),
      trackCount: parseInt(row.track_count)
    }));
    
    res.json(categories);
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================
// QUIZ ENDPOINTS
// ========================

// Get quizzes for a course/lesson
app.get('/courses/:courseId/quizzes', async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    
    if (isNaN(courseId)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }

    // Get quizzes for lessons in this course
    const result = await pool.query(`
      SELECT q.id, q.title, q.description, q.time_limit_minutes, q.passing_score, 
             q.max_attempts, q.is_published, q.created_at, q.updated_at,
             l.id as lesson_id, l.title as lesson_title, l.order_index as lesson_order
      FROM quizzes q
      JOIN lessons l ON q.lesson_id = l.id
      WHERE l.course_id = $1 AND q.is_published = true
      ORDER BY l.order_index, q.created_at
    `, [courseId]);

    const quizzes = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      timeLimitMinutes: row.time_limit_minutes,
      passingScore: row.passing_score,
      maxAttempts: row.max_attempts,
      isPublished: row.is_published,
      lessonId: row.lesson_id,
      lessonTitle: row.lesson_title,
      lessonOrder: row.lesson_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({ quizzes });
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific quiz with questions
app.get('/quizzes/:quizId', async (req, res) => {
  try {
    const quizId = parseInt(req.params.quizId);
    
    if (isNaN(quizId)) {
      return res.status(400).json({ error: 'Invalid quiz ID' });
    }

    // Get quiz details
    const quizResult = await pool.query(`
      SELECT q.id, q.title, q.description, q.time_limit_minutes, q.passing_score, 
             q.max_attempts, q.is_published, q.created_at, q.updated_at,
             l.id as lesson_id, l.title as lesson_title, l.course_id
      FROM quizzes q
      JOIN lessons l ON q.lesson_id = l.id
      WHERE q.id = $1 AND q.is_published = true
    `, [quizId]);

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const quiz = quizResult.rows[0];

    // Get quiz questions
    const questionsResult = await pool.query(`
      SELECT id, question_text, question_type, answer_options, points, order_index
      FROM quiz_questions
      WHERE quiz_id = $1
      ORDER BY order_index, id
    `, [quizId]);

    const questions = questionsResult.rows.map(row => ({
      id: row.id,
      questionText: row.question_text,
      questionType: row.question_type,
      answerOptions: row.answer_options,
      points: row.points,
      orderIndex: row.order_index
      // Note: correct_answer is deliberately excluded for security
    }));

    const quizData = {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      timeLimitMinutes: quiz.time_limit_minutes,
      passingScore: quiz.passing_score,
      maxAttempts: quiz.max_attempts,
      lessonId: quiz.lesson_id,
      lessonTitle: quiz.lesson_title,
      courseId: quiz.course_id,
      questions,
      totalQuestions: questions.length,
      totalPoints: questions.reduce((sum, q) => sum + q.points, 0),
      createdAt: quiz.created_at,
      updatedAt: quiz.updated_at
    };

    res.json(quizData);
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit quiz answers (requires authentication)
app.post('/quizzes/:quizId/submit', authenticateToken, [
  body('answers').isArray(),
  body('answers.*.questionId').isInt(),
  body('answers.*.answer').exists(),
  body('timeSpent').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const quizId = parseInt(req.params.quizId);
    const { answers, timeSpent = 0 } = req.body;
    const userId = req.user.userId;

    if (isNaN(quizId)) {
      return res.status(400).json({ error: 'Invalid quiz ID' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Get quiz details and questions with correct answers
    const quizResult = await pool.query(`
      SELECT q.id, q.title, q.passing_score, q.max_attempts,
             l.course_id
      FROM quizzes q
      JOIN lessons l ON q.lesson_id = l.id
      WHERE q.id = $1 AND q.is_published = true
    `, [quizId]);

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const quiz = quizResult.rows[0];

    // Get all questions with correct answers
    const questionsResult = await pool.query(`
      SELECT id, question_text, question_type, correct_answer, points
      FROM quiz_questions
      WHERE quiz_id = $1
      ORDER BY order_index, id
    `, [quizId]);

    const questions = questionsResult.rows;
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

    // Calculate score
    let correctAnswers = 0;
    let earnedPoints = 0;
    const results = [];

    for (const question of questions) {
      const userAnswer = answers.find(a => a.questionId === question.id);
      const isCorrect = userAnswer && String(userAnswer.answer).toLowerCase().trim() === 
                       String(question.correct_answer).toLowerCase().trim();
      
      if (isCorrect) {
        correctAnswers++;
        earnedPoints += question.points;
      }

      results.push({
        questionId: question.id,
        questionText: question.question_text,
        correctAnswer: question.correct_answer,
        userAnswer: userAnswer ? userAnswer.answer : null,
        isCorrect,
        points: question.points,
        earnedPoints: isCorrect ? question.points : 0
      });
    }

    const scorePercentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = scorePercentage >= quiz.passing_score;

    // Save quiz attempt to progress service (we'll implement this table later)
    // For now, just return the results

    res.json({
      quizId,
      quizTitle: quiz.title,
      totalQuestions: questions.length,
      correctAnswers,
      totalPoints,
      earnedPoints,
      scorePercentage,
      passingScore: quiz.passing_score,
      passed,
      timeSpent,
      results,
      submittedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create course (admin only)
app.post('/courses', authenticateToken, [
  body('trackId').isInt(),
  body('title').trim().isLength({ min: 1, max: 255 }),
  body('description').optional().trim(),
  body('content').trim().isLength({ min: 1 }),
  body('orderIndex').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { trackId, title, description, content, orderIndex = 0 } = req.body;

    // Verify track exists
    const trackCheck = await pool.query('SELECT id FROM learning_tracks WHERE id = $1', [trackId]);
    if (trackCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Learning track not found' });
    }

    const result = await pool.query(
      'INSERT INTO courses (track_id, title, description, content, order_index) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [trackId, title, description, content, orderIndex]
    );

    const course = result.rows[0];
    res.status(201).json({
      message: 'Course created successfully',
      course: {
        id: course.id,
        trackId: course.track_id,
        title: course.title,
        description: course.description,
        content: course.content,
        orderIndex: course.order_index,
        isPublished: course.is_published,
        createdAt: course.created_at
      }
    });
  } catch (error) {
    console.error('Course creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================
// CONTENT MANAGEMENT & AUTHORING ENDPOINTS
// ========================

// Update existing course (admin only)
app.put('/courses/:id', authenticateToken, [
  body('title').optional().trim().isLength({ min: 1, max: 255 }),
  body('description').optional().trim(),
  body('content').optional().trim().isLength({ min: 1 }),
  body('orderIndex').optional().isInt({ min: 0 }),
  body('isPublished').optional().isBoolean()
], async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const courseId = parseInt(req.params.id);
    if (isNaN(courseId)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }

    const { title, description, content, orderIndex, isPublished } = req.body;
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (content !== undefined) {
      updates.push(`content = $${paramCount++}`);
      values.push(content);
    }
    if (orderIndex !== undefined) {
      updates.push(`order_index = $${paramCount++}`);
      values.push(orderIndex);
    }
    if (isPublished !== undefined) {
      updates.push(`is_published = $${paramCount++}`);
      values.push(isPublished);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(courseId);

    const query = `UPDATE courses SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = result.rows[0];
    res.json({
      message: 'Course updated successfully',
      course: {
        id: course.id,
        trackId: course.track_id,
        title: course.title,
        description: course.description,
        content: course.content,
        orderIndex: course.order_index,
        isPublished: course.is_published,
        createdAt: course.created_at,
        updatedAt: course.updated_at
      }
    });
  } catch (error) {
    console.error('Course update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update learning track (admin only)
app.put('/tracks/:id', authenticateToken, [
  body('title').optional().trim().isLength({ min: 1, max: 255 }),
  body('description').optional().trim(),
  body('difficultyLevel').optional().isIn(['beginner', 'intermediate', 'advanced']),
  body('estimatedHours').optional().isInt({ min: 1 }),
  body('isPublished').optional().isBoolean()
], async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const trackId = parseInt(req.params.id);
    if (isNaN(trackId)) {
      return res.status(400).json({ error: 'Invalid track ID' });
    }

    const { title, description, difficultyLevel, estimatedHours, isPublished } = req.body;
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (difficultyLevel !== undefined) {
      updates.push(`difficulty_level = $${paramCount++}`);
      values.push(difficultyLevel);
    }
    if (estimatedHours !== undefined) {
      updates.push(`estimated_hours = $${paramCount++}`);
      values.push(estimatedHours);
    }
    if (isPublished !== undefined) {
      updates.push(`is_published = $${paramCount++}`);
      values.push(isPublished);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(trackId);

    const query = `UPDATE learning_tracks SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Learning track not found' });
    }

    const track = result.rows[0];
    res.json({
      message: 'Learning track updated successfully',
      track: {
        id: track.id,
        title: track.title,
        description: track.description,
        difficultyLevel: track.difficulty_level,
        estimatedHours: track.estimated_hours,
        isPublished: track.is_published,
        createdAt: track.created_at,
        updatedAt: track.updated_at
      }
    });
  } catch (error) {
    console.error('Track update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete course (admin only)
app.delete('/courses/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const courseId = parseInt(req.params.id);
    if (isNaN(courseId)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }

    const result = await pool.query('DELETE FROM courses WHERE id = $1 RETURNING id, title', [courseId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({
      message: 'Course deleted successfully',
      deletedCourse: {
        id: result.rows[0].id,
        title: result.rows[0].title
      }
    });
  } catch (error) {
    console.error('Course deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete learning track (admin only)
app.delete('/tracks/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const trackId = parseInt(req.params.id);
    if (isNaN(trackId)) {
      return res.status(400).json({ error: 'Invalid track ID' });
    }

    // Check if track has courses
    const coursesCheck = await pool.query('SELECT COUNT(*) as count FROM courses WHERE track_id = $1', [trackId]);
    const courseCount = parseInt(coursesCheck.rows[0].count);

    if (courseCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete track with existing courses',
        courseCount
      });
    }

    const result = await pool.query('DELETE FROM learning_tracks WHERE id = $1 RETURNING id, title', [trackId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Learning track not found' });
    }

    res.json({
      message: 'Learning track deleted successfully',
      deletedTrack: {
        id: result.rows[0].id,
        title: result.rows[0].title
      }
    });
  } catch (error) {
    console.error('Track deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all content for admin management
app.get('/admin/content', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { page = 1, limit = 20, status = 'all', type = 'all' } = req.query;
    const offset = (page - 1) * limit;

    // Build dynamic query based on filters
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 1;

    if (status !== 'all') {
      const isPublished = status === 'published';
      whereConditions.push(`is_published = $${paramCount++}`);
      queryParams.push(isPublished);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    let contentData = {};

    // Get tracks if requested
    if (type === 'all' || type === 'tracks') {
      const tracksQuery = `
        SELECT id, title, description, difficulty_level, estimated_hours, is_published, created_at, updated_at
        FROM learning_tracks ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramCount++} OFFSET $${paramCount++}
      `;
      queryParams.push(limit, offset);
      
      const tracksResult = await pool.query(tracksQuery, queryParams);
      contentData.tracks = tracksResult.rows.map(track => ({
        id: track.id,
        title: track.title,
        description: track.description,
        difficultyLevel: track.difficulty_level,
        estimatedHours: track.estimated_hours,
        isPublished: track.is_published,
        createdAt: track.created_at,
        updatedAt: track.updated_at
      }));
      
      // Reset params for courses query
      queryParams = queryParams.slice(0, whereConditions.length);
      paramCount = whereConditions.length + 1;
    }

    // Get courses if requested
    if (type === 'all' || type === 'courses') {
      const coursesQuery = `
        SELECT c.id, c.title, c.description, c.track_id, c.order_index, c.is_published, c.created_at, c.updated_at,
               t.title as track_title
        FROM courses c
        JOIN learning_tracks t ON c.track_id = t.id
        ${whereClause.replace(/is_published/g, 'c.is_published')}
        ORDER BY c.created_at DESC
        LIMIT $${paramCount++} OFFSET $${paramCount++}
      `;
      queryParams.push(limit, offset);
      
      const coursesResult = await pool.query(coursesQuery, queryParams);
      contentData.courses = coursesResult.rows.map(course => ({
        id: course.id,
        title: course.title,
        description: course.description,
        trackId: course.track_id,
        trackTitle: course.track_title,
        orderIndex: course.order_index,
        isPublished: course.is_published,
        createdAt: course.created_at,
        updatedAt: course.updated_at
      }));
    }

    res.json({
      content: contentData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: (contentData.tracks?.length || contentData.courses?.length) === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Admin content fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk content operations (admin only)
app.post('/admin/content/bulk', authenticateToken, [
  body('operation').isIn(['publish', 'unpublish', 'delete']),
  body('type').isIn(['tracks', 'courses']),
  body('ids').isArray({ min: 1 }),
  body('ids.*').isInt()
], async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { operation, type, ids } = req.body;
    const table = type === 'tracks' ? 'learning_tracks' : 'courses';
    
    let query;
    let values = [ids];

    switch (operation) {
      case 'publish':
        query = `UPDATE ${table} SET is_published = true, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1) RETURNING id, title`;
        break;
      case 'unpublish':
        query = `UPDATE ${table} SET is_published = false, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1) RETURNING id, title`;
        break;
      case 'delete':
        if (type === 'tracks') {
          // Check for courses in tracks before deletion
          const coursesCheck = await pool.query('SELECT track_id, COUNT(*) as count FROM courses WHERE track_id = ANY($1) GROUP BY track_id', [ids]);
          if (coursesCheck.rows.length > 0) {
            return res.status(400).json({ 
              error: 'Cannot delete tracks with existing courses',
              tracksWithCourses: coursesCheck.rows
            });
          }
        }
        query = `DELETE FROM ${table} WHERE id = ANY($1) RETURNING id, title`;
        break;
    }

    const result = await pool.query(query, values);

    res.json({
      message: `Bulk ${operation} completed successfully`,
      affected: result.rows.length,
      items: result.rows
    });
  } catch (error) {
    console.error('Bulk operation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Content templates endpoint (admin only)
app.get('/admin/templates', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Predefined content templates for QA courses
    const templates = [
      {
        id: 'qa-fundamentals',
        name: 'QA Fundamentals Course',
        description: 'Template for basic QA concepts course',
        content: `# Course Introduction

Welcome to this comprehensive course on Quality Assurance fundamentals.

## Learning Objectives
- Understand the role of QA in software development
- Learn basic testing methodologies
- Practice essential QA skills

## Course Modules

### Module 1: Introduction to QA
What is Quality Assurance and why is it important?

### Module 2: Testing Types
- Unit Testing
- Integration Testing  
- System Testing
- Acceptance Testing

### Module 3: Test Planning
How to create effective test plans and test cases.

## Exercises
1. Create your first test case
2. Execute manual testing scenarios
3. Document defects effectively

## Assessment
Complete the quiz to test your understanding of QA fundamentals.`,
        sections: ['Introduction', 'Learning Objectives', 'Course Modules', 'Exercises', 'Assessment']
      },
      {
        id: 'automation-basics',
        name: 'Test Automation Basics',
        description: 'Template for test automation introduction',
        content: `# Test Automation Course

Learn the fundamentals of automated testing and tools.

## What You'll Learn
- Automation framework concepts
- Popular automation tools
- Writing effective automated tests

## Course Content

### Introduction to Automation
Why automate testing and when to use automation.

### Tools Overview
- Selenium WebDriver
- Cypress
- Postman for API testing

### Hands-on Practice
Build your first automated test suite.

## Lab Exercises
1. Set up automation environment
2. Write your first automated test
3. Create test reports

## Final Project
Design and implement an automation strategy for a sample application.`,
        sections: ['Introduction', 'Tools Overview', 'Hands-on Practice', 'Lab Exercises', 'Final Project']
      },
      {
        id: 'api-testing',
        name: 'API Testing Course',
        description: 'Template for API testing fundamentals',
        content: `# API Testing Fundamentals

Master the art of testing APIs and web services.

## Course Overview
Learn to test REST APIs, validate responses, and automate API tests.

### Prerequisites  
- Basic understanding of HTTP
- Familiarity with JSON/XML

### Topics Covered
1. REST API concepts
2. HTTP methods and status codes
3. API testing tools (Postman, REST Assured)
4. Test data management
5. API automation strategies

### Practical Exercises
- Manual API testing with Postman
- Automated API tests with scripts
- Performance testing APIs

### Assessment Methods
- Hands-on lab completion
- API test suite creation
- Quiz on API testing concepts`,
        sections: ['Overview', 'Prerequisites', 'Topics', 'Exercises', 'Assessment']
      }
    ];

    res.json({ templates });
  } catch (error) {
    console.error('Templates fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================
// END CONTENT MANAGEMENT
// ========================

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Content service error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  pool.end();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  pool.end();
  process.exit(0);
});

// Start server only if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`📚 Content Service running on port ${PORT}`);
    console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app; 