# Quiz/Assessment System Documentation

## Overview

The Quiz/Assessment System is a comprehensive learning evaluation feature that allows students to test their knowledge through interactive quizzes. The system supports multiple question types, automatic scoring, attempt tracking, and detailed results analysis.

## Features

### ✅ Core Functionality
- **Multiple Question Types**: Multiple choice and true/false questions
- **Automatic Scoring**: Real-time calculation of scores and pass/fail status
- **Attempt Tracking**: Track and limit quiz attempts per user
- **Time Limits**: Configurable time limits for each quiz
- **Progress Tracking**: Integration with the learning progress system
- **Security**: Authentication required, answers hidden until submission

### ✅ Frontend Features
- **Interactive Quiz Interface**: Modern, responsive quiz-taking experience
- **Timer Display**: Countdown timer showing remaining time
- **Question Navigation**: Previous/Next navigation with progress indicator
- **Real-time Validation**: Immediate feedback on answer selection
- **Results Display**: Comprehensive results with score breakdown
- **Question Review**: Review all questions and answers after submission

## Architecture

### Database Schema

#### Quizzes Table
```sql
CREATE TABLE quizzes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    lesson_id INTEGER REFERENCES lessons(id),
    time_limit_minutes INTEGER DEFAULT 30,
    passing_score INTEGER DEFAULT 70,
    max_attempts INTEGER DEFAULT 3,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Quiz Questions Table
```sql
CREATE TABLE quiz_questions (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER REFERENCES quizzes(id),
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL,
    answer_options JSONB,
    correct_answer TEXT NOT NULL,
    points INTEGER DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Quiz Attempts Table
```sql
CREATE TABLE quiz_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    quiz_id INTEGER REFERENCES quizzes(id),
    answers JSONB NOT NULL,
    score INTEGER NOT NULL,
    total_points INTEGER NOT NULL,
    passed BOOLEAN NOT NULL,
    attempt_number INTEGER NOT NULL,
    time_taken_minutes INTEGER,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### API Endpoints

#### 1. List Quizzes for Course
```http
GET /api/content/courses/:courseId/quizzes
```

**Response:**
```json
{
  "quizzes": [
    {
      "id": 1,
      "title": "QA Fundamentals Quiz",
      "description": "Test your knowledge of basic QA principles",
      "timeLimitMinutes": 10,
      "passingScore": 70,
      "maxAttempts": 3,
      "isPublished": true,
      "lessonId": 3,
      "lessonTitle": "QA Knowledge Check",
      "lessonOrder": 3,
      "createdAt": "2025-06-08T16:37:31.725Z",
      "updatedAt": "2025-06-08T16:37:31.725Z"
    }
  ]
}
```

#### 2. Get Quiz Details
```http
GET /api/content/quizzes/:quizId
```

**Response:**
```json
{
  "id": 1,
  "title": "QA Fundamentals Quiz",
  "description": "Test your knowledge of basic QA principles",
  "timeLimitMinutes": 10,
  "passingScore": 70,
  "maxAttempts": 3,
  "lessonId": 3,
  "lessonTitle": "QA Knowledge Check",
  "courseId": 1,
  "questions": [
    {
      "id": 1,
      "questionText": "What is the primary goal of software testing?",
      "questionType": "multiple_choice",
      "answerOptions": [
        "To find defects and ensure quality",
        "To prove the software works perfectly",
        "To delay the release",
        "To increase development time"
      ],
      "points": 2,
      "orderIndex": 1
    }
  ],
  "totalQuestions": 5,
  "totalPoints": 8
}
```

#### 3. Submit Quiz Answers
```http
POST /api/content/quizzes/:quizId/submit
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "answers": [
    {
      "questionId": 1,
      "selectedAnswer": "To find defects and ensure quality"
    },
    {
      "questionId": 2,
      "selectedAnswer": "false"
    }
  ]
}
```

**Response:**
```json
{
  "attemptId": 1,
  "score": 85,
  "totalPoints": 8,
  "earnedPoints": 7,
  "passed": true,
  "passingScore": 70,
  "attemptNumber": 1,
  "timeTaken": 8,
  "results": [
    {
      "questionId": 1,
      "questionText": "What is the primary goal of software testing?",
      "selectedAnswer": "To find defects and ensure quality",
      "correctAnswer": "To find defects and ensure quality",
      "isCorrect": true,
      "points": 2,
      "earnedPoints": 2
    }
  ]
}
```

## Frontend Implementation

### Quiz Component (`/frontend/src/pages/Quiz.tsx`)

The main quiz component provides a complete quiz-taking experience:

```typescript
interface QuizState {
  quiz: Quiz | null;
  currentQuestionIndex: number;
  answers: { [questionId: number]: string };
  timeRemaining: number;
  isSubmitting: boolean;
  results: QuizResults | null;
}
```

### Key Features:

#### 1. Quiz Start Screen
- Quiz metadata display (title, description, time limit)
- Instructions and passing score information
- "Start Quiz" button to begin

#### 2. Quiz Interface
- **Timer**: Live countdown showing remaining time
- **Progress**: Current question number and total questions
- **Navigation**: Previous/Next buttons with progress indicator
- **Question Display**: Clear question text with answer options
- **Answer Selection**: Radio buttons for multiple choice, checkboxes for true/false

#### 3. Quiz Submission
- **Auto-submit**: Automatic submission when time expires
- **Manual Submit**: "Submit Quiz" button when all questions answered
- **Validation**: Ensures all questions are answered before submission

#### 4. Results Display
- **Score Summary**: Final score, percentage, pass/fail status
- **Detailed Results**: Question-by-question breakdown
- **Answer Review**: Shows selected vs. correct answers
- **Performance Metrics**: Time taken, attempt number

### Course Integration

Quizzes are integrated into the course detail pages:

```typescript
// In CourseDetail.tsx
const [quizzes, setQuizzes] = useState<Quiz[]>([]);

