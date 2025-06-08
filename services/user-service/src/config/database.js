// Database Configuration with Secrets Manager Integration
const { Pool } = require('pg');
const { getDatabaseUrl } = require('../../../../shared/security/secrets-manager');
const { logger } = require('../../../../shared/utils/logger');

let pool = null;

async function initializeDatabase() {
  try {
    // Get database URL from secrets manager
    const databaseUrl = await getDatabaseUrl('user') || process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('Database URL not found in secrets manager or environment variables');
    }

    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
      connectionTimeoutMillis: 2000, // How long to wait for a connection
    });

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    logger.info('Database connection initialized successfully', {
      service: 'user-service',
      database: 'user_service_db'
    });

    return pool;
  } catch (error) {
    logger.error('Failed to initialize database connection', {
      service: 'user-service',
      error: error.message
    });
    throw error;
  }
}

function getPool() {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection closed', { service: 'user-service' });
  }
}

// Health check function
async function checkDatabaseHealth() {
  try {
    if (!pool) {
      return { status: 'unhealthy', error: 'Database not initialized' };
    }

    const client = await pool.connect();
    const start = Date.now();
    await client.query('SELECT 1');
    const duration = Date.now() - start;
    client.release();

    return {
      status: 'healthy',
      responseTime: `${duration}ms`,
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingConnections: pool.waitingCount
    };
  } catch (error) {
    logger.error('Database health check failed', {
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
  initializeDatabase,
  getPool,
  closeDatabase,
  checkDatabaseHealth
}; 