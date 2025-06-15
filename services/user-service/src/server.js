const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const helmet = require('helmet');
const cors = require('cors');
const { createLogger, requestIdMiddleware, logError, logInfo, logAuthEvent } = require('./middleware/logger');
const { 
  registerValidation, 
  loginValidation, 
  handleValidationErrors,
  sensitiveOperationValidation 
} = require('./middleware/validation');
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
app.use(requestIdMiddleware);
app.use(createLogger());
app.use(express.json());

// JWT secret - REQUIRED environment variable
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is required but not set');
  console.error('Please set JWT_SECRET in your environment or .env file');
  process.exit(1);
}

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
    service: 'user-service',
    timestamp: new Date().toISOString()
  });
});

// User registration
app.post('/register', 
  sensitiveOperationValidation,
  registerValidation,
  handleValidationErrors,
  async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      logAuthEvent('REGISTER_FAILED', {
        reason: 'email_already_exists',
        email: email,
        requestId: req.headers['x-request-id'],
        ip: req.ip
      });
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name, role, created_at',
      [email, passwordHash, firstName, lastName]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logAuthEvent('REGISTER_SUCCESS', {
      userId: user.id,
      email: user.email,
      requestId: req.headers['x-request-id'],
      ip: req.ip
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      },
      token
    });
  } catch (error) {
    logError(error, {
      operation: 'user_registration',
      email: req.body.email,
      requestId: req.headers['x-request-id'],
      ip: req.ip
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User login
app.post('/login',
  sensitiveOperationValidation,
  loginValidation,
  handleValidationErrors,
  async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const result = await pool.query(
      'SELECT id, email, password_hash, first_name, last_name, role, is_active FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user profile
app.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, role, profile_image, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      profileImage: user.profile_image,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
app.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (firstName) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(firstName);
    }
    if (lastName) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(lastName);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(req.user.userId);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, email, first_name, last_name, role, profile_image`;
    
    const result = await pool.query(query, values);
    const user = result.rows[0];

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        profileImage: user.profile_image
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users (admin only)
app.get('/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { search, role, status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];
    let paramCount = 1;

    if (search) {
      whereConditions.push(`(first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount} OR email ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
      paramCount++;
    }

    if (role && role !== 'all') {
      whereConditions.push(`role = $${paramCount}`);
      queryParams.push(role);
      paramCount++;
    }

    if (status && status !== 'all') {
      whereConditions.push(`is_active = $${paramCount}`);
      queryParams.push(status === 'active');
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countResult = await pool.query(countQuery, queryParams);
    const totalUsers = parseInt(countResult.rows[0].count);

    // Get users with pagination
    queryParams.push(limit, offset);
    const dataQuery = `
      SELECT id, email, first_name, last_name, role, is_active, profile_image, created_at, updated_at 
      FROM users ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    
    const result = await pool.query(dataQuery, queryParams);

    const users = result.rows.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      isActive: user.is_active,
      profileImage: user.profile_image,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }));

    res.json({ 
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create user (admin only)
app.post('/admin/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { email, password, firstName, lastName, role = 'student' } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, password, firstName, and lastName are required' });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, role, is_active, created_at',
      [email, passwordHash, firstName, lastName, role]
    );

    const user = result.rows[0];

    logAuthEvent('USER_CREATED_BY_ADMIN', {
      userId: user.id,
      email: user.email,
      role: user.role,
      createdBy: req.user.userId,
      requestId: req.headers['x-request-id'],
      ip: req.ip
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    logError(error, {
      operation: 'admin_user_creation',
      email: req.body.email,
      requestId: req.headers['x-request-id'],
      ip: req.ip
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user (admin only)
app.put('/admin/users/:userId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;
    const { email, firstName, lastName, role, isActive } = req.body;

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id, email FROM users WHERE id = $1',
      [userId]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email is already taken by another user
    if (email && email !== existingUser.rows[0].email) {
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Email already in use by another user' });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (email) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (firstName) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(firstName);
    }
    if (lastName) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(lastName);
    }
    if (role) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }
    if (typeof isActive === 'boolean') {
      updates.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')} 
      WHERE id = $${paramCount} 
      RETURNING id, email, first_name, last_name, role, is_active, profile_image, created_at, updated_at
    `;
    
    const result = await pool.query(query, values);
    const user = result.rows[0];

    logAuthEvent('USER_UPDATED_BY_ADMIN', {
      userId: user.id,
      email: user.email,
      updatedBy: req.user.userId,
      requestId: req.headers['x-request-id'],
      ip: req.ip
    });

    res.json({
      message: 'User updated successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isActive: user.is_active,
        profileImage: user.profile_image,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  } catch (error) {
    logError(error, {
      operation: 'admin_user_update',
      userId: req.params.userId,
      requestId: req.headers['x-request-id'],
      ip: req.ip
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (admin only)
app.delete('/admin/users/:userId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;

    // Prevent admin from deleting themselves
    if (parseInt(userId) === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [userId]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = existingUser.rows[0];

    // Begin transaction for cleanup
    await pool.query('BEGIN');

    try {
      // Delete related records first (cascade delete)
      await pool.query('DELETE FROM user_progress WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM user_achievements WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
      
      // Finally delete the user
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);

      await pool.query('COMMIT');

      logAuthEvent('USER_DELETED_BY_ADMIN', {
        deletedUserId: userId,
        deletedUserEmail: user.email,
        deletedUserRole: user.role,
        deletedBy: req.user.userId,
        requestId: req.headers['x-request-id'],
        ip: req.ip
      });

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logError(error, {
      operation: 'admin_user_deletion',
      userId: req.params.userId,
      requestId: req.headers['x-request-id'],
      ip: req.ip
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk user operations (admin only)
app.post('/admin/users/bulk', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userIds, operation, value } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'User IDs array is required' });
    }

    if (!operation) {
      return res.status(400).json({ error: 'Operation is required' });
    }

    // Prevent admin from affecting their own account in bulk operations
    const filteredUserIds = userIds.filter(id => parseInt(id) !== req.user.userId);

    if (filteredUserIds.length === 0) {
      return res.status(400).json({ error: 'Cannot perform bulk operations on your own account' });
    }

    let query;
    let params;

    switch (operation) {
      case 'activate':
        query = `UPDATE users SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1)`;
        params = [filteredUserIds];
        break;
      case 'deactivate':
        query = `UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1)`;
        params = [filteredUserIds];
        break;
      case 'change_role':
        if (!value) {
          return res.status(400).json({ error: 'Role value is required for change_role operation' });
        }
        query = `UPDATE users SET role = $2, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1)`;
        params = [filteredUserIds, value];
        break;
      case 'delete':
        // Begin transaction for bulk delete
        await pool.query('BEGIN');
        try {
          // Delete related records first
          await pool.query('DELETE FROM user_progress WHERE user_id = ANY($1)', [filteredUserIds]);
          await pool.query('DELETE FROM user_achievements WHERE user_id = ANY($1)', [filteredUserIds]);
          await pool.query('DELETE FROM notifications WHERE user_id = ANY($1)', [filteredUserIds]);
          await pool.query('DELETE FROM users WHERE id = ANY($1)', [filteredUserIds]);
          await pool.query('COMMIT');
        } catch (error) {
          await pool.query('ROLLBACK');
          throw error;
        }
        
        logAuthEvent('BULK_USER_DELETE_BY_ADMIN', {
          deletedUserIds: filteredUserIds,
          deletedBy: req.user.userId,
          requestId: req.headers['x-request-id'],
          ip: req.ip
        });

        res.json({ 
          message: `Successfully deleted ${filteredUserIds.length} users`,
          affectedUsers: filteredUserIds.length 
        });
        return;
      default:
        return res.status(400).json({ error: 'Invalid operation. Supported: activate, deactivate, change_role, delete' });
    }

    const result = await pool.query(query, params);

    logAuthEvent('BULK_USER_OPERATION_BY_ADMIN', {
      operation,
      value,
      userIds: filteredUserIds,
      affectedUsers: result.rowCount,
      performedBy: req.user.userId,
      requestId: req.headers['x-request-id'],
      ip: req.ip
    });

    res.json({ 
      message: `Successfully performed ${operation} on ${result.rowCount} users`,
      affectedUsers: result.rowCount 
    });
  } catch (error) {
    logError(error, {
      operation: 'admin_bulk_user_operation',
      requestId: req.headers['x-request-id'],
      ip: req.ip
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user analytics (admin only)
app.get('/admin/analytics/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { timeframe = '30d' } = req.query;
    
    // Calculate date range
    let dateFilter = '';
    if (timeframe === '7d') {
      dateFilter = "AND created_at >= NOW() - INTERVAL '7 days'";
    } else if (timeframe === '30d') {
      dateFilter = "AND created_at >= NOW() - INTERVAL '30 days'";
    } else if (timeframe === '90d') {
      dateFilter = "AND created_at >= NOW() - INTERVAL '90 days'";
    }

    // Get user statistics
    const statsQueries = [
      // Total users
      pool.query('SELECT COUNT(*) as total FROM users'),
      // Active users
      pool.query('SELECT COUNT(*) as active FROM users WHERE is_active = true'),
      // New users in timeframe
      pool.query(`SELECT COUNT(*) as new_users FROM users WHERE true ${dateFilter}`),
      // Users by role
      pool.query('SELECT role, COUNT(*) as count FROM users GROUP BY role'),
      // Users by status
      pool.query('SELECT is_active, COUNT(*) as count FROM users GROUP BY is_active'),
      // Daily registrations in timeframe
      pool.query(`
        SELECT DATE(created_at) as date, COUNT(*) as registrations 
        FROM users 
        WHERE true ${dateFilter}
        GROUP BY DATE(created_at) 
        ORDER BY date
      `)
    ];

    const [
      totalResult,
      activeResult,
      newUsersResult,
      roleResult,
      statusResult,
      dailyResult
    ] = await Promise.all(statsQueries);

    const analytics = {
      summary: {
        totalUsers: parseInt(totalResult.rows[0].total),
        activeUsers: parseInt(activeResult.rows[0].active),
        newUsers: parseInt(newUsersResult.rows[0].new_users),
        inactiveUsers: parseInt(totalResult.rows[0].total) - parseInt(activeResult.rows[0].active)
      },
      breakdown: {
        byRole: roleResult.rows.map(row => ({
          role: row.role,
          count: parseInt(row.count)
        })),
        byStatus: statusResult.rows.map(row => ({
          status: row.is_active ? 'active' : 'inactive',
          count: parseInt(row.count)
        }))
      },
      trends: {
        dailyRegistrations: dailyResult.rows.map(row => ({
          date: row.date,
          registrations: parseInt(row.registrations)
        }))
      },
      timeframe
    };

    res.json({ analytics });
  } catch (error) {
    logError(error, {
      operation: 'admin_user_analytics',
      requestId: req.headers['x-request-id'],
      ip: req.ip
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('User service error:', err);
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

// Start server (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`👤 User Service running on port ${PORT}`);
    console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Export app for testing
module.exports = app; 