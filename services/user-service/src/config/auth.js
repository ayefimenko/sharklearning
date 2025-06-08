// Authentication Configuration with Secrets Manager Integration
const jwt = require('jsonwebtoken');
const { getJWTSecret } = require('../../../../shared/security/secrets-manager');
const { logger } = require('../../../../shared/utils/logger');
const { AuthenticationError, AuthorizationError } = require('../../../../shared/middleware/error-handler');

let jwtSecret = null;

async function initializeAuth() {
  try {
    // Get JWT secret from secrets manager
    jwtSecret = await getJWTSecret() || process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      throw new Error('JWT Secret not found in secrets manager or environment variables');
    }

    logger.info('Authentication configuration initialized', {
      service: 'user-service',
      secretSource: 'secrets-manager'
    });

    return true;
  } catch (error) {
    logger.error('Failed to initialize authentication configuration', {
      service: 'user-service',
      error: error.message
    });
    throw error;
  }
}

function getJWTSecretSync() {
  if (!jwtSecret) {
    throw new Error('Authentication not initialized. Call initializeAuth() first.');
  }
  return jwtSecret;
}

// Generate JWT token
function generateToken(payload, options = {}) {
  const secret = getJWTSecretSync();
  const defaultOptions = {
    expiresIn: '24h',
    issuer: 'sharklearning-user-service',
    audience: 'sharklearning'
  };

  return jwt.sign(payload, secret, { ...defaultOptions, ...options });
}

// Verify JWT token
function verifyToken(token) {
  const secret = getJWTSecretSync();
  try {
    return jwt.verify(token, secret, {
      issuer: 'sharklearning-user-service',
      audience: 'sharklearning'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new AuthenticationError('Invalid token');
    } else {
      throw new AuthenticationError('Token verification failed');
    }
  }
}

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new AuthenticationError('Access token required');
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    
    logger.debug('Token authenticated successfully', {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      requestId: req.headers['x-request-id']
    });

    next();
  } catch (error) {
    logger.warn('Token authentication failed', {
      error: error.message,
      requestId: req.headers['x-request-id'],
      ip: req.ip
    });
    
    if (error instanceof AuthenticationError) {
      return res.status(401).json({
        success: false,
        error: {
          message: error.message,
          code: 'AUTHENTICATION_ERROR'
        }
      });
    }
    
    return res.status(500).json({
      success: false,
      error: {
        message: 'Internal authentication error',
        code: 'INTERNAL_ERROR'
      }
    });
  }
};

// Middleware to check user roles
const requireRole = (roles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const userRole = req.user.role;
      const allowedRoles = Array.isArray(roles) ? roles : [roles];

      if (!allowedRoles.includes(userRole)) {
        throw new AuthorizationError(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
      }

      logger.debug('Role authorization successful', {
        userId: req.user.userId,
        userRole: userRole,
        requiredRoles: allowedRoles,
        requestId: req.headers['x-request-id']
      });

      next();
    } catch (error) {
      logger.warn('Role authorization failed', {
        userId: req.user?.userId,
        userRole: req.user?.role,
        requiredRoles: roles,
        error: error.message,
        requestId: req.headers['x-request-id']
      });

      if (error instanceof AuthorizationError) {
        return res.status(403).json({
          success: false,
          error: {
            message: error.message,
            code: 'AUTHORIZATION_ERROR'
          }
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          message: 'Internal authorization error',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  };
};

// Middleware to check if user owns resource or is admin
const requireOwnershipOrAdmin = (userIdField = 'userId') => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const currentUserId = req.user.userId;
      const resourceUserId = req.params[userIdField] || req.body[userIdField];
      const isAdmin = req.user.role === 'admin';

      if (!isAdmin && currentUserId !== parseInt(resourceUserId)) {
        throw new AuthorizationError('Access denied. You can only access your own resources.');
      }

      next();
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return res.status(403).json({
          success: false,
          error: {
            message: error.message,
            code: 'AUTHORIZATION_ERROR'
          }
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          message: 'Internal authorization error',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  };
};

// Auth health check
async function checkAuthHealth() {
  try {
    if (!jwtSecret) {
      return { status: 'unhealthy', error: 'JWT secret not initialized' };
    }

    // Test token generation and verification
    const testPayload = { test: true, timestamp: Date.now() };
    const token = generateToken(testPayload, { expiresIn: '1s' });
    const decoded = verifyToken(token);

    if (decoded.test !== true) {
      throw new Error('Token verification test failed');
    }

    return {
      status: 'healthy',
      tokenGeneration: 'operational',
      tokenVerification: 'operational'
    };
  } catch (error) {
    logger.error('Auth health check failed', {
      service: 'user-service',
      error: error.message
    });
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

module.exports = {
  initializeAuth,
  generateToken,
  verifyToken,
  authenticateToken,
  requireRole,
  requireOwnershipOrAdmin,
  checkAuthHealth
}; 