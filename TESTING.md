# 🧪 SharkLearning Testing Strategy

This document outlines the comprehensive testing strategy for the SharkLearning e-learning platform, covering all aspects from unit tests to end-to-end testing.

## 📋 Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Test Types](#test-types)
- [Project Structure](#project-structure)
- [Running Tests](#running-tests)
- [Backend Testing](#backend-testing)
- [Frontend Testing](#frontend-testing)
- [Integration Testing](#integration-testing)
- [Coverage Reports](#coverage-reports)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)

## 🎯 Testing Philosophy

Our testing strategy follows the **Test Pyramid** approach:

```
    /\
   /  \     E2E Tests (Few)
  /____\    - Critical user journeys
 /      \   - Cross-service integration
/________\  
Integration Tests (Some)
- API endpoints with real database
- Service-to-service communication

Unit Tests (Many)
- Individual functions and components
- Fast, isolated, reliable
```

### Goals

- **Maintain high code quality** with >80% test coverage
- **Catch bugs early** in the development cycle
- **Enable confident refactoring** with comprehensive regression testing
- **Document behavior** through well-written test cases
- **Support continuous deployment** with reliable automated testing

## 🔬 Test Types

### 1. Unit Tests
- **Purpose**: Test individual functions, methods, and components in isolation
- **Scope**: Single responsibility units
- **Speed**: Very fast (< 1ms per test)
- **Dependencies**: Mocked/stubbed

### 2. Integration Tests
- **Purpose**: Test interaction between components and services
- **Scope**: Multiple units working together
- **Speed**: Moderate (100ms - 1s per test)
- **Dependencies**: Real database, real services

### 3. E2E Tests
- **Purpose**: Test complete user workflows
- **Scope**: Full application stack
- **Speed**: Slow (1s - 10s per test)
- **Dependencies**: Full environment

### 4. Component Tests (Frontend)
- **Purpose**: Test React components with user interactions
- **Scope**: Individual components with props/state
- **Speed**: Fast (10ms - 100ms per test)
- **Dependencies**: Mocked APIs

## 🏗️ Project Structure

```
sharklearning/
├── services/
│   ├── user-service/
│   │   └── src/tests/
│   │       ├── auth.test.js           # Unit tests
│   │       └── integration.test.js    # Integration tests
│   ├── progress-service/
│   │   └── src/tests/
│   │       ├── progress.test.js       # Unit tests
│   │       └── integration.test.js    # Integration tests
│   └── content-service/
│       └── src/tests/
│           └── content.test.js        # Unit tests
├── frontend/
│   └── src/test/
│       ├── setup.ts                   # Test configuration
│       ├── components/                # Component tests
│       │   └── Login.test.tsx
│       └── e2e/                       # E2E tests (Cypress)
├── scripts/
│   └── run-tests.sh                   # Test runner script
└── TESTING.md                         # This document
```

## 🚀 Running Tests

### Quick Start

```bash
# Run all unit tests
./scripts/run-tests.sh

# Run with integration tests
./scripts/run-tests.sh --integration

# Run with coverage reports
./scripts/run-tests.sh --coverage

# Run everything (unit + integration + coverage + health checks)
./scripts/run-tests.sh --all
```

### Individual Services

#### User Service
```bash
cd services/user-service

# Unit tests
npm test

# Integration tests
npm run test:integration

# All tests
npm run test:all

# Coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

#### Progress Service
```bash
cd services/progress-service

# Unit tests
npm test

# Integration tests
npm run test:integration

# Coverage
npm run test:coverage
```

#### Content Service
```bash
cd services/content-service

# Unit tests
npm test

# Coverage
npm run test:coverage
```

#### Frontend
```bash
cd frontend

# Component tests
npm test

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 🔧 Backend Testing

### Framework: Jest + Supertest

#### User Service Tests

**Authentication Tests** (`auth.test.js`):
- ✅ User registration with validation
- ✅ Login with valid/invalid credentials
- ✅ JWT token generation and verification
- ✅ Password security (bcrypt)
- ✅ Input validation and sanitization
- ✅ XSS protection
- ✅ Rate limiting

**Integration Tests** (`integration.test.js`):
- ✅ Real database connectivity
- ✅ End-to-end user flows
- ✅ Health check endpoints
- ✅ Error handling

#### Progress Service Tests

**Progress Tracking Tests** (`progress.test.js`):
- ✅ Course progress CRUD operations
- ✅ Achievement system
- ✅ Leaderboard functionality
- ✅ User statistics calculation
- ✅ Progress validation
- ✅ Authentication middleware

**Integration Tests** (`integration.test.js`):
- ✅ Real progress tracking workflows
- ✅ Achievement triggering
- ✅ Cross-service communication
- ✅ Data persistence

#### Content Service Tests

**Content Management Tests** (`content.test.js`):
- ✅ Learning track retrieval
- ✅ Course content management
- ✅ Search functionality
- ✅ Category management
- ✅ Data transformation
- ✅ Performance under load

### Test Configuration

Each service uses Jest with the following configuration:

```json
{
  "testEnvironment": "node",
  "collectCoverageFrom": [
    "src/**/*.js",
    "!src/server.js",
    "!src/tests/**"
  ],
  "coverageReporters": ["text", "lcov", "html"],
  "testMatch": ["**/tests/**/*.test.js"]
}
```

## ⚛️ Frontend Testing

### Framework: Vitest + React Testing Library + Cypress

#### Component Tests

**Login Component Tests** (`Login.test.tsx`):
- ✅ Form rendering and validation
- ✅ User interactions (typing, clicking)
- ✅ Error handling and display
- ✅ Loading states
- ✅ Navigation behavior
- ✅ Accessibility compliance

#### Test Setup

**Mock Service Worker (MSW)** for API mocking:
```typescript
// Mocks all API calls for consistent testing
const handlers = [
  rest.post('/api/users/login', (req, res, ctx) => {
    return res(ctx.json({ token: 'mock-token' }))
  })
]
```

#### E2E Tests (Cypress)

**Critical User Journeys**:
- 🔄 User registration and login
- 🔄 Course enrollment and progress
- 🔄 Achievement unlocking
- 🔄 Profile management
- 🔄 Leaderboard interaction

### Test Configuration

**Vitest Configuration** (`vite.config.ts`):
```typescript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html']
  }
}
```

## 🔗 Integration Testing

### Database Integration

**Real Database Testing**:
- Uses actual PostgreSQL database
- Test data seeding and cleanup
- Transaction rollback for isolation
- Connection pooling validation

**Service Health Checks**:
```bash
# Check if all services are healthy
curl http://localhost:3001/health  # User Service
curl http://localhost:3002/health  # Content Service
curl http://localhost:3003/health  # Progress Service
curl http://localhost:3000/health  # API Gateway
```

### Cross-Service Testing

**Authentication Flow**:
1. Register user via User Service
2. Login and get JWT token
3. Use token to access Progress Service
4. Verify course enrollment via Content Service

## 📊 Coverage Reports

### Coverage Targets

- **Overall**: >80% line coverage
- **Critical paths**: >95% coverage
- **New code**: 100% coverage required

### Viewing Reports

```bash
# Generate coverage reports
npm run test:coverage

# View HTML reports
open coverage/lcov-report/index.html  # macOS
xdg-open coverage/lcov-report/index.html  # Linux
```

### Coverage Exclusions

```javascript
// Files excluded from coverage:
- src/server.js          // Entry points
- src/tests/**          // Test files
- **/*.config.{js,ts}   // Configuration files
- **/*.d.ts             // Type definitions
```

## 🔄 CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: ./scripts/run-tests.sh --all
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Pre-commit Hooks

```bash
# Install husky for git hooks
npm install --save-dev husky

# Add pre-commit test runner
npx husky add .husky/pre-commit "./scripts/run-tests.sh"
```

## 📚 Best Practices

### Writing Good Tests

#### ✅ DO

```javascript
// Clear, descriptive test names
it('should reject login with invalid email format', async () => {
  // Test implementation
})

// Test one thing at a time
it('should validate email format', () => {
  // Only test email validation
})

// Use meaningful assertions
expect(response.body.error).toBe('Invalid email format')
```

#### ❌ DON'T

```javascript
// Vague test names
it('should work', () => {})

// Testing multiple things
it('should validate email and password and login', () => {})

// Weak assertions
expect(response.status).toBeTruthy()
```

### Test Organization

```javascript
describe('User Authentication', () => {
  describe('POST /register', () => {
    it('should register valid user')
    it('should reject invalid email')
    it('should reject weak password')
  })
  
  describe('POST /login', () => {
    it('should login with valid credentials')
    it('should reject invalid credentials')
  })
})
```

### Mocking Strategy

```javascript
// Mock external dependencies
jest.mock('bcryptjs')
jest.mock('jsonwebtoken')

// Mock only what you need
const mockUserCreate = jest.fn()
jest.mock('../models/User', () => ({
  create: mockUserCreate
}))
```

### Test Data Management

```javascript
// Use factories for test data
const createTestUser = (overrides = {}) => ({
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  ...overrides
})

// Clean up after tests
afterEach(async () => {
  await User.deleteMany({})
})
```

## 🚨 Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Ensure database is running
docker-compose -f docker-compose.simple.yml up -d

# Check connection
psql -h localhost -p 5432 -U postgres -d sharklearning
```

#### Port Conflicts
```bash
# Check what's running on ports
lsof -i :3000  # API Gateway
lsof -i :3001  # User Service
lsof -i :3002  # Content Service
lsof -i :3003  # Progress Service
```

#### Test Timeouts
```javascript
// Increase timeout for slow tests
jest.setTimeout(30000)  // 30 seconds

// Or per test
it('slow test', async () => {
  // test implementation
}, 30000)
```

### Debugging Tests

```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Verbose output
npm test -- --verbose

# Run specific test file
npm test -- auth.test.js

# Run specific test
npm test -- --testNamePattern="should login"
```

## 📈 Metrics and Reporting

### Test Metrics

- **Test Count**: ~50+ unit tests, ~20+ integration tests
- **Coverage**: >80% line coverage across all services
- **Performance**: Unit tests <1s, Integration tests <30s
- **Reliability**: <1% flaky test rate

### Quality Gates

Before deployment, all of the following must pass:
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ Coverage threshold met (>80%)
- ✅ No security vulnerabilities
- ✅ Linting passes
- ✅ Type checking passes

---

## 📞 Support

For testing-related questions:
- Check existing test files for examples
- Review this documentation
- Create an issue in the repository
- Ask in the team chat

**Happy Testing! 🧪✨** 