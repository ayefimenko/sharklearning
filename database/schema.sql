-- SharkLearning Database Schema
-- Complete schema for the e-learning platform

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'student',
    profile_image VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Learning tracks table
CREATE TABLE IF NOT EXISTS learning_tracks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty_level VARCHAR(50) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    estimated_hours INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT false,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User progress table
CREATE TABLE IF NOT EXISTS user_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    track_id INTEGER REFERENCES learning_tracks(id) ON DELETE CASCADE,
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    is_completed BOOLEAN DEFAULT false,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, course_id)
);

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    points INTEGER DEFAULT 0,
    criteria JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_courses_track_id ON courses(track_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_course_id ON user_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Insert sample learning tracks
INSERT INTO learning_tracks (title, description, difficulty_level, estimated_hours, is_published) VALUES
('QA Fundamentals', 'Learn the basics of software testing and quality assurance. Perfect for beginners starting their QA journey.', 'beginner', 20, true),
('Test Automation Basics', 'Introduction to automated testing tools and frameworks. Build your first automated test suites.', 'intermediate', 30, true),
('Advanced Testing Techniques', 'Master advanced testing methodologies, performance testing, and security testing.', 'advanced', 40, true)
ON CONFLICT DO NOTHING;

-- Insert sample courses for QA Fundamentals track
INSERT INTO courses (track_id, title, description, content, order_index, is_published) VALUES
(1, 'Introduction to Software Testing', 'Understanding the fundamentals of software testing and its importance in the development lifecycle.', 
'# Introduction to Software Testing

## What is Software Testing?

Software testing is the process of evaluating and verifying that a software application or system meets specified requirements and functions correctly. It involves executing software components using manual or automated tools to evaluate one or more properties of interest.

## Why is Testing Important?

1. **Quality Assurance**: Ensures the software meets quality standards
2. **Bug Detection**: Identifies defects before release
3. **User Satisfaction**: Improves user experience
4. **Cost Reduction**: Prevents expensive post-release fixes
5. **Risk Mitigation**: Reduces business and technical risks

## Types of Testing

### Functional Testing
- Unit Testing
- Integration Testing
- System Testing
- Acceptance Testing

### Non-Functional Testing
- Performance Testing
- Security Testing
- Usability Testing
- Compatibility Testing

## Testing Principles

1. **Testing shows presence of defects**: Testing can prove the presence of bugs but not their absence
2. **Exhaustive testing is impossible**: Testing everything is not feasible
3. **Early testing**: Start testing as early as possible in the development cycle
4. **Defect clustering**: Most defects are found in a small number of modules
5. **Pesticide paradox**: Repeating the same tests will not find new bugs
6. **Testing is context dependent**: Testing approach depends on the context
7. **Absence of errors fallacy**: Finding and fixing defects does not ensure system success

## Next Steps

In the next lesson, we will explore different testing methodologies and when to apply them.', 1, true),

(1, 'Testing Methodologies', 'Explore different testing approaches including black box, white box, and gray box testing.', 
'# Testing Methodologies

## Overview

Testing methodologies define the approach and strategy for testing software applications. Understanding different methodologies helps testers choose the right approach for different scenarios.

## Black Box Testing

Black box testing focuses on testing the functionality without knowledge of internal code structure.

### Characteristics:
- Tests based on requirements and specifications
- No knowledge of internal code structure
- Focus on input-output behavior
- User perspective testing

### Techniques:
- **Equivalence Partitioning**: Dividing inputs into equivalent groups
- **Boundary Value Analysis**: Testing at boundaries of input domains
- **Decision Table Testing**: Testing different combinations of conditions
- **State Transition Testing**: Testing state changes in the application

### Example:
Testing a login form:
- Valid username and password → Should login successfully
- Invalid username → Should show error message
- Empty fields → Should show validation errors

## White Box Testing

White box testing examines the internal structure and logic of the code.

### Characteristics:
- Requires knowledge of code structure
- Tests internal paths and logic
- Developer perspective testing
- Code coverage analysis

### Techniques:
- **Statement Coverage**: Every statement executed at least once
- **Branch Coverage**: Every branch taken at least once
- **Path Coverage**: Every possible path executed
- **Condition Coverage**: Every condition evaluated to true and false

## Gray Box Testing

Gray box testing combines black box and white box approaches.

### Characteristics:
- Limited knowledge of internal structure
- Combines functional and structural testing
- Integration testing approach
- Security testing applications

## When to Use Each Methodology

| Methodology | Best Used For | Advantages | Disadvantages |
|-------------|---------------|------------|---------------|
| Black Box | User acceptance, system testing | User-focused, no code knowledge needed | May miss internal errors |
| White Box | Unit testing, code review | Thorough code coverage | Requires programming knowledge |
| Gray Box | Integration testing, penetration testing | Balanced approach | Requires some technical knowledge |

## Practical Exercise

Try to identify which methodology would be best for testing:
1. A new user registration form
2. A sorting algorithm implementation
3. API integration between two systems
4. A mobile app''s user interface

## Summary

Understanding different testing methodologies helps you choose the right approach for different testing scenarios. Each methodology has its strengths and is suitable for different types of testing activities.', 2, true),

(1, 'Test Planning and Documentation', 'Learn how to create effective test plans, test cases, and maintain proper testing documentation.', 
'# Test Planning and Documentation

## Test Planning

A test plan is a detailed document that outlines the testing approach, objectives, schedule, and resources required for testing activities.

### Key Components of a Test Plan:

1. **Test Objectives**
   - What you want to achieve through testing
   - Success criteria
   - Quality goals

2. **Scope**
   - What will be tested (in-scope)
   - What will not be tested (out-of-scope)
   - Features and functionalities

3. **Test Approach**
   - Testing methodologies to be used
   - Types of testing to be performed
   - Tools and techniques

4. **Resources**
   - Team members and their roles
   - Hardware and software requirements
   - Budget and timeline

5. **Schedule**
   - Testing phases and milestones
   - Entry and exit criteria
   - Dependencies

6. **Risk Assessment**
   - Potential risks and mitigation strategies
   - Contingency plans

## Test Case Design

Test cases are detailed instructions that specify how to test a particular feature or functionality.

### Test Case Components:

- **Test Case ID**: Unique identifier
- **Test Case Title**: Brief description
- **Preconditions**: Setup required before execution
- **Test Steps**: Detailed steps to execute
- **Expected Results**: What should happen
- **Actual Results**: What actually happened
- **Status**: Pass/Fail/Blocked
- **Priority**: High/Medium/Low
- **Test Data**: Input data required

### Example Test Case:

```
Test Case ID: TC_LOGIN_001
Title: Verify successful login with valid credentials
Priority: High
Preconditions: User account exists in the system

Test Steps:
1. Navigate to login page
2. Enter valid username
3. Enter valid password
4. Click Login button

Expected Result: User should be redirected to dashboard

Test Data:
Username: testuser@example.com
Password: ValidPass123
```

## Documentation Best Practices

### 1. Clarity and Consistency
- Use clear, concise language
- Follow consistent formatting
- Avoid ambiguous terms

### 2. Traceability
- Link test cases to requirements
- Maintain requirement-test matrix
- Track coverage

### 3. Maintainability
- Keep documentation up-to-date
- Version control for documents
- Regular reviews and updates

### 4. Accessibility
- Store in centralized location
- Easy to search and navigate
- Proper access controls

## Test Execution and Reporting

### Test Execution Process:
1. **Environment Setup**: Prepare test environment
2. **Test Data Preparation**: Create or obtain test data
3. **Test Execution**: Run test cases systematically
4. **Defect Logging**: Report issues found
5. **Result Documentation**: Record outcomes

### Test Reports Should Include:
- Test execution summary
- Pass/fail statistics
- Defect summary
- Coverage metrics
- Recommendations

## Tools for Test Management

### Popular Tools:
- **Jira**: Issue tracking and test management
- **TestRail**: Dedicated test case management
- **Zephyr**: Test management for Jira
- **qTest**: Comprehensive test management
- **Azure DevOps**: Integrated development and testing

## Exercise: Create Your First Test Plan

Create a simple test plan for testing a calculator application:

1. Define test objectives
2. Identify scope (what functions to test)
3. List test cases for basic operations
4. Define success criteria

## Summary

Proper test planning and documentation are crucial for successful testing projects. They provide structure, ensure coverage, and facilitate communication among team members.

Good documentation practices lead to:
- Better test coverage
- Improved efficiency
- Easier maintenance
- Better communication
- Regulatory compliance', 3, true);

-- Insert sample courses for Test Automation track
INSERT INTO courses (track_id, title, description, content, order_index, is_published) VALUES
(2, 'Introduction to Test Automation', 'Understanding when and why to automate tests, and the benefits of test automation.', 
'# Introduction to Test Automation

## What is Test Automation?

Test automation is the practice of using software tools and scripts to execute tests automatically, rather than performing them manually. It involves creating automated test scripts that can run repeatedly without human intervention.

## Benefits of Test Automation

### 1. Efficiency and Speed
- Tests run faster than manual execution
- Can run 24/7 without breaks
- Parallel execution capabilities
- Immediate feedback

### 2. Reliability and Consistency
- Eliminates human error
- Consistent test execution
- Repeatable results
- Accurate reporting

### 3. Cost-Effectiveness
- Reduces long-term testing costs
- Frees up testers for exploratory testing
- Better ROI over time
- Scalable testing approach

### 4. Improved Coverage
- Can test more scenarios
- Better regression testing
- Cross-platform testing
- Load and performance testing

## When to Automate Tests

### Good Candidates for Automation:
- **Repetitive Tests**: Tests that run frequently
- **Regression Tests**: Tests that verify existing functionality
- **Data-Driven Tests**: Tests with multiple data sets
- **Load Tests**: Performance and stress testing
- **Cross-Browser Tests**: Testing across different browsers
- **API Tests**: Backend service testing

### Poor Candidates for Automation:
- **One-time Tests**: Tests that run only once
- **Exploratory Tests**: Ad-hoc testing scenarios
- **Usability Tests**: User experience testing
- **Tests with Frequent Changes**: Unstable requirements
- **Complex UI Tests**: Tests requiring human judgment

## Test Automation Pyramid

The test automation pyramid is a strategy that helps teams decide what types of tests to automate and in what proportion.

```
        /\
       /  \
      / UI \
     /______\
    /        \
   /   API    \
  /____________\
 /              \
/     UNIT       \
/________________\
```

### Unit Tests (Base)
- **70%** of automated tests
- Fast, reliable, cheap to maintain
- Test individual components
- Written by developers

### API/Integration Tests (Middle)
- **20%** of automated tests
- Test business logic
- Faster than UI tests
- More stable than UI tests

### UI Tests (Top)
- **10%** of automated tests
- End-to-end user scenarios
- Slower and more brittle
- High maintenance cost

## Types of Test Automation

### 1. Functional Automation
- UI automation (web, mobile, desktop)
- API automation
- Database testing
- Integration testing

### 2. Non-Functional Automation
- Performance testing
- Load testing
- Security testing
- Accessibility testing

### 3. Test Management Automation
- Test data generation
- Environment setup
- Test reporting
- Continuous integration

## Test Automation Tools

### Web Automation:
- **Selenium**: Most popular web automation framework
- **Cypress**: Modern JavaScript-based tool
- **Playwright**: Cross-browser automation
- **TestCafe**: No WebDriver needed

### Mobile Automation:
- **Appium**: Cross-platform mobile automation
- **Espresso**: Android native testing
- **XCUITest**: iOS native testing

### API Automation:
- **Postman**: API testing and automation
- **REST Assured**: Java-based API testing
- **Karate**: BDD-style API testing

### Performance Testing:
- **JMeter**: Load testing tool
- **LoadRunner**: Enterprise performance testing
- **Gatling**: High-performance load testing

## Getting Started with Automation

### Step 1: Choose the Right Tool
- Consider your application type
- Team skills and expertise
- Budget and licensing
- Integration requirements

### Step 2: Start Small
- Begin with simple, stable tests
- Focus on high-value scenarios
- Build confidence and expertise
- Gradually expand coverage

### Step 3: Establish Best Practices
- Create coding standards
- Implement page object model
- Use data-driven approaches
- Maintain test independence

### Step 4: Integrate with CI/CD
- Run tests automatically
- Get fast feedback
- Maintain test stability
- Monitor test results

## Common Challenges and Solutions

### Challenge: Flaky Tests
**Solution**: 
- Use explicit waits
- Implement retry mechanisms
- Improve test data management
- Regular test maintenance

### Challenge: High Maintenance
**Solution**:
- Use page object pattern
- Create reusable components
- Implement good locator strategies
- Regular refactoring

### Challenge: Slow Execution
**Solution**:
- Parallel execution
- Optimize test design
- Use headless browsers
- Better test environment

## Exercise: Automation Strategy

For a simple e-commerce website, identify:
1. 5 test cases that should be automated
2. 3 test cases that should remain manual
3. Justify your decisions

## Summary

Test automation is a powerful approach that can significantly improve testing efficiency and quality when applied correctly. Success depends on:

- Choosing the right tests to automate
- Using appropriate tools and frameworks
- Following best practices
- Continuous maintenance and improvement

Remember: Automation is not about replacing manual testing entirely, but about optimizing the overall testing strategy.', 1, true);

-- Insert sample achievements
INSERT INTO achievements (title, description, icon, points, criteria, is_active) VALUES
('First Steps', 'Complete your first course', '🎯', 100, '{"type": "course_completion", "count": 1}', true),
('Learning Streak', 'Complete 5 courses in a row', '🔥', 250, '{"type": "course_streak", "count": 5}', true),
('QA Expert', 'Complete all courses in QA Fundamentals track', '🏆', 500, '{"type": "track_completion", "track_id": 1}', true),
('Automation Master', 'Complete all courses in Test Automation track', '🤖', 750, '{"type": "track_completion", "track_id": 2}', true),
('Knowledge Seeker', 'Complete 10 courses total', '📚', 1000, '{"type": "total_courses", "count": 10}', true)
ON CONFLICT DO NOTHING; 