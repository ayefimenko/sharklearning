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
        averageProgress: stats.average_progress ? Math.round(parseFloat(stats.average_progress)) : 0,
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
    
    if (isNaN(courseId)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }

    const result = await pool.query(
      'SELECT * FROM user_progress WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );

    if (result.rows.length === 0) {
      return res.json({
        courseId,
        progressPercentage: 0,
        isCompleted: false,
        startedAt: null,
        updatedAt: null
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
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
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

    res.json(leaderboard);
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================
// LEARNING PATHS & CURRICULUM ENDPOINTS
// ========================

// Test endpoint
app.get('/test-learning', (req, res) => {
  res.json({ message: 'Learning paths endpoints are working!' });
});

// Get all available learning paths
app.get('/learning-paths', async (req, res) => {
  try {
    const { role, certification } = req.query;
    
    let whereConditions = ['is_published = true'];
    let queryParams = [];
    let paramCount = 1;

    if (role) {
      whereConditions.push(`target_role = $${paramCount++}`);
      queryParams.push(role);
    }

    if (certification === 'true') {
      whereConditions.push(`is_certification_path = true`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT 
        lp.id, lp.title, lp.description, lp.target_role, lp.difficulty_progression,
        lp.estimated_weeks, lp.skills_gained, lp.is_certification_path,
        lp.created_at, lp.updated_at,
        (SELECT COUNT(*) FROM learning_path_items lpi WHERE lpi.learning_path_id = lp.id) as total_items,
        (SELECT COUNT(*) FROM user_learning_paths ulp WHERE ulp.learning_path_id = lp.id) as enrolled_users
      FROM learning_paths lp
      ${whereClause}
      ORDER BY lp.created_at DESC
    `, queryParams);

    const learningPaths = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      targetRole: row.target_role,
      difficultyProgression: row.difficulty_progression,
      estimatedWeeks: row.estimated_weeks,
      skillsGained: row.skills_gained,
      isCertificationPath: row.is_certification_path,
      totalItems: parseInt(row.total_items),
      enrolledUsers: parseInt(row.enrolled_users),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({ learningPaths });
  } catch (error) {
    console.error('Learning paths fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific learning path with items
app.get('/learning-paths/:pathId', async (req, res) => {
  try {
    const pathId = parseInt(req.params.pathId);
    
    if (isNaN(pathId)) {
      return res.status(400).json({ error: 'Invalid learning path ID' });
    }

    // Get learning path details
    const pathResult = await pool.query(`
      SELECT * FROM learning_paths WHERE id = $1 AND is_published = true
    `, [pathId]);

    if (pathResult.rows.length === 0) {
      return res.status(404).json({ error: 'Learning path not found' });
    }

    // Get learning path items
    const itemsResult = await pool.query(`
      SELECT lpi.*, 
             CASE 
               WHEN lpi.content_type = 'track' THEN (SELECT title FROM learning_tracks WHERE id = lpi.content_id)
               WHEN lpi.content_type = 'course' THEN (SELECT title FROM courses WHERE id = lpi.content_id)
             END as content_title,
             CASE 
               WHEN lpi.content_type = 'track' THEN (SELECT description FROM learning_tracks WHERE id = lpi.content_id)
               WHEN lpi.content_type = 'course' THEN (SELECT description FROM courses WHERE id = lpi.content_id)
             END as content_description
      FROM learning_path_items lpi
      WHERE lpi.learning_path_id = $1
      ORDER BY lpi.order_index
    `, [pathId]);

    // Get skills information
    const skillsResult = await pool.query(`
      SELECT s.id, s.name, s.description, s.category, s.level_description, s.icon
      FROM skills s
      WHERE s.is_active = true
      ORDER BY s.category, s.name
    `);

    const learningPath = pathResult.rows[0];
    const items = itemsResult.rows.map(item => ({
      id: item.id,
      contentType: item.content_type,
      contentId: item.content_id,
      contentTitle: item.content_title,
      contentDescription: item.content_description,
      orderIndex: item.order_index,
      isOptional: item.is_optional,
      estimatedHours: item.estimated_hours,
      skillsFocus: item.skills_focus,
      createdAt: item.created_at
    }));

    const skills = skillsResult.rows.map(skill => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      levelDescription: skill.level_description,
      icon: skill.icon
    }));

    res.json({
      id: learningPath.id,
      title: learningPath.title,
      description: learningPath.description,
      targetRole: learningPath.target_role,
      difficultyProgression: learningPath.difficulty_progression,
      estimatedWeeks: learningPath.estimated_weeks,
      skillsGained: learningPath.skills_gained,
      isCertificationPath: learningPath.is_certification_path,
      items,
      availableSkills: skills,
      createdAt: learningPath.created_at,
      updatedAt: learningPath.updated_at
    });
  } catch (error) {
    console.error('Learning path fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Enroll user in learning path
app.post('/learning-paths/:pathId/enroll', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const pathId = parseInt(req.params.pathId);
    
    if (isNaN(pathId)) {
      return res.status(400).json({ error: 'Invalid learning path ID' });
    }

    // Check if learning path exists
    const pathCheck = await pool.query(
      'SELECT id, estimated_weeks FROM learning_paths WHERE id = $1 AND is_published = true',
      [pathId]
    );

    if (pathCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Learning path not found' });
    }

    // Check if user is already enrolled
    const existingEnrollment = await pool.query(
      'SELECT id FROM user_learning_paths WHERE user_id = $1 AND learning_path_id = $2',
      [userId, pathId]
    );

    if (existingEnrollment.rows.length > 0) {
      return res.status(400).json({ error: 'Already enrolled in this learning path' });
    }

    // Calculate estimated completion date
    const estimatedWeeks = pathCheck.rows[0].estimated_weeks;
    const estimatedCompletion = new Date();
    estimatedCompletion.setDate(estimatedCompletion.getDate() + (estimatedWeeks * 7));

    // Get first item in the learning path
    const firstItem = await pool.query(
      'SELECT id FROM learning_path_items WHERE learning_path_id = $1 ORDER BY order_index LIMIT 1',
      [pathId]
    );

    const currentItemId = firstItem.rows.length > 0 ? firstItem.rows[0].id : null;

    // Enroll user
    const enrollResult = await pool.query(`
      INSERT INTO user_learning_paths (user_id, learning_path_id, current_item_id, estimated_completion)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [userId, pathId, currentItemId, estimatedCompletion]);

    res.status(201).json({
      message: 'Successfully enrolled in learning path',
      enrollment: {
        id: enrollResult.rows[0].id,
        userId,
        learningPathId: pathId,
        currentItemId,
        progressPercentage: 0,
        estimatedCompletion,
        startedAt: enrollResult.rows[0].started_at
      }
    });
  } catch (error) {
    console.error('Learning path enrollment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's enrolled learning paths
app.get('/my-learning-paths', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(`
      SELECT 
        ulp.id as enrollment_id, ulp.progress_percentage, ulp.is_completed,
        ulp.started_at, ulp.completed_at, ulp.estimated_completion,
        lp.id, lp.title, lp.description, lp.target_role, lp.estimated_weeks,
        lp.skills_gained, lp.is_certification_path,
        (SELECT COUNT(*) FROM learning_path_items WHERE learning_path_id = lp.id) as total_items,
        CASE 
          WHEN ulp.current_item_id IS NOT NULL THEN
            (SELECT lpi.order_index FROM learning_path_items lpi WHERE lpi.id = ulp.current_item_id)
          ELSE 0
        END as current_item_order
      FROM user_learning_paths ulp
      JOIN learning_paths lp ON ulp.learning_path_id = lp.id
      WHERE ulp.user_id = $1
      ORDER BY ulp.started_at DESC
    `, [userId]);

    const enrolledPaths = result.rows.map(row => ({
      enrollmentId: row.enrollment_id,
      learningPath: {
        id: row.id,
        title: row.title,
        description: row.description,
        targetRole: row.target_role,
        estimatedWeeks: row.estimated_weeks,
        skillsGained: row.skills_gained,
        isCertificationPath: row.is_certification_path
      },
      progress: {
        percentage: row.progress_percentage,
        isCompleted: row.is_completed,
        currentItemOrder: row.current_item_order || 0,
        totalItems: parseInt(row.total_items)
      },
      timeline: {
        startedAt: row.started_at,
        completedAt: row.completed_at,
        estimatedCompletion: row.estimated_completion
      }
    }));

    res.json({ enrolledPaths });
  } catch (error) {
    console.error('User learning paths fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user skills profile
app.get('/skills', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's current skills
    const userSkillsResult = await pool.query(`
      SELECT 
        us.skill_id, us.current_level, us.evidence_count, us.last_improved,
        s.name, s.description, s.category, s.level_description, s.icon
      FROM user_skills us
      JOIN skills s ON us.skill_id = s.id
      WHERE us.user_id = $1 AND s.is_active = true
      ORDER BY s.category, s.name
    `, [userId]);

    // Get all available skills that user doesn't have yet
    const availableSkillsResult = await pool.query(`
      SELECT s.id, s.name, s.description, s.category, s.level_description, s.icon
      FROM skills s
      WHERE s.is_active = true 
      AND s.id NOT IN (SELECT skill_id FROM user_skills WHERE user_id = $1)
      ORDER BY s.category, s.name
    `, [userId]);

    // Get skill assessment history
    const assessmentsResult = await pool.query(`
      SELECT 
        sa.skill_id, sa.assessment_type, sa.score_percentage, sa.level_achieved,
        sa.feedback, sa.assessed_at,
        s.name as skill_name
      FROM skill_assessments sa
      JOIN skills s ON sa.skill_id = s.id
      WHERE sa.user_id = $1
      ORDER BY sa.assessed_at DESC
      LIMIT 20
    `, [userId]);

    const userSkills = userSkillsResult.rows.map(row => ({
      skillId: row.skill_id,
      skill: {
        name: row.name,
        description: row.description,
        category: row.category,
        levelDescription: row.level_description,
        icon: row.icon
      },
      currentLevel: row.current_level,
      evidenceCount: row.evidence_count,
      lastImproved: row.last_improved
    }));

    const availableSkills = availableSkillsResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      levelDescription: row.level_description,
      icon: row.icon
    }));

    const recentAssessments = assessmentsResult.rows.map(row => ({
      skillId: row.skill_id,
      skillName: row.skill_name,
      assessmentType: row.assessment_type,
      scorePercentage: row.score_percentage,
      levelAchieved: row.level_achieved,
      feedback: row.feedback,
      assessedAt: row.assessed_at
    }));

    res.json({
      userSkills,
      availableSkills,
      recentAssessments,
      skillStats: {
        totalSkills: userSkills.length,
        skillsByLevel: {
          beginner: userSkills.filter(s => s.currentLevel === 'beginner').length,
          intermediate: userSkills.filter(s => s.currentLevel === 'intermediate').length,
          advanced: userSkills.filter(s => s.currentLevel === 'advanced').length,
          expert: userSkills.filter(s => s.currentLevel === 'expert').length
        }
      }
    });
  } catch (error) {
    console.error('Skills profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update skill level based on course completion
app.post('/skills/assess', authenticateToken, [
  body('skillId').isInt(),
  body('assessmentType').isIn(['course', 'quiz', 'practical', 'self-assessment']),
  body('sourceId').optional().isInt(),
  body('scorePercentage').isInt({ min: 0, max: 100 }),
  body('levelAchieved').isIn(['beginner', 'intermediate', 'advanced', 'expert'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const { skillId, assessmentType, sourceId, scorePercentage, levelAchieved, feedback } = req.body;

    // Record the skill assessment
    await pool.query(`
      INSERT INTO skill_assessments (user_id, skill_id, assessment_type, source_type, source_id, score_percentage, level_achieved, feedback)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [userId, skillId, assessmentType, assessmentType, sourceId, scorePercentage, levelAchieved, feedback]);

    // Update or create user skill record
    const existingSkill = await pool.query(
      'SELECT id, current_level, evidence_count FROM user_skills WHERE user_id = $1 AND skill_id = $2',
      [userId, skillId]
    );

    if (existingSkill.rows.length > 0) {
      // Update existing skill
      const currentLevel = existingSkill.rows[0].current_level;
      const evidenceCount = existingSkill.rows[0].evidence_count;
      
      // Only update level if the new level is higher
      const levels = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
      const shouldUpdateLevel = levels[levelAchieved] > levels[currentLevel];
      
      await pool.query(`
        UPDATE user_skills 
        SET current_level = $1, evidence_count = $2, last_improved = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $3 AND skill_id = $4
      `, [
        shouldUpdateLevel ? levelAchieved : currentLevel,
        evidenceCount + 1,
        userId,
        skillId
      ]);
    } else {
      // Create new skill record
      await pool.query(`
        INSERT INTO user_skills (user_id, skill_id, current_level, evidence_count)
        VALUES ($1, $2, $3, 1)
      `, [userId, skillId, levelAchieved]);
    }

    res.json({
      message: 'Skill assessment recorded successfully',
      assessment: {
        skillId,
        assessmentType,
        scorePercentage,
        levelAchieved,
        assessedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Skill assessment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available certifications
app.get('/certifications', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id, c.title, c.description, c.requirements, c.validity_months,
        lp.title as learning_path_title, lp.target_role
      FROM certifications c
      LEFT JOIN learning_paths lp ON c.learning_path_id = lp.id
      WHERE c.is_active = true
      ORDER BY c.created_at DESC
    `);

    const certifications = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      requirements: row.requirements,
      validityMonths: row.validity_months,
      learningPath: row.learning_path_title ? {
        title: row.learning_path_title,
        targetRole: row.target_role
      } : null
    }));

    res.json({ certifications });
  } catch (error) {
    console.error('Certifications fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's certifications
app.get('/my-certifications', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(`
      SELECT 
        uc.id, uc.earned_at, uc.expires_at, uc.certificate_url, uc.verification_code, uc.is_valid,
        c.title, c.description, c.validity_months
      FROM user_certifications uc
      JOIN certifications c ON uc.certification_id = c.id
      WHERE uc.user_id = $1
      ORDER BY uc.earned_at DESC
    `, [userId]);

    const userCertifications = result.rows.map(row => ({
      id: row.id,
      certification: {
        title: row.title,
        description: row.description,
        validityMonths: row.validity_months
      },
      earnedAt: row.earned_at,
      expiresAt: row.expires_at,
      certificateUrl: row.certificate_url,
      verificationCode: row.verification_code,
      isValid: row.is_valid
    }));

    res.json({ userCertifications });
  } catch (error) {
    console.error('User certifications fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================
// END LEARNING PATHS ENDPOINTS
// ========================

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Progress service error:', err);
  
  // Handle JSON parsing errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON format' });
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Daily achievement check cron job (disabled in test mode)
if (process.env.NODE_ENV !== 'test') {
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
}

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
    console.log(`📊 Progress Service running on port ${PORT}`);
    console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app; 