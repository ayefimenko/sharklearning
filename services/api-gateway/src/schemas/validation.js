const Joi = require('joi');

// Common validation patterns
const commonSchemas = {
  // ID validation
  id: Joi.number().integer().positive().max(2147483647), // PostgreSQL INT max
  uuid: Joi.string().guid({ version: ['uuidv4'] }),
  
  // Email validation
  email: Joi.string().email({ minDomainSegments: 2, tlds: { allow: ['com', 'net', 'org', 'edu', 'gov', 'mil', 'co', 'us', 'uk', 'ca'] } }).max(254),
  
  // Password validation
  password: Joi.string().min(6).max(128).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)')).required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'string.min': 'Password must be at least 6 characters long',
      'string.max': 'Password cannot exceed 128 characters'
    }),
  
  // Name validation
  name: Joi.string().min(1).max(100).pattern(/^[a-zA-Z\s\-'\.]+$/).trim()
    .messages({
      'string.pattern.base': 'Name can only contain letters, spaces, hyphens, apostrophes, and periods'
    }),
  
  // Phone validation
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).min(10).max(20),
  
  // URL validation
  url: Joi.string().uri({ scheme: ['http', 'https'] }).max(2048),
  
  // Date validation
  dateString: Joi.string().isoDate(),
  
  // Role validation
  userRole: Joi.string().valid('admin', 'instructor', 'student').default('student'),
  
  // Pagination
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  
  // Search
  searchQuery: Joi.string().min(1).max(255).trim()
};

// User-related validation schemas
const userSchemas = {
  // User registration
  register: Joi.object({
    firstName: commonSchemas.name.required(),
    lastName: commonSchemas.name.required(),
    email: commonSchemas.email.required(),
    password: commonSchemas.password,
    confirmPassword: Joi.string().valid(Joi.ref('password')).required()
      .messages({
        'any.only': 'Password confirmation does not match password'
      }),
    role: commonSchemas.userRole,
    phone: commonSchemas.phone.optional(),
    dateOfBirth: commonSchemas.dateString.optional(),
    agreeToTerms: Joi.boolean().truthy().required()
      .messages({
        'any.only': 'You must agree to the terms and conditions'
      })
  }),
  
  // User login
  login: Joi.object({
    email: commonSchemas.email.required(),
    password: Joi.string().required(), // Less strict for login
    rememberMe: Joi.boolean().optional()
  }),
  
  // Profile update
  updateProfile: Joi.object({
    firstName: commonSchemas.name.optional(),
    lastName: commonSchemas.name.optional(),
    phone: commonSchemas.phone.optional(),
    dateOfBirth: commonSchemas.dateString.optional(),
    bio: Joi.string().max(500).optional(),
    profileImage: commonSchemas.url.optional()
  }),
  
  // Change password
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: commonSchemas.password,
    confirmNewPassword: Joi.string().valid(Joi.ref('newPassword')).required()
      .messages({
        'any.only': 'New password confirmation does not match new password'
      })
  }),
  
  // Forgot password
  forgotPassword: Joi.object({
    email: commonSchemas.email.required()
  }),
  
  // Reset password
  resetPassword: Joi.object({
    token: Joi.string().required(),
    newPassword: commonSchemas.password,
    confirmNewPassword: Joi.string().valid(Joi.ref('newPassword')).required()
  })
};

