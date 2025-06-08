// Secrets Management System
// Provides secure secret storage, retrieval, and rotation capabilities

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');

class SecretsManager {
  constructor(options = {}) {
    this.encryptionKey = options.encryptionKey || this.generateEncryptionKey();
    this.secretsPath = options.secretsPath || path.join(process.cwd(), '.secrets');
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.defaultTTL = options.defaultTTL || 300000; // 5 minutes
    this.rotationInterval = options.rotationInterval || 86400000; // 24 hours
    
    // Initialize secrets directory
    this.initializeSecretsDirectory();
  }

  async initializeSecretsDirectory() {
    try {
      await fs.mkdir(this.secretsPath, { recursive: true, mode: 0o700 });
      logger.info('Secrets directory initialized', { path: this.secretsPath });
    } catch (error) {
      logger.error('Failed to initialize secrets directory', { error: error.message });
      throw error;
    }
  }

  generateEncryptionKey() {
    // In production, this should come from a secure key management service
    const envKey = process.env.SECRETS_ENCRYPTION_KEY;
    if (envKey) {
      return Buffer.from(envKey, 'hex');
    }
    
    // Generate a new key (should be persisted securely in production)
    const key = crypto.randomBytes(32);
    logger.warn('Generated new encryption key - ensure this is persisted securely');
    return key;
  }

  encrypt(plaintext) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      algorithm: 'aes-256-cbc'
    };
  }

  decrypt(encryptedData) {
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  async storeSecret(key, value, options = {}) {
    try {
      const metadata = {
        createdAt: new Date().toISOString(),
        ttl: options.ttl || this.defaultTTL,
        rotationRequired: options.rotationRequired || false,
        lastRotated: new Date().toISOString(),
        version: 1
      };

      const secretData = {
        value,
        metadata
      };

      const encrypted = this.encrypt(JSON.stringify(secretData));
      const filePath = path.join(this.secretsPath, `${key}.enc`);
      
      await fs.writeFile(filePath, JSON.stringify(encrypted), { mode: 0o600 });
      
      // Update cache
      this.cache.set(key, value);
      this.cacheExpiry.set(key, Date.now() + metadata.ttl);
      
      logger.info('Secret stored successfully', { 
        key, 
        hasRotation: options.rotationRequired,
        ttl: metadata.ttl 
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to store secret', { key, error: error.message });
      throw error;
    }
  }

  async getSecret(key, options = {}) {
    try {
      // Check cache first
      if (this.cache.has(key) && this.cacheExpiry.get(key) > Date.now()) {
        logger.debug('Secret retrieved from cache', { key });
        return this.cache.get(key);
      }

      const filePath = path.join(this.secretsPath, `${key}.enc`);
      
      try {
        const encryptedData = JSON.parse(await fs.readFile(filePath, 'utf8'));
        const decryptedData = JSON.parse(this.decrypt(encryptedData));
        
        // Check if secret has expired
        const expiryTime = new Date(decryptedData.metadata.createdAt).getTime() + decryptedData.metadata.ttl;
        if (Date.now() > expiryTime && !options.ignoreExpiry) {
          logger.warn('Secret has expired', { key, expiredAt: new Date(expiryTime) });
          return null;
        }

        // Update cache
        this.cache.set(key, decryptedData.value);
        this.cacheExpiry.set(key, Date.now() + decryptedData.metadata.ttl);
        
        logger.debug('Secret retrieved successfully', { key });
        return decryptedData.value;
        
      } catch (fileError) {
        if (fileError.code === 'ENOENT') {
          logger.warn('Secret not found', { key });
          return null;
        }
        throw fileError;
      }
    } catch (error) {
      logger.error('Failed to retrieve secret', { key, error: error.message });
      throw error;
    }
  }

  async rotateSecret(key, newValue) {
    try {
      const existingSecret = await this.getSecret(key, { ignoreExpiry: true });
      if (!existingSecret) {
        throw new Error(`Secret ${key} not found for rotation`);
      }

      // Store old secret with backup suffix
      const backupKey = `${key}_backup_${Date.now()}`;
      await this.storeSecret(backupKey, existingSecret, { ttl: 86400000 }); // 24h backup retention
      
      // Store new secret
      await this.storeSecret(key, newValue, { rotationRequired: false });
      
      logger.info('Secret rotated successfully', { key, backupKey });
      return true;
    } catch (error) {
      logger.error('Failed to rotate secret', { key, error: error.message });
      throw error;
    }
  }

  async deleteSecret(key) {
    try {
      const filePath = path.join(this.secretsPath, `${key}.enc`);
      await fs.unlink(filePath);
      
      // Remove from cache
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      
      logger.info('Secret deleted successfully', { key });
      return true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Failed to delete secret', { key, error: error.message });
        throw error;
      }
      logger.warn('Secret not found for deletion', { key });
      return false;
    }
  }

  async listSecrets() {
    try {
      const files = await fs.readdir(this.secretsPath);
      const secrets = files
        .filter(file => file.endsWith('.enc'))
        .map(file => file.replace('.enc', ''));
      
      logger.debug('Listed secrets', { count: secrets.length });
      return secrets;
    } catch (error) {
      logger.error('Failed to list secrets', { error: error.message });
      throw error;
    }
  }

  async healthCheck() {
    try {
      // Test encryption/decryption
      const testData = 'health-check-' + Date.now();
      const encrypted = this.encrypt(testData);
      const decrypted = this.decrypt(encrypted);
      
      if (decrypted !== testData) {
        throw new Error('Encryption/decryption test failed');
      }

      // Check secrets directory
      await fs.access(this.secretsPath);
      
      return {
        status: 'healthy',
        encryption: 'operational',
        secretsDirectory: 'accessible',
        cacheSize: this.cache.size,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Secrets manager health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Cleanup expired cache entries
  cleanupCache() {
    const now = Date.now();
    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (expiry <= now) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
    logger.debug('Cache cleanup completed', { remainingEntries: this.cache.size });
  }

  // Start background tasks
  startBackgroundTasks() {
    // Cache cleanup every 5 minutes
    setInterval(() => {
      this.cleanupCache();
    }, 300000);

    logger.info('Secrets manager background tasks started');
  }
}

// Singleton instance
let secretsManagerInstance = null;

function getSecretsManager(options = {}) {
  if (!secretsManagerInstance) {
    secretsManagerInstance = new SecretsManager(options);
    secretsManagerInstance.startBackgroundTasks();
  }
  return secretsManagerInstance;
}

// Convenience functions for common secrets
async function getDatabaseUrl(serviceName) {
  const secretsManager = getSecretsManager();
  return await secretsManager.getSecret(`database_url_${serviceName}`);
}

async function getJWTSecret() {
  const secretsManager = getSecretsManager();
  return await secretsManager.getSecret('jwt_secret');
}

async function getRedisUrl() {
  const secretsManager = getSecretsManager();
  return await secretsManager.getSecret('redis_url');
}

async function getEncryptionKey(purpose) {
  const secretsManager = getSecretsManager();
  return await secretsManager.getSecret(`encryption_key_${purpose}`);
}

module.exports = {
  SecretsManager,
  getSecretsManager,
  getDatabaseUrl,
  getJWTSecret,
  getRedisUrl,
  getEncryptionKey
}; 