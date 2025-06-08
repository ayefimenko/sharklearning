-- Content Service Database Initialization  
-- This database contains learning content and course-related data

-- Learning tracks table
CREATE TABLE IF NOT EXISTS learning_tracks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty_level VARCHAR(50) DEFAULT 'beginner',
    estimated_hours INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT false,
    created_by_user_id INTEGER NOT NULL, -- Reference to user, stored as ID only
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    track_id INTEGER REFERENCES learning_tracks(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT,
    order_index INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT false,
    estimated_minutes INTEGER DEFAULT 0,
    difficulty_level VARCHAR(50) DEFAULT 'beginner',
    created_by_user_id INTEGER NOT NULL, -- Reference to user, stored as ID only
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Course lessons/modules
CREATE TABLE IF NOT EXISTS lessons (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    order_index INTEGER DEFAULT 0,
    lesson_type VARCHAR(50) DEFAULT 'text', -- text, video, quiz, assignment
    duration_minutes INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quizzes and assessments
CREATE TABLE IF NOT EXISTS quizzes (
    id SERIAL PRIMARY KEY,
    lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    time_limit_minutes INTEGER,
    passing_score INTEGER DEFAULT 70,
    max_attempts INTEGER DEFAULT 3,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quiz questions
CREATE TABLE IF NOT EXISTS quiz_questions (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) DEFAULT 'multiple_choice', -- multiple_choice, true_false, text
    correct_answer TEXT,
    answer_options JSONB, -- For multiple choice options
    points INTEGER DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    badge_icon VARCHAR(255),
    points INTEGER DEFAULT 0,
    achievement_type VARCHAR(50) DEFAULT 'course_completion', -- course_completion, quiz_score, time_based
    criteria JSONB, -- Flexible criteria for earning achievement
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tags for content organization
CREATE TABLE IF NOT EXISTS content_tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7), -- Hex color code
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Many-to-many relationship between content and tags
CREATE TABLE IF NOT EXISTS track_tags (
    track_id INTEGER REFERENCES learning_tracks(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES content_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (track_id, tag_id)
);

CREATE TABLE IF NOT EXISTS course_tags (
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES content_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (course_id, tag_id)
);

-- Insert initial learning tracks for QA engineers
INSERT INTO learning_tracks (title, description, difficulty_level, estimated_hours, is_published, created_by_user_id) VALUES
('QA Fundamentals', 'Learn the basics of software testing and quality assurance', 'beginner', 20, true, 1),
('Test Automation Basics', 'Introduction to automated testing tools and frameworks', 'intermediate', 30, true, 1),
('Advanced Testing Strategies', 'Advanced techniques for comprehensive software testing', 'advanced', 40, false, 1);

-- Insert sample achievements
INSERT INTO achievements (title, description, badge_icon, points) VALUES
('First Steps', 'Complete your first course', '🎯', 10),
('Speed Learner', 'Complete a course in under 2 hours', '⚡', 25),
('Perfectionist', 'Score 100% on 5 quizzes', '💯', 50),
('Track Master', 'Complete an entire learning track', '🏆', 100);

-- Insert content tags
INSERT INTO content_tags (name, description, color) VALUES
('QA Testing', 'Quality Assurance and Testing', '#3B82F6'),
('Automation', 'Test Automation Tools and Frameworks', '#10B981'),
('Manual Testing', 'Manual Testing Techniques', '#F59E0B'),
('Performance', 'Performance Testing', '#EF4444'),
('Security', 'Security Testing', '#8B5CF6');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_learning_tracks_published ON learning_tracks(is_published);
CREATE INDEX IF NOT EXISTS idx_learning_tracks_difficulty ON learning_tracks(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_courses_track_id ON courses(track_id);
CREATE INDEX IF NOT EXISTS idx_courses_published ON courses(is_published);
CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_order ON lessons(order_index);
CREATE INDEX IF NOT EXISTS idx_quizzes_lesson_id ON quizzes(lesson_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_achievements_type ON achievements(achievement_type);
CREATE INDEX IF NOT EXISTS idx_content_tags_name ON content_tags(name); 