# 🗄️ SharkLearning Database Schema

## Overview

SharkLearning uses PostgreSQL 15 as its primary database, designed to support a modern e-learning platform with user management, course content, progress tracking, and gamification features.

## 🏗️ Database Design Principles

- **Normalization**: Third normal form (3NF) for data integrity
- **Referential Integrity**: Foreign key constraints ensure data consistency
- **Indexing**: Strategic indexes for optimal query performance
- **Scalability**: Schema designed for horizontal scaling
- **Audit Trail**: Created/updated timestamps on all entities

---

## 📋 Tables Overview

| Table | Purpose | Records | Relationships |
|-------|---------|---------|---------------|
| `users` | User accounts and profiles | ~1K-10K | Parent to progress, achievements |
| `learning_tracks` | Course collections by topic | ~10-50 | Parent to courses |
| `courses` | Individual learning modules | ~100-500 | Child of tracks, parent to progress |
| `user_progress` | Student learning progress | ~10K-100K | Junction of users & courses |
| `achievements` | Gamification badges | ~20-50 | Parent to user_achievements |
| `user_achievements` | Earned badges by users | ~1K-50K | Junction of users & achievements |
| `notifications` | User notifications | ~10K-100K | Child of users |

---

## 👤 Users Table

Stores user account information and profiles.

```sql
CREATE TABLE users (
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
```

### Fields Description
- **id**: Primary key, auto-incrementing
- **email**: Unique identifier for login (indexed)
- **password_hash**: Bcrypt hashed password (12 rounds)
- **first_name/last_name**: User display names
- **role**: `'student'` | `'admin'` | `'instructor'`
- **profile_image**: URL to user avatar
- **is_active**: Soft delete flag
- **timestamps**: Audit trail

### Indexes
```sql
CREATE INDEX idx_users_email ON users(email);
```

---

## 📚 Learning Tracks Table

Collections of related courses organized by learning paths.

```sql
CREATE TABLE learning_tracks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty_level VARCHAR(50) DEFAULT 'beginner',
    estimated_hours INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Fields Description
- **id**: Primary key, auto-incrementing
- **title**: Track name (e.g., "QA Fundamentals")
- **description**: Detailed track description
- **difficulty_level**: `'beginner'` | `'intermediate'` | `'advanced'`
- **estimated_hours**: Total time to complete
- **is_published**: Visibility flag for students

### Sample Data
```sql
INSERT INTO learning_tracks (title, description, difficulty_level, estimated_hours, is_published) VALUES
('QA Fundamentals', 'Learn the basics of software testing and quality assurance', 'beginner', 20, true),
('Test Automation Basics', 'Introduction to automated testing tools and frameworks', 'intermediate', 30, true),
('Advanced Testing Strategies', 'Advanced techniques for comprehensive software testing', 'advanced', 40, false);
```

---

## 📖 Courses Table

Individual learning modules within tracks.

```sql
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    track_id INTEGER REFERENCES learning_tracks(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT,
    order_index INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Fields Description
- **id**: Primary key, auto-incrementing
- **track_id**: Foreign key to learning_tracks
- **title**: Course name
- **description**: Course summary
- **content**: Full course content (markdown/HTML)
- **order_index**: Sequence within track
- **is_published**: Visibility flag

### Indexes
```sql
CREATE INDEX idx_courses_track_id ON courses(track_id);
```

---

## 📊 User Progress Table

Tracks student progress through courses.

```sql
CREATE TABLE user_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    track_id INTEGER REFERENCES learning_tracks(id) ON DELETE CASCADE,
    progress_percentage INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, course_id)
);
```

### Fields Description
- **id**: Primary key, auto-incrementing
- **user_id**: Foreign key to users
- **course_id**: Foreign key to courses
- **track_id**: Denormalized for efficient queries
- **progress_percentage**: 0-100 completion percentage
- **is_completed**: Boolean completion flag
- **started_at**: When user first accessed course
- **completed_at**: When user finished course
- **UNIQUE constraint**: Prevents duplicate progress records

### Indexes
```sql
CREATE INDEX idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX idx_user_progress_course_id ON user_progress(course_id);
```

---

## 🏆 Achievements Table

Gamification badges and rewards.

```sql
CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    badge_icon VARCHAR(255),
    points INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Fields Description
- **id**: Primary key, auto-incrementing
- **title**: Achievement name
- **description**: What triggers this achievement
- **badge_icon**: Emoji or icon identifier
- **points**: Points awarded for earning this badge

### Sample Data
```sql
INSERT INTO achievements (title, description, badge_icon, points) VALUES
('First Steps', 'Complete your first course', '🎯', 10),
('Speed Learner', 'Complete a course in under 2 hours', '⚡', 25),
('Perfectionist', 'Score 100% on 5 quizzes', '💯', 50),
('Track Master', 'Complete an entire learning track', '🏆', 100);
```

---

## 🎖️ User Achievements Table

Junction table for user-earned achievements.

```sql
CREATE TABLE user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_id)
);
```

### Fields Description
- **id**: Primary key, auto-incrementing
- **user_id**: Foreign key to users
- **achievement_id**: Foreign key to achievements
- **earned_at**: When achievement was unlocked
- **UNIQUE constraint**: Prevents duplicate achievements

---

## 🔔 Notifications Table

User notification system.

```sql
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Fields Description
- **id**: Primary key, auto-incrementing
- **user_id**: Foreign key to users
- **title**: Notification headline
- **message**: Detailed notification content
- **type**: `'info'` | `'success'` | `'warning'` | `'error'`
- **is_read**: User interaction flag