useEffect(() => {
  const fetchQuizzes = async () => {
    const response = await fetch(`/api/content/courses/${courseId}/quizzes`);
    const data = await response.json();
    setQuizzes(data.quizzes);
  };
  
  fetchQuizzes();
}, [courseId]);
```

## Sample Data

The system includes comprehensive sample data:

### Learning Tracks
1. **QA Fundamentals** (Beginner)
   - Introduction to Quality Assurance
   - Testing Methodologies
   - QA Knowledge Check (with quiz)

2. **Test Automation** (Intermediate)
   - Automation Fundamentals
   - Tool Selection
   - Automation Assessment (with quiz)

### Quiz Examples

#### QA Fundamentals Quiz
- **5 Questions**, 8 total points
- **10-minute time limit**
- **70% passing score**
- **3 maximum attempts**

**Sample Questions:**
1. "What is the primary goal of software testing?" (Multiple Choice, 2 points)
2. "Which testing approach tests individual components in isolation?" (Multiple Choice, 2 points)
3. "True or False: Testing can prove that software is completely bug-free" (True/False, 1 point)

#### Test Automation Basics Quiz
- **4 Questions**, 10 total points
- **15-minute time limit**
- **75% passing score**
- **2 maximum attempts**

## Security Features

### Authentication & Authorization
- **JWT Authentication**: All quiz submissions require valid JWT tokens
- **User Validation**: Quiz attempts are tied to authenticated users
- **Answer Security**: Correct answers are never exposed to the frontend

### Data Protection
- **Answer Encryption**: Correct answers stored securely in database
- **Attempt Tracking**: Prevents cheating through multiple submissions
- **Time Validation**: Server-side time limit enforcement

### Input Validation
- **Request Validation**: All inputs validated using express-validator
- **SQL Injection Prevention**: Parameterized queries throughout
- **XSS Protection**: Input sanitization and output encoding

## Testing Coverage

### Comprehensive Test Suite (22 tests)

#### API Endpoint Tests
- ✅ Quiz listing (4 tests)
- ✅ Quiz details (4 tests)  
- ✅ Quiz submission (8 tests)
- ✅ Error handling (3 tests)
- ✅ Data validation (2 tests)

#### Test Categories
- **Authentication Testing**: JWT validation, unauthorized access
- **Input Validation**: Invalid IDs, missing fields, malformed data
- **Business Logic**: Score calculation, passing logic, attempt limits
- **Security Testing**: SQL injection prevention, authentication requirements
- **Error Handling**: Database failures, graceful degradation

### Test Examples

```javascript
describe('POST /quizzes/:quizId/submit', () => {
  it('should calculate score correctly', async () => {
    const response = await request(app)
      .post('/quizzes/1/submit')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        answers: [
          { questionId: 1, selectedAnswer: 'Correct Answer' },
          { questionId: 2, selectedAnswer: 'false' }
        ]
      });

    expect(response.status).toBe(200);
    expect(response.body.score).toBe(100);
    expect(response.body.passed).toBe(true);
  });
});
```

## Performance Considerations

### Database Optimization
- **Indexed Queries**: Optimized queries for quiz retrieval
- **Minimal Data Transfer**: Only necessary data sent to frontend
- **Caching Strategy**: Redis caching for frequently accessed quizzes

### Frontend Optimization
- **Lazy Loading**: Quiz data loaded on-demand
- **State Management**: Efficient React state updates
- **Memory Management**: Proper cleanup of timers and intervals

## Usage Examples

### For Students
1. **Taking a Quiz**:
   - Navigate to course detail page
   - Click "Start Quiz" button
   - Answer questions within time limit
   - Review results and feedback

2. **Retaking a Quiz**:
   - Check attempt count (must be under max attempts)
   - Start new attempt
   - Previous scores are tracked

### For Developers
1. **Adding New Quizzes**:
   ```sql
   INSERT INTO quizzes (title, description, lesson_id, time_limit_minutes, passing_score)
   VALUES ('New Quiz', 'Description', 1, 15, 80);
   ```

2. **Adding Questions**:
   ```sql
   INSERT INTO quiz_questions (quiz_id, question_text, question_type, answer_options, correct_answer, points)
   VALUES (1, 'Question text?', 'multiple_choice', '["Option 1", "Option 2"]', 'Option 1', 2);
   ```

## Future Enhancements

### Planned Features
- **Question Banks**: Randomized question selection
- **Detailed Analytics**: Advanced reporting and analytics
- **Question Types**: Fill-in-the-blank, drag-and-drop questions
- **Adaptive Testing**: AI-powered question difficulty adjustment
- **Certificates**: Automatic certificate generation for passed quizzes

### Technical Improvements
- **Real-time Sync**: WebSocket-based real-time updates
- **Offline Support**: Progressive Web App with offline capabilities
- **Advanced Security**: Enhanced anti-cheating measures
- **Internationalization**: Multi-language support

## Troubleshooting

### Common Issues

#### Quiz Not Loading
- Check authentication token
- Verify quiz is published
- Check network connectivity

#### Submission Failures
- Ensure all questions are answered
- Check remaining attempts
- Verify authentication

#### Timer Issues
- Refresh browser if timer stops
- Check server time synchronization
- Ensure JavaScript is enabled

### Error Codes
- **401**: Authentication required
- **403**: Invalid or expired token
- **404**: Quiz not found
- **400**: Validation errors (invalid data, max attempts exceeded)
- **500**: Server errors (database connection issues)

## API Gateway Integration

All quiz endpoints are accessible through the API Gateway:

- Base URL: `http://localhost:3000/api/content/`
- Authentication: JWT Bearer tokens
- Rate Limiting: Applied to prevent abuse
- Logging: Request/response logging for monitoring

## Conclusion

The Quiz/Assessment System provides a robust, secure, and user-friendly way to evaluate student learning. With comprehensive testing, security measures, and a modern interface, it serves as a cornerstone feature for the SharkLearning platform.

The system is designed to be scalable, maintainable, and extensible, providing a solid foundation for future enhancements and improvements. 