// Content-related validation schemas
const contentSchemas = {
  // Create course
  createCourse: Joi.object({
    title: Joi.string().min(5).max(200).required(),
    slug: Joi.string().min(3).max(100).pattern(/^[a-z0-9-]+$/).required(),
    description: Joi.string().min(20).max(2000).required(),
    shortDescription: Joi.string().max(500).optional(),
    category: Joi.string().min(2).max(50).required(),
    difficulty: Joi.string().valid('beginner', 'intermediate', 'advanced').required(),
    price: Joi.number().min(0).max(999999.99).precision(2).optional(),
    isFree: Joi.boolean().default(false),
    isPublished: Joi.boolean().default(false),
    estimatedDuration: Joi.number().integer().min(1).max(999999), // in minutes
    thumbnail: commonSchemas.url.optional(),
    tags: Joi.array().items(Joi.string().min(2).max(30)).max(10).optional()
  }),
  
  // Update course
  updateCourse: Joi.object({
    title: Joi.string().min(5).max(200).optional(),
    description: Joi.string().min(20).max(2000).optional(),
    shortDescription: Joi.string().max(500).optional(),
    category: Joi.string().min(2).max(50).optional(),
    difficulty: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
    price: Joi.number().min(0).max(999999.99).precision(2).optional(),
    isFree: Joi.boolean().optional(),
    isPublished: Joi.boolean().optional(),
    estimatedDuration: Joi.number().integer().min(1).max(999999).optional(),
    thumbnail: commonSchemas.url.optional(),
    tags: Joi.array().items(Joi.string().min(2).max(30)).max(10).optional()
  }),
  
  // Create lesson
  createLesson: Joi.object({
    courseId: commonSchemas.id.required(),
    title: Joi.string().min(5).max(200).required(),
    slug: Joi.string().min(3).max(100).pattern(/^[a-z0-9-]+$/).required(),
    content: Joi.string().min(50).max(50000).required(),
    type: Joi.string().valid('video', 'text', 'quiz', 'assignment').required(),
    duration: Joi.number().integer().min(1).max(999999).optional(), // in minutes
    order: Joi.number().integer().min(1).max(999).required(),
    isPreview: Joi.boolean().default(false),
    videoUrl: commonSchemas.url.when('type', { is: 'video', then: Joi.required() }),
    attachments: Joi.array().items(Joi.object({
      name: Joi.string().min(1).max(255).required(),
      url: commonSchemas.url.required(),
      size: Joi.number().integer().min(1).max(104857600) // 100MB max
    })).max(10).optional()
  }),
  
  // Search content
  searchContent: Joi.object({
    q: commonSchemas.searchQuery.required(),
    category: Joi.string().min(2).max(50).optional(),
    difficulty: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
    isFree: Joi.boolean().optional(),
    minPrice: Joi.number().min(0).max(999999.99).precision(2).optional(),
    maxPrice: Joi.number().min(0).max(999999.99).precision(2).optional(),
    tags: Joi.array().items(Joi.string().min(2).max(30)).max(5).optional(),
    page: commonSchemas.page,
    limit: commonSchemas.limit
  }).with('minPrice', 'maxPrice'), // If minPrice is provided, maxPrice must also be provided
  
  // Upload content
  uploadContent: Joi.object({
    type: Joi.string().valid('image', 'video', 'document', 'attachment').required(),
    courseId: commonSchemas.id.optional(),
    lessonId: commonSchemas.id.optional()
  })
};

// Progress-related validation schemas
const progressSchemas = {
  // Update progress
  updateProgress: Joi.object({
    courseId: commonSchemas.id.required(),
    lessonId: commonSchemas.id.required(),
    progress: Joi.number().min(0).max(100).precision(2).required(),
    timeSpent: Joi.number().integer().min(0).max(86400).required(), // max 24 hours in seconds
    completed: Joi.boolean().default(false)
  }),
  
  // Complete lesson
  completeLesson: Joi.object({
    courseId: commonSchemas.id.required(),
    lessonId: commonSchemas.id.required(),
    timeSpent: Joi.number().integer().min(0).max(86400).required(),
    score: Joi.number().min(0).max(100).precision(2).optional() // for quizzes
  }),
  
  // Get progress
  getProgress: Joi.object({
    courseId: commonSchemas.id.optional(),
    userId: commonSchemas.id.optional(),
    startDate: commonSchemas.dateString.optional(),
    endDate: commonSchemas.dateString.optional()
  })
};

// Notification-related validation schemas
const notificationSchemas = {
  // Create notification
  createNotification: Joi.object({
    userId: commonSchemas.id.required(),
    title: Joi.string().min(5).max(200).required(),
    message: Joi.string().min(10).max(1000).required(),
    type: Joi.string().valid('info', 'success', 'warning', 'error', 'course', 'assignment', 'achievement').required(),
    metadata: Joi.object().optional(),
    expiresAt: commonSchemas.dateString.optional()
  }),
  
  // Update notification
  updateNotification: Joi.object({
    isRead: Joi.boolean().required()
  }),
  
  // Get notifications
  getNotifications: Joi.object({
    isRead: Joi.boolean().optional(),
    type: Joi.string().valid('info', 'success', 'warning', 'error', 'course', 'assignment', 'achievement').optional(),
    page: commonSchemas.page,
    limit: commonSchemas.limit
  })
};

// Validation middleware factory
const createValidationMiddleware = (schema, location = 'body') => {
  return (req, res, next) => {
    const dataToValidate = location === 'body' ? req.body : 
                          location === 'query' ? req.query : 
                          location === 'params' ? req.params : req.body;
    
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Return all validation errors
      allowUnknown: false, // Don't allow unknown fields
      stripUnknown: true, // Remove unknown fields
      convert: true // Convert strings to numbers, etc.
    });
    
    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors,
        timestamp: new Date().toISOString()
      });
    }
    
    // Replace the original data with validated and sanitized data
    if (location === 'body') req.body = value;
    else if (location === 'query') req.query = value;
    else if (location === 'params') req.params = value;
    
    next();
  };
};

// Export all schemas and validation middleware
module.exports = {
  schemas: {
    common: commonSchemas,
    user: userSchemas,
    content: contentSchemas,
    progress: progressSchemas,
    notification: notificationSchemas
  },
  validate: createValidationMiddleware,
  
  // Convenience methods for common validations
  validateBody: (schema) => createValidationMiddleware(schema, 'body'),
  validateQuery: (schema) => createValidationMiddleware(schema, 'query'),
  validateParams: (schema) => createValidationMiddleware(schema, 'params')
}; 