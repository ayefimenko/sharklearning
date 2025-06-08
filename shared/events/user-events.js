// Shared Event System for User-related events
// This enables loosely coupled communication between services

const EventEmitter = require('events');
const redis = require('redis');

class UserEventService extends EventEmitter {
  constructor() {
    super();
    this.redisClient = null;
    this.subscriber = null;
    this.publisher = null;
  }

  async connect(redisUrl = 'redis://redis:6379') {
    try {
      // Publisher for sending events
      this.publisher = redis.createClient({ url: redisUrl });
      await this.publisher.connect();

      // Subscriber for receiving events
      this.subscriber = redis.createClient({ url: redisUrl });
      await this.subscriber.connect();

      // Subscribe to user-related events
      await this.subscriber.subscribe('user-events', (message) => {
        try {
          const event = JSON.parse(message);
          this.emit(event.type, event.data);
        } catch (error) {
          console.error('Error parsing user event:', error);
        }
      });

      console.log('✅ User Event Service connected to Redis');
    } catch (error) {
      console.error('❌ Failed to connect User Event Service to Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.publisher) await this.publisher.disconnect();
    if (this.subscriber) await this.subscriber.disconnect();
  }

  // Publish user events
  async publishUserCreated(userData) {
    const event = {
      type: 'USER_CREATED',
      timestamp: new Date().toISOString(),
      data: {
        userId: userData.id,
        email: userData.email,
        role: userData.role,
        firstName: userData.firstName,
        lastName: userData.lastName,
        createdAt: userData.createdAt
      }
    };

    await this.publisher.publish('user-events', JSON.stringify(event));
    console.log('📤 Published USER_CREATED event:', event.data.userId);
  }

  async publishUserUpdated(userData) {
    const event = {
      type: 'USER_UPDATED',
      timestamp: new Date().toISOString(),
      data: {
        userId: userData.id,
        email: userData.email,
        role: userData.role,
        firstName: userData.firstName,
        lastName: userData.lastName,
        updatedAt: userData.updatedAt
      }
    };

    await this.publisher.publish('user-events', JSON.stringify(event));
    console.log('📤 Published USER_UPDATED event:', event.data.userId);
  }

  async publishUserDeleted(userId) {
    const event = {
      type: 'USER_DELETED',
      timestamp: new Date().toISOString(),
      data: {
        userId: userId
      }
    };

    await this.publisher.publish('user-events', JSON.stringify(event));
    console.log('📤 Published USER_DELETED event:', userId);
  }

  async publishUserLoggedIn(userData) {
    const event = {
      type: 'USER_LOGGED_IN',
      timestamp: new Date().toISOString(),
      data: {
        userId: userData.id,
        email: userData.email,
        role: userData.role,
        sessionId: userData.sessionId,
        ipAddress: userData.ipAddress
      }
    };

    await this.publisher.publish('user-events', JSON.stringify(event));
    console.log('📤 Published USER_LOGGED_IN event:', event.data.userId);
  }

  async publishUserRoleChanged(userId, oldRole, newRole) {
    const event = {
      type: 'USER_ROLE_CHANGED',
      timestamp: new Date().toISOString(),
      data: {
        userId: userId,
        oldRole: oldRole,
        newRole: newRole
      }
    };

    await this.publisher.publish('user-events', JSON.stringify(event));
    console.log('📤 Published USER_ROLE_CHANGED event:', userId);
  }
}

module.exports = UserEventService; 