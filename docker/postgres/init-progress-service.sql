-- Progress Service Database Initialization
-- This database contains user progress tracking and analytics data

-- User progress table for course tracking
CREATE TABLE IF NOT EXISTS user_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL, -- Reference to user service, stored as ID only
    course_id INTEGER NOT NULL, -- Reference to content service, stored as ID only
    track_id INTEGER NOT NULL, -- Reference to content service, stored as ID only
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    is_completed BOOLEAN DEFAULT false,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_spent_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, course_id)
);

-- Lesson progress tracking
CREATE TABLE IF NOT EXISTS lesson_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL, -- Reference to content service
    course_id INTEGER NOT NULL, -- Reference to content service
    is_completed BOOLEAN DEFAULT false,
    time_spent_minutes INTEGER DEFAULT 0,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, lesson_id)
);

-- Quiz attempts and results
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    quiz_id INTEGER NOT NULL, -- Reference to content service
    lesson_id INTEGER NOT NULL, -- Reference to content service
    score_percentage INTEGER CHECK (score_percentage >= 0 AND score_percentage <= 100),
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    time_taken_minutes INTEGER,
    is_passed BOOLEAN DEFAULT false,
    attempt_number INTEGER DEFAULT 1,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quiz question responses
CREATE TABLE IF NOT EXISTS quiz_responses (
    id SERIAL PRIMARY KEY,
    attempt_id INTEGER REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL, -- Reference to content service
    user_answer TEXT,
    is_correct BOOLEAN,
    time_taken_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User achievements tracking
CREATE TABLE IF NOT EXISTS user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    achievement_id INTEGER NOT NULL, -- Reference to content service
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    points_earned INTEGER DEFAULT 0,
    related_course_id INTEGER, -- Optional: if achievement is course-specific
    related_quiz_id INTEGER,   -- Optional: if achievement is quiz-specific
    UNIQUE(user_id, achievement_id)
);

-- Learning streaks and habits
CREATE TABLE IF NOT EXISTS learning_streaks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    current_streak_days INTEGER DEFAULT 0,
    longest_streak_days INTEGER DEFAULT 0,
    last_activity_date DATE DEFAULT CURRENT_DATE,
    total_learning_days INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily learning activities for analytics
CREATE TABLE IF NOT EXISTS daily_learning_activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    activity_date DATE DEFAULT CURRENT_DATE,
    courses_accessed INTEGER DEFAULT 0,
    lessons_completed INTEGER DEFAULT 0,
    quizzes_taken INTEGER DEFAULT 0,
    time_spent_minutes INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, activity_date)
);

-- Learning goals and targets
CREATE TABLE IF NOT EXISTS learning_goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    goal_type VARCHAR(50) NOT NULL, -- daily_minutes, weekly_courses, monthly_tracks
    target_value INTEGER NOT NULL,
    current_value INTEGER DEFAULT 0,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    is_achieved BOOLEAN DEFAULT false,
    achieved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications related to progress (user-specific)
CREATE TABLE IF NOT EXISTS progress_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- achievement, goal_reminder, streak_milestone
    title VARCHAR(255) NOT NULL,
    message TEXT,
    related_entity_type VARCHAR(50), -- course, achievement, goal
    related_entity_id INTEGER,
    is_read BOOLEAN DEFAULT false,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Study sessions for detailed analytics
CREATE TABLE IF NOT EXISTS study_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    course_id INTEGER,
    lesson_id INTEGER,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    duration_minutes INTEGER,
    activities_completed INTEGER DEFAULT 0,
    device_type VARCHAR(50), -- web, mobile, tablet
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_course_id ON user_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_track_id ON user_progress(track_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_completed ON user_progress(is_completed);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_id ON lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson_id ON lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_course_id ON lesson_progress(course_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_completed_at ON quiz_attempts(completed_at);

CREATE INDEX IF NOT EXISTS idx_quiz_responses_attempt_id ON quiz_responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_question_id ON quiz_responses(question_id);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_earned_at ON user_achievements(earned_at);

CREATE INDEX IF NOT EXISTS idx_learning_streaks_user_id ON learning_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_streaks_last_activity ON learning_streaks(last_activity_date);

CREATE INDEX IF NOT EXISTS idx_daily_activities_user_id ON daily_learning_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_activities_date ON daily_learning_activities(activity_date);

CREATE INDEX IF NOT EXISTS idx_learning_goals_user_id ON learning_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_goals_active ON learning_goals(is_active);
CREATE INDEX IF NOT EXISTS idx_learning_goals_type ON learning_goals(goal_type);

CREATE INDEX IF NOT EXISTS idx_progress_notifications_user_id ON progress_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_notifications_read ON progress_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_progress_notifications_type ON progress_notifications(notification_type);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_started_at ON study_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_study_sessions_course_id ON study_sessions(course_id); 