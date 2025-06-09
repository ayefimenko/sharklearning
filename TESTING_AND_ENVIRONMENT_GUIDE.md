# 🧪 SharkLearning Testing & Environment Setup Guide

## Table of Contents
- [🏗️ Project Structure](#-project-structure)
- [🌍 Environment Setup](#-environment-setup)
- [🗄️ Database Setup](#-database-setup)
- [🧪 Testing Overview](#-testing-overview)
- [🚀 Running Tests](#-running-tests)
- [🔧 Troubleshooting](#-troubleshooting)
- [🛠️ Development Workflow](#-development-workflow)

## 🏗️ Project Structure

```
sharklearning/
├── 📁 frontend/                 # React + TypeScript frontend
│   ├── 📁 src/
│   │   ├── 📁 pages/           # Page components
│   │   ├── 📁 components/      # Reusable components
│   │   ├── 📁 stores/          # Zustand state management
│   │   └── 📁 test/            # Test setup and utilities
│   ├── 📁 cypress/             # E2E tests
│   ├── vitest.config.ts        # Unit test configuration
│   └── cypress.config.ts       # E2E test configuration
├── 📁 services/
│   ├── 📁 content-service/     # Content management API
│   ├── 📁 user-service/        # User management API
│   └── 📁 api-gateway/         # API Gateway
├── 📁 database/                # Database schemas and migrations
├── 📁 shared/                  # Shared utilities and types
└── 📁 cypress/                 # Integration tests
```

## 🌍 Environment Setup

### Prerequisites
- Node.js >= 18.0.0
- PostgreSQL 14+
- npm or yarn

### 1. Environment Variables

Create environment files:

```bash
# Copy the example environment file
cp env.example .env

# Also create environment files for services
cp services/content-service/.env.example services/content-service/.env
cp services/user-service/.env.example services/user-service/.env
cp services/api-gateway/.env.example services/api-gateway/.env
```

### 2. Essential Environment Variables

**Root `.env` file:**
```env
# Database Configuration
POSTGRES_PASSWORD=your_secure_password
DATABASE_URL=postgresql://antonefimenko@localhost:5432/sharklearning

# Security
JWT_SECRET=your_super_secure_jwt_secret_key_that_should_be_at_least_64_characters_long

# Services
CONTENT_SERVICE_URL=http://localhost:8000
USER_SERVICE_URL=http://localhost:8001
API_GATEWAY_URL=http://localhost:3000
```

**Frontend environment (create `frontend/.env`):**
```env
VITE_API_URL=http://localhost:3000/api
VITE_CONTENT_SERVICE_URL=http://localhost:8000
```

### 3. Install Dependencies

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Install service dependencies
cd services/content-service && npm install && cd ../..
cd services/user-service && npm install && cd ../..
cd services/api-gateway && npm install && cd ../..
```

## 🗄️ Database Setup

### 1. Start PostgreSQL

```bash
# macOS with Homebrew
brew services start postgresql

# Check if running
pg_isready
```

### 2. Create Database

```bash
# Connect to PostgreSQL
psql postgres

# Create database and user (if needed)
CREATE DATABASE sharklearning;
CREATE USER antonefimenko WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE sharklearning TO antonefimenko;
\q
```

### 3. Run Migrations

```bash
# Set up database schema
cd database
psql -d sharklearning -f schema.sql
cd ..
```

### 4. Verify Database Connection

```bash
# Test connection
psql -d sharklearning -c "\dt"
```

## 🧪 Testing Overview

### Testing Stack
- **Frontend Unit Tests**: Vitest + React Testing Library
- **Frontend E2E Tests**: Cypress
- **Backend Unit Tests**: Jest + Supertest
- **Integration Tests**: Jest with test database
- **API Testing**: Postman/Newman (optional)

### Test Types

1. **Unit Tests** - Individual component/function testing
2. **Integration Tests** - Service-to-service communication
3. **E2E Tests** - Full user workflows
4. **API Tests** - Endpoint validation

## 🚀 Running Tests

### Frontend Tests

```bash
cd frontend

# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI (interactive)
npm run test:ui

# Run E2E tests (requires app running)
npm run test:e2e

# Open Cypress interactive mode
npm run cypress:open
```

### Backend Tests

```bash
# Test all services
npm run test

# Test specific service
cd services/content-service
npm run test

# Run with coverage
npm run test:coverage

# Integration tests only
npm run test:integration
```

### Full Test Suite

```bash
# Run all tests (from root)
npm run test:all

# Run tests for CI/CD
npm run test:ci
```

## 🔧 Troubleshooting

### Common Issues & Solutions

#### 1. **MSW (Mock Service Worker) Conflicts**

**Error**: `[MSW] Error: intercepted a request without a matching request handler`

**Solution**:
```typescript
// In your test file, add missing handlers
import { server } from '../test/setup'
import { http, HttpResponse } from 'msw'

beforeEach(() => {
  server.use(
    http.get('http://localhost:8000/tracks', () => {
      return HttpResponse.json([
        { id: 1, title: 'Test Track', difficulty: 'beginner' }
      ])
    })
  )
})
```

#### 2. **Database Connection Issues**

**Error**: `database "antonefimenko" does not exist`

**Solution**:
```bash
# Set the DATABASE_URL environment variable
export DATABASE_URL=postgresql://antonefimenko@localhost:5432/sharklearning

# Or create the missing database
createdb antonefimenko
```

#### 3. **Import Resolution Errors**

**Error**: `Failed to resolve import "../contexts/AuthContext"`

**Solution**:
```typescript
// Use the @ alias instead of relative paths
import { useAuth } from '@/stores/authStore'

// Or fix the path
import { useAuth } from '../stores/authStore'
```

#### 4. **Port Conflicts**

**Error**: `Port 3000 is in use`

**Solution**:
```bash
# Kill processes on specific ports
lsof -ti:3000 | xargs kill -9
lsof -ti:8000 | xargs kill -9

# Or use different ports in package.json
```

#### 5. **Test Database Setup**

**Error**: Tests failing due to database state

**Solution**:
```bash
# Create separate test database
createdb sharklearning_test

# Set test environment
export NODE_ENV=test
export DATABASE_URL=postgresql://antonefimenko@localhost:5432/sharklearning_test
```

### Environment-Specific Fixes

#### Vite Configuration Issues
```typescript
// vite.config.ts - Ensure proper test configuration
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // Fix MSW issues
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
})
```

#### Jest Configuration Issues
```json
// package.json - Backend services
{
  "jest": {
    "testEnvironment": "node",
    "testTimeout": 10000,
    "forceExit": true,
    "detectOpenHandles": true,
    "setupFilesAfterEnv": ["<rootDir>/src/test/setup.js"]
  }
}
```

## 🛠️ Development Workflow

### 1. Starting Development Environment

```bash
# Terminal 1: Start database
brew services start postgresql

# Terminal 2: Start backend services
npm run dev:services

# Terminal 3: Start frontend
cd frontend && npm run dev

# Terminal 4: Run tests in watch mode
cd frontend && npm run test:watch
```

### 2. Pre-commit Checklist

```bash
# Run linting
npm run lint

# Run type checking
npm run type-check

# Run tests
npm run test

# Build to verify
npm run build
```

### 3. Test-Driven Development

```bash
# 1. Write failing test
npm run test:watch

# 2. Implement feature
# 3. Make test pass
# 4. Refactor
# 5. Repeat
```

### 4. Debugging Tests

```bash
# Debug frontend tests
cd frontend
npm run test:ui

# Debug with Node.js inspector
node --inspect-brk node_modules/.bin/vitest

# Debug backend tests
cd services/content-service
npm run test -- --detectOpenHandles --verbose
```

## 📋 Quick Reference Commands

```bash
# 🚀 Start everything
npm run dev

# 🧪 Test everything
npm run test

# 🔧 Fix common issues
npm run lint:fix
npm run build

# 🗄️ Database commands
npm run db:reset
npm run db:migrate
npm run db:seed

# 🧹 Clean up
npm run clean
npm run deps:update
```

## 🆘 Getting Help

1. **Check the logs**: Always check console output for specific error messages
2. **Verify environment**: Ensure all environment variables are set correctly
3. **Check database**: Verify database is running and accessible
4. **Clear caches**: Sometimes `npm run clean` or clearing node_modules helps
5. **Check ports**: Ensure no port conflicts exist

For specific issues, create a GitHub issue with:
- Error message
- Steps to reproduce
- Environment details (OS, Node version, etc.)
- Relevant logs 