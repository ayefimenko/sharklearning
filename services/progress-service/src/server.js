const express = require('express');
const { Pool } = require('pg');
const { body, validationResult } = require('express-validator');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
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

// Achievement checking function
const checkAchievements = async (userId) => {
  try {
    // Check for "First Steps" achievement
    const firstCourse = await pool.query(
      'SELECT COUNT(*) as count FROM user_progress WHERE user_id = $1 AND is_completed = true',
      [userId]
    );
    
    if (firstCourse.rows[0].count >= 1) {
      await awardAchievement(userId, 1); // First Steps achievement
    }

    // Check for "Track Master" achievement
    const completedTracks = await pool.query(`
      SELECT track_id, COUNT(*) as completed_courses,
             (SELECT COUNT(*) FROM courses WHERE track_id = up.track_id AND is_published = true) as total_courses
      FROM user_progress up
      WHERE user_id = $1 AND is_completed = true
      GROUP BY track_id
      HAVING COUNT(*) = (SELECT COUNT(*) FROM courses WHERE track_id = up.track_id AND is_published = true)
    `, [userId]);

    if (completedTracks.rows.length >= 1) {
      await awardAchievement(userId, 4); // Track Master achievement
    }

  } catch (error) {
    console.error('Achievement check error:', error);
  }
};

// Award achievement function
const awardAchievement = async (userId, achievementId) => {
  try {
    // Check if user already has this achievement
    const existing = await pool.query(
      'SELECT id FROM user_achievements WHERE user_id = $1 AND achievement_id = $2',
      [userId, achievementId]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)',
        [userId, achievementId]
      );
      console.log(`Achievement ${achievementId} awarded to user ${userId}`);
    }
  } catch (error) {
    console.error('Award achievement error:', error);
  }
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'progress-service',
    timestamp: new Date().toISOString()
  });
});

