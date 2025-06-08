-- Learning Paths and Curriculum Database Schema
-- This script adds advanced learning path functionality to the SharkLearning platform

-- Skills table - Define QA competencies and skills
CREATE TABLE IF NOT EXISTS skills (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    level_description JSONB,
    icon VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User skills table - Track individual skill levels
CREATE TABLE IF NOT EXISTS user_skills (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
    current_level VARCHAR(50) DEFAULT 'beginner',
    evidence_count INTEGER DEFAULT 0,
    last_improved TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, skill_id)
);

-- Learning paths table - Structured learning progressions
CREATE TABLE IF NOT EXISTS learning_paths (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_role VARCHAR(100),
    difficulty_progression JSONB,
    estimated_weeks INTEGER DEFAULT 12,
    skills_gained JSONB,
    is_published BOOLEAN DEFAULT false,
    is_certification_path BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Learning path items - Ordered content in learning paths
CREATE TABLE IF NOT EXISTS learning_path_items (
    id SERIAL PRIMARY KEY,
    learning_path_id INTEGER REFERENCES learning_paths(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL,
    content_id INTEGER NOT NULL,
    order_index INTEGER NOT NULL,
    is_optional BOOLEAN DEFAULT false,
    estimated_hours INTEGER DEFAULT 0,
    skills_focus JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(learning_path_id, content_type, content_id)
);

-- User learning paths - Track user enrollment in learning paths
CREATE TABLE IF NOT EXISTS user_learning_paths (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    learning_path_id INTEGER REFERENCES learning_paths(id) ON DELETE CASCADE,
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    current_item_id INTEGER REFERENCES learning_path_items(id),
    is_completed BOOLEAN DEFAULT false,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    estimated_completion DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, learning_path_id)
);

-- Certifications table - Define certification programs
CREATE TABLE IF NOT EXISTS certifications (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    learning_path_id INTEGER REFERENCES learning_paths(id),
    requirements JSONB,
    certificate_template VARCHAR(500),
    validity_months INTEGER DEFAULT 12,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_active ON skills(is_active);
CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_paths_target_role ON learning_paths(target_role);
CREATE INDEX IF NOT EXISTS idx_learning_paths_published ON learning_paths(is_published);
CREATE INDEX IF NOT EXISTS idx_learning_path_items_path_id ON learning_path_items(learning_path_id);
CREATE INDEX IF NOT EXISTS idx_user_learning_paths_user_id ON user_learning_paths(user_id);

-- Insert QA Skills
INSERT INTO skills (name, description, category, level_description, icon) VALUES
('Manual Testing', 'Ability to design and execute manual test cases effectively', 'technical', 
 '{"beginner": "Can execute basic test cases", "intermediate": "Can design comprehensive test scenarios", "advanced": "Can lead testing strategy and mentor others"}', '🧪'),
('Test Automation', 'Skills in automated testing tools and frameworks', 'technical',
 '{"beginner": "Basic scripting with automation tools", "intermediate": "Can build robust test frameworks", "advanced": "Can architect enterprise automation solutions"}', '🤖'),
('API Testing', 'Testing RESTful APIs and web services', 'technical',
 '{"beginner": "Can test APIs using tools like Postman", "intermediate": "Can write automated API tests", "advanced": "Can design comprehensive API testing strategies"}', '🔌'),
('Test Planning', 'Creating comprehensive test plans and strategies', 'methodologies',
 '{"beginner": "Can follow existing test plans", "intermediate": "Can create detailed test plans", "advanced": "Can design enterprise testing strategies"}', '📋'),
('Bug Reporting', 'Effective defect identification and documentation', 'methodologies',
 '{"beginner": "Can log basic bug reports", "intermediate": "Detailed bug analysis and reporting", "advanced": "Root cause analysis and prevention strategies"}', '🐛'),
('Selenium WebDriver', 'Web automation using Selenium', 'tools',
 '{"beginner": "Basic element interactions", "intermediate": "Page Object Model implementation", "advanced": "Framework architecture and optimization"}', '🌐')
ON CONFLICT (name) DO NOTHING;

-- Insert Learning Paths
INSERT INTO learning_paths (title, description, target_role, difficulty_progression, estimated_weeks, skills_gained, is_published, is_certification_path) VALUES
('Junior QA Engineer Track', 'Complete learning path from beginner to job-ready Junior QA Engineer', 'junior-qa',
 '{"start": "beginner", "end": "intermediate"}', 16,
 '[{"skill": "Manual Testing", "level": "intermediate"}, {"skill": "Test Planning", "level": "intermediate"}, {"skill": "Bug Reporting", "level": "intermediate"}]',
 true, true),
('QA Automation Engineer Track', 'Advanced path focusing on test automation and tools', 'automation-engineer',
 '{"start": "intermediate", "end": "advanced"}', 20,
 '[{"skill": "Test Automation", "level": "advanced"}, {"skill": "Selenium WebDriver", "level": "advanced"}, {"skill": "API Testing", "level": "intermediate"}]',
 true, true)
ON CONFLICT DO NOTHING;

-- Map learning path items (connecting existing tracks to learning paths)
INSERT INTO learning_path_items (learning_path_id, content_type, content_id, order_index, is_optional, estimated_hours, skills_focus) VALUES
-- Junior QA Engineer Track
(1, 'track', 1, 1, false, 20, '[1, 4, 5]'), -- QA Fundamentals -> Manual Testing, Test Planning, Bug Reporting
(1, 'track', 2, 2, false, 30, '[2, 6]'), -- Test Automation Basics -> Test Automation, Selenium

-- QA Automation Engineer Track  
(2, 'track', 2, 1, false, 30, '[2, 6]'), -- Test Automation Basics -> Test Automation, Selenium
(2, 'track', 3, 2, false, 40, '[3]') -- Advanced Testing -> API Testing
ON CONFLICT DO NOTHING;

-- Insert sample certifications
INSERT INTO certifications (title, description, learning_path_id, requirements, validity_months, is_active) VALUES
('Certified Junior QA Engineer', 'Industry-recognized certification for entry-level QA professionals', 1,
 '{"skills_required": [{"skill_id": 1, "min_level": "intermediate"}, {"skill_id": 4, "min_level": "intermediate"}], "courses_required": 2, "assessments_required": 3}',
 24, true),
('Certified QA Automation Specialist', 'Advanced certification for automation testing professionals', 2,
 '{"skills_required": [{"skill_id": 2, "min_level": "advanced"}, {"skill_id": 6, "min_level": "advanced"}], "practical_projects": 2}',
 18, true)
ON CONFLICT DO NOTHING;
