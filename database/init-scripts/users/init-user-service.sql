-- User Service Database Initialization
-- This database contains only user-related data

-- Users table (core user service domain)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'student',
    profile_image VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions for authentication tracking
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User profiles for extended user information
CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    phone_number VARCHAR(20),
    date_of_birth DATE,
    country VARCHAR(100),
    timezone VARCHAR(50),
    language VARCHAR(10) DEFAULT 'en',
    notification_preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert test users for development and testing
-- Password for all test users is: TestPass123!
INSERT INTO users (email, password_hash, first_name, last_name, role, is_active) VALUES
('admin@sharklearning.com', '$2a$12$3sTiPh1kQsienq8AD0wpFuoxhJPHr3IZJRQsqlVGQVDmVc4IlgqTu', 'Admin', 'User', 'admin', true),
('instructor@sharklearning.com', '$2a$12$3sTiPh1kQsienq8AD0wpFuoxhJPHr3IZJRQsqlVGQVDmVc4IlgqTu', 'Instructor', 'Demo', 'instructor', true),
('student@sharklearning.com', '$2a$12$3sTiPh1kQsienq8AD0wpFuoxhJPHr3IZJRQsqlVGQVDmVc4IlgqTu', 'Student', 'Demo', 'student', true),
('john.doe@example.com', '$2a$12$3sTiPh1kQsienq8AD0wpFuoxhJPHr3IZJRQsqlVGQVDmVc4IlgqTu', 'John', 'Doe', 'student', true),
('jane.smith@example.com', '$2a$12$3sTiPh1kQsienq8AD0wpFuoxhJPHr3IZJRQsqlVGQVDmVc4IlgqTu', 'Jane', 'Smith', 'student', true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token); 