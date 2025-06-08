#!/usr/bin/env node
// Secrets Initialization Script
// Securely initialize all application secrets

const { getSecretsManager } = require('../shared/security/secrets-manager');
const crypto = require('crypto');

async function initializeSecrets() {
  console.log('🔐 Initializing SharkLearning Secrets...');
  
  const secretsManager = getSecretsManager();
  
  try {
    // Generate strong secrets
    const jwtSecret = crypto.randomBytes(64).toString('hex');
    const userDbPassword = process.env.POSTGRES_PASSWORD || 'secure_postgres_password_2024';
    const contentDbPassword = process.env.POSTGRES_PASSWORD || 'secure_postgres_password_2024';
    const progressDbPassword = process.env.POSTGRES_PASSWORD || 'secure_postgres_password_2024';
    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    
    // Encryption keys for different purposes
    const sessionEncryptionKey = crypto.randomBytes(32).toString('hex');
    const dataEncryptionKey = crypto.randomBytes(32).toString('hex');
    const backupEncryptionKey = crypto.randomBytes(32).toString('hex');
    
    // API keys and external service secrets
    const internalApiKey = crypto.randomBytes(32).toString('hex');
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    
    // Store all secrets with appropriate TTL and rotation settings
    const secrets = [
      // Core application secrets
      { key: 'jwt_secret', value: jwtSecret, ttl: 2592000000, rotationRequired: true }, // 30 days
      
      // Database connection strings
      { 
        key: 'database_url_user', 
        value: `postgresql://postgres:${userDbPassword}@postgres-user:5432/user_service_db`,
        ttl: 86400000, // 24 hours
        rotationRequired: false 
      },
      { 
        key: 'database_url_content', 
        value: `postgresql://postgres:${contentDbPassword}@postgres-content:5432/content_service_db`,
        ttl: 86400000,
        rotationRequired: false 
      },
      { 
        key: 'database_url_progress', 
        value: `postgresql://postgres:${progressDbPassword}@postgres-progress:5432/progress_service_db`,
        ttl: 86400000,
        rotationRequired: false 
      },
      
      // Redis connection
      { key: 'redis_url', value: redisUrl, ttl: 86400000, rotationRequired: false },
      
      // Encryption keys
      { key: 'encryption_key_session', value: sessionEncryptionKey, ttl: 604800000, rotationRequired: true }, // 7 days
      { key: 'encryption_key_data', value: dataEncryptionKey, ttl: 2592000000, rotationRequired: true }, // 30 days
      { key: 'encryption_key_backup', value: backupEncryptionKey, ttl: 2592000000, rotationRequired: true },
      
      // API and webhook secrets
      { key: 'internal_api_key', value: internalApiKey, ttl: 604800000, rotationRequired: true }, // 7 days
      { key: 'webhook_secret', value: webhookSecret, ttl: 2592000000, rotationRequired: true },
      
      // Service-specific secrets
      { key: 'user_service_secret', value: crypto.randomBytes(32).toString('hex'), ttl: 86400000 },
      { key: 'content_service_secret', value: crypto.randomBytes(32).toString('hex'), ttl: 86400000 },
      { key: 'progress_service_secret', value: crypto.randomBytes(32).toString('hex'), ttl: 86400000 },
      { key: 'api_gateway_secret', value: crypto.randomBytes(32).toString('hex'), ttl: 86400000 },
      
      // External service configurations (placeholders for production)
      { key: 'email_service_api_key', value: 'placeholder_email_api_key', ttl: 2592000000 },
      { key: 'storage_service_key', value: 'placeholder_storage_key', ttl: 2592000000 },
      { key: 'monitoring_api_key', value: 'placeholder_monitoring_key', ttl: 2592000000 },
    ];
    
    console.log('📝 Storing secrets...');
    
    for (const secret of secrets) {
      await secretsManager.storeSecret(secret.key, secret.value, {
        ttl: secret.ttl,
        rotationRequired: secret.rotationRequired
      });
      console.log(`✅ Stored: ${secret.key}`);
    }
    
    // Verify all secrets were stored correctly
    console.log('\n🔍 Verifying secrets...');
    const storedSecrets = await secretsManager.listSecrets();
    console.log(`📊 Total secrets stored: ${storedSecrets.length}`);
    
    // Health check
    const healthStatus = await secretsManager.healthCheck();
    console.log('\n🏥 Health Check:', healthStatus);
    
    if (healthStatus.status === 'healthy') {
      console.log('\n🎉 All secrets initialized successfully!');
      console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
      console.log('   1. Secrets are encrypted and stored in .secrets/ directory');
      console.log('   2. Ensure .secrets/ is added to .gitignore');
      console.log('   3. In production, use external secret management (Vault, AWS Secrets Manager, etc.)');
      console.log('   4. Regularly rotate secrets with rotation flags');
      console.log('   5. Monitor secret access logs');
      
      return true;
    } else {
      throw new Error(`Health check failed: ${healthStatus.error}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize secrets:', error.message);
    process.exit(1);
  }
}

// CLI functionality
if (require.main === module) {
  initializeSecrets()
    .then(() => {
      console.log('\n✨ Secret initialization complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Secret initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeSecrets }; 