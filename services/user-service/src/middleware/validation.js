const { body, validationResult, param, query } = require('express-validator');
const { logError } = require('./logger');

// Common validation rules
const emailValidation = () => 
  body('email')
    .isEmail()
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Valid email is required (max 255 characters)');

const passwordValidation = () => 
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be 6-128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number');

const nameValidation = (field) => 
  body(field)
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage(`${field} is required (max 100 characters)`)
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(`${field} can only contain letters, spaces, hyphens, and apostrophes`);

// Validation rule sets
const registerValidation = [
  emailValidation(),
  passwordValidation(),
  nameValidation('firstName'),
  nameValidation('lastName'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    })
];

const loginValidation = [
  emailValidation(),
  body('password')
    .exists()
    .isLength({ min: 1 })
    .withMessage('Password is required')
];

const updateProfileValidation = [
  nameValidation('firstName').optional(),
  nameValidation('lastName').optional(),
  body('profileImage')
    .optional()
    .isURL()
    .withMessage('Profile image must be a valid URL')
];

const passwordResetValidation = [
  emailValidation()
];

const changePasswordValidation = [
  body('currentPassword')
    .exists()
    .isLength({ min: 1 })
    .withMessage('Current password is required'),
  passwordValidation().withMessage('New password must be 6-128 characters and contain uppercase, lowercase, and number'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    })
];

// ID parameter validation
const userIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Valid user ID is required')
];

// Pagination validation
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Page must be a positive integer (max 10000)'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value
    }));

    logError(new Error('Validation failed'), {
      operation: 'input_validation',
      errors: errorDetails,
      requestId: req.headers['x-request-id'],
      ip: req.ip,
      endpoint: req.originalUrl
    });

    return res.status(400).json({
      error: 'Validation failed',
      details: errorDetails,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
  }
  
  next();
};

// Rate limiting validation for sensitive operations
const sensitiveOperationValidation = (req, res, next) => {
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /data:\s*text\/html/i
  ];

  const checkValue = (value) => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkValue);
    }
    return false;
  };

  if (checkValue(req.body) || checkValue(req.query) || checkValue(req.params)) {
    logError(new Error('Suspicious input detected'), {
      operation: 'security_validation',
      body: req.body,
      query: req.query,
      params: req.params,
      requestId: req.headers['x-request-id'],
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    return res.status(400).json({
      error: 'Invalid input detected',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
  }

  next();
};

module.exports = {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  passwordResetValidation,
  changePasswordValidation,
  userIdValidation,
  paginationValidation,
  handleValidationErrors,
  sensitiveOperationValidation
}; 