### Indexes
```sql
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
```

---

## 🔗 Entity Relationships

### ERD Overview
```
Users (1) ──────────── (M) User_Progress (M) ──────────── (1) Courses
  │                                                          │
  │                                                          │
  └── (1) ──────────── (M) User_Achievements                 │
            │                                                │
            │                                                │
            └── (M) ──────────── (1) Achievements            │
                                                             │
                                                             │
Learning_Tracks (1) ──────────────────────────────────── (M) ┘

Users (1) ──────────── (M) Notifications
```

### Relationship Details

**Users → User_Progress** (1:M)
- One user can have progress on many courses
- Cascade delete: Removing user removes all progress

**Courses → User_Progress** (1:M)  
- One course can be taken by many users
- Cascade delete: Removing course removes all progress

**Learning_Tracks → Courses** (1:M)
- One track contains many courses
- Cascade delete: Removing track removes all courses

**Users → User_Achievements** (1:M)
- One user can earn many achievements
- Cascade delete: Removing user removes achievements

**Achievements → User_Achievements** (1:M)
- One achievement can be earned by many users
- Cascade delete: Removing achievement removes user records

---

## 🚀 Performance Optimization

### Index Strategy
- **Primary Keys**: Automatic B-tree indexes
- **Foreign Keys**: Indexed for join performance
- **Unique Constraints**: Automatically indexed
- **Query-Specific**: Email lookup, user progress queries

### Query Patterns
```sql
-- Most common queries optimized:

-- User login
SELECT * FROM users WHERE email = ? AND is_active = true;

-- User progress overview
SELECT COUNT(*) as completed FROM user_progress 
WHERE user_id = ? AND is_completed = true;

-- Course progress
SELECT * FROM user_progress 
WHERE user_id = ? AND course_id = ?;

-- Leaderboard
SELECT u.*, SUM(a.points) as total_points 
FROM users u 
LEFT JOIN user_achievements ua ON u.id = ua.user_id
LEFT JOIN achievements a ON ua.achievement_id = a.id
GROUP BY u.id ORDER BY total_points DESC;
```

### Connection Pooling
- **Pool Size**: 10-20 connections per service
- **Idle Timeout**: 30 seconds
- **Max Lifetime**: 1 hour

---

## 🛡️ Security Considerations

### Data Protection
- **Password Hashing**: Bcrypt with 12 rounds
- **Parameterized Queries**: SQL injection prevention
- **Input Validation**: All fields validated before DB operations
- **Soft Deletes**: `is_active` flag instead of hard deletes

### Access Control
- **Connection Security**: SSL/TLS in production
- **Least Privilege**: Service-specific database users
- **Audit Logging**: Timestamps on all operations

---

## 📈 Scaling Considerations

### Horizontal Scaling
- **Read Replicas**: Query distribution for read-heavy workloads
- **Sharding**: User-based sharding for massive scale
- **Connection Pooling**: Efficient connection management

### Data Archival
- **Progress History**: Archive old progress records
- **Notification Cleanup**: Auto-delete old notifications
- **User Inactivity**: Archive inactive user data

### Monitoring
- **Query Performance**: Track slow queries
- **Index Usage**: Monitor index effectiveness
- **Connection Health**: Pool utilization metrics 