// Get user progress overview
app.get('/overview', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get overall progress stats
    const statsResult = await pool.query(`
      SELECT 
        COUNT(CASE WHEN is_completed = true THEN 1 END) as completed_courses,
        COUNT(*) as total_enrolled,
        COALESCE(AVG(progress_percentage), 0) as average_progress
      FROM user_progress 
      WHERE user_id = $1
    `, [userId]);

    // Get recent progress
    const recentResult = await pool.query(`
      SELECT up.course_id, up.progress_percentage, up.is_completed, up.updated_at,
             c.title as course_title, t.title as track_title
      FROM user_progress up
      JOIN courses c ON up.course_id = c.id
      JOIN learning_tracks t ON c.track_id = t.id
      WHERE up.user_id = $1
      ORDER BY up.updated_at DESC
      LIMIT 5
    `, [userId]);

    // Get achievements
    const achievementsResult = await pool.query(`
      SELECT a.title, a.description, a.badge_icon, a.points, ua.earned_at
      FROM user_achievements ua
      JOIN achievements a ON ua.achievement_id = a.id
      WHERE ua.user_id = $1
      ORDER BY ua.earned_at DESC
    `, [userId]);

    // Calculate total points
    const pointsResult = await pool.query(`
      SELECT COALESCE(SUM(a.points), 0) as total_points
      FROM user_achievements ua
      JOIN achievements a ON ua.achievement_id = a.id
      WHERE ua.user_id = $1
    `, [userId]);

    const stats = statsResult.rows[0];
    const recentProgress = recentResult.rows.map(row => ({
      courseId: row.course_id,
      courseTitle: row.course_title,
      trackTitle: row.track_title,
      progressPercentage: row.progress_percentage,
      isCompleted: row.is_completed,
      updatedAt: row.updated_at
    }));

    const achievements = achievementsResult.rows.map(row => ({
      title: row.title,
      description: row.description,
      badgeIcon: row.badge_icon,
      points: row.points,
      earnedAt: row.earned_at
    }));

    res.json({
      stats: {
        completedCourses: parseInt(stats.completed_courses),
        totalEnrolled: parseInt(stats.total_enrolled),
        averageProgress: Math.round(parseFloat(stats.average_progress)),
        totalPoints: parseInt(pointsResult.rows[0].total_points)
      },
      recentProgress,
      achievements
    });
  } catch (error) {
    console.error('Progress overview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get progress for specific course
app.get('/courses/:courseId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const courseId = parseInt(req.params.courseId);

    const result = await pool.query(
      'SELECT * FROM user_progress WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );

    if (result.rows.length === 0) {
      return res.json({
        courseId,
        progressPercentage: 0,
        isCompleted: false,
        startedAt: null
      });
    }

    const progress = result.rows[0];
    res.json({
      courseId: progress.course_id,
      trackId: progress.track_id,
      progressPercentage: progress.progress_percentage,
      isCompleted: progress.is_completed,
      startedAt: progress.started_at,
      completedAt: progress.completed_at,
      updatedAt: progress.updated_at
    });
  } catch (error) {
    console.error('Course progress fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update course progress
app.put('/courses/:courseId', authenticateToken, [
  body('progressPercentage').isInt({ min: 0, max: 100 }),
  body('isCompleted').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const courseId = parseInt(req.params.courseId);
    const { progressPercentage, isCompleted = false } = req.body;

    // Get course and track info
    const courseInfo = await pool.query(
      'SELECT track_id FROM courses WHERE id = $1',
      [courseId]
    );

    if (courseInfo.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const trackId = courseInfo.rows[0].track_id;

    // Upsert progress
    const result = await pool.query(`
      INSERT INTO user_progress (user_id, course_id, track_id, progress_percentage, is_completed, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, course_id)
      DO UPDATE SET 
        progress_percentage = EXCLUDED.progress_percentage,
        is_completed = EXCLUDED.is_completed,
        completed_at = EXCLUDED.completed_at,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [userId, courseId, trackId, progressPercentage, isCompleted, isCompleted ? new Date() : null]);

    const progress = result.rows[0];

    // Check for achievements if course is completed
    if (isCompleted) {
      await checkAchievements(userId);
    }

    res.json({
      message: 'Progress updated successfully',
      progress: {
        courseId: progress.course_id,
        trackId: progress.track_id,
        progressPercentage: progress.progress_percentage,
        isCompleted: progress.is_completed,
        startedAt: progress.started_at,
        completedAt: progress.completed_at,
        updatedAt: progress.updated_at
      }
    });
  } catch (error) {
    console.error('Progress update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all achievements
app.get('/achievements', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, description, badge_icon, points FROM achievements ORDER BY points ASC'
    );

    const achievements = result.rows.map(achievement => ({
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      badgeIcon: achievement.badge_icon,
      points: achievement.points
    }));

    res.json({ achievements });
  } catch (error) {
    console.error('Achievements fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's achievements
app.get('/achievements/user', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(`
      SELECT a.id, a.title, a.description, a.badge_icon, a.points, ua.earned_at
      FROM user_achievements ua
      JOIN achievements a ON ua.achievement_id = a.id
      WHERE ua.user_id = $1
      ORDER BY ua.earned_at DESC
    `, [userId]);

    const achievements = result.rows.map(achievement => ({
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      badgeIcon: achievement.badge_icon,
      points: achievement.points,
      earnedAt: achievement.earned_at
    }));

    res.json({ achievements });
  } catch (error) {
    console.error('User achievements fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get leaderboard
app.get('/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, u.profile_image,
             COALESCE(SUM(a.points), 0) as total_points,
             COUNT(ua.achievement_id) as achievement_count
      FROM users u
      LEFT JOIN user_achievements ua ON u.id = ua.user_id
      LEFT JOIN achievements a ON ua.achievement_id = a.id
      WHERE u.is_active = true
      GROUP BY u.id, u.first_name, u.last_name, u.profile_image
      ORDER BY total_points DESC, achievement_count DESC
      LIMIT 10
    `);

    const leaderboard = result.rows.map((user, index) => ({
      rank: index + 1,
      userId: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      profileImage: user.profile_image,
      totalPoints: parseInt(user.total_points),
      achievementCount: parseInt(user.achievement_count)
    }));

    res.json({ leaderboard });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Progress service error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Daily achievement check cron job
cron.schedule('0 2 * * *', async () => {
  console.log('Running daily achievement check...');
  try {
    const users = await pool.query('SELECT id FROM users WHERE is_active = true');
    for (const user of users.rows) {
      await checkAchievements(user.id);
    }
  } catch (error) {
    console.error('Daily achievement check error:', error);
  }
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
  console.log(`📊 Progress Service running on port ${PORT}`);
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
}); 