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
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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
      'SELECT id, title, description, difficulty_level, estimated_hours, is_published, created_at FROM learning_tracks WHERE is_published = true ORDER BY created_at DESC'
    );

    const tracks = result.rows.map(track => ({
      id: track.id,
      title: track.title,
      description: track.description,
      difficultyLevel: track.difficulty_level,
      estimatedHours: track.estimated_hours,
      isPublished: track.is_published,
      createdAt: track.created_at
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

    // Get track details
    const trackResult = await pool.query(
      'SELECT id, title, description, difficulty_level, estimated_hours, is_published, created_at FROM learning_tracks WHERE id = $1',
      [trackId]
    );

    if (trackResult.rows.length === 0) {
      return res.status(404).json({ error: 'Learning track not found' });
    }

    // Get courses for this track
    const coursesResult = await pool.query(
      'SELECT id, title, description, content, order_index, is_published, created_at FROM courses WHERE track_id = $1 AND is_published = true ORDER BY order_index',
      [trackId]
    );

    const track = trackResult.rows[0];
    const courses = coursesResult.rows.map(course => ({
      id: course.id,
      title: course.title,
      description: course.description,
      content: course.content,
      orderIndex: course.order_index,
      isPublished: course.is_published,
      createdAt: course.created_at
    }));

    res.json({
      id: track.id,
      title: track.title,
      description: track.description,
      difficultyLevel: track.difficulty_level,
      estimatedHours: track.estimated_hours,
      isPublished: track.is_published,
      createdAt: track.created_at,
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
      SELECT c.id, c.title, c.description, c.content, c.order_index, c.is_published, c.created_at,
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
      orderIndex: course.order_index,
      isPublished: course.is_published,
      createdAt: course.created_at,
      trackTitle: course.track_title,
      difficultyLevel: course.difficulty_level
    }));

    res.json({ courses });
  } catch (error) {
    console.error('Courses fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single course
app.get('/courses/:id', async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);

    const result = await pool.query(`
      SELECT c.id, c.title, c.description, c.content, c.order_index, c.is_published, c.created_at,
             t.id as track_id, t.title as track_title, t.difficulty_level
      FROM courses c
      JOIN learning_tracks t ON c.track_id = t.id
      WHERE c.id = $1
    `, [courseId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = result.rows[0];
    res.json({
      id: course.id,
      title: course.title,
      description: course.description,
      content: course.content,
      orderIndex: course.order_index,
      isPublished: course.is_published,
      createdAt: course.created_at,
      track: {
        id: course.track_id,
        title: course.track_title,
        difficultyLevel: course.difficulty_level
      }
    });
  } catch (error) {
    console.error('Course fetch error:', error);
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`📚 Content Service running on port ${PORT}`);
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
}); 