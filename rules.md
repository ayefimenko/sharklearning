# Development Rules and Guidelines

## Core Principles

### 1. **Never Change the Technology Stack Without Explicit Request**
- Do NOT switch databases (e.g., PostgreSQL to SQLite) 
- Do NOT change frameworks or libraries arbitrarily
- Do NOT replace existing technologies with "simpler" alternatives
- Maintain consistency with the existing architecture

### 2. **No Simplified Versions**
- Do NOT create simplified or dumbed-down versions of components
- Always implement the full functionality as intended
- If there's an issue, fix the root cause, don't work around it
- Maintain the original complexity and feature set

### 3. **Proper Issue Resolution**
- Identify and fix the actual root cause of problems
- Don't create workarounds that mask underlying issues
- Use proper debugging techniques to understand what's wrong
- Fix configuration, setup, and infrastructure issues properly

### 4. **Test Coverage Requirements**
- **ALL new functionality MUST be covered with tests**
- Write unit tests for business logic
- Write integration tests for API endpoints
- Write component tests for React components
- Ensure edge cases and error scenarios are tested
- Test coverage should be comprehensive, not minimal

### 5. **Database and Infrastructure**
- Set up proper database schemas and migrations
- Use appropriate environment variables and configuration
- Ensure proper database initialization and seeding
- Don't skip database setup steps

### 6. **Code Quality Standards**
- Follow existing code patterns and conventions
- Maintain consistent import structures
- Use proper error handling throughout
- Write clear, maintainable code

### 7. **Full Implementation Approach**
- Implement complete features, not partial solutions
- Include all necessary components (frontend, backend, database)
- Ensure proper integration between all parts
- Test the entire flow end-to-end

### 8. **Error Handling**
- Implement proper error boundaries and fallbacks
- Log errors appropriately for debugging
- Provide meaningful error messages to users
- Handle network failures and edge cases gracefully

## Implementation Checklist

When adding new functionality:
- [ ] Implement the complete feature as specified
- [ ] Write comprehensive tests (unit, integration, component)
- [ ] Update database schema if needed
- [ ] Ensure proper error handling
- [ ] Test all happy path and edge case scenarios
- [ ] Verify integration with existing features
- [ ] Update documentation if necessary

## Debugging Process

1. **Identify the exact error message and location**
2. **Check logs and console output for details**
3. **Understand the root cause, not just symptoms**
4. **Fix the underlying issue properly**
5. **Test the fix thoroughly**
6. **Ensure no regression in existing functionality**

## What NOT to Do

- ❌ Switch technology stacks without permission
- ❌ Create simplified "demo" versions
- ❌ Skip database setup and use mock data
- ❌ Implement partial features
- ❌ Skip writing tests
- ❌ Work around issues instead of fixing them
- ❌ Change existing working patterns unnecessarily

## What TO Do

- ✅ Fix the actual root cause of issues
- ✅ Maintain the intended technology stack
- ✅ Implement complete, production-ready features
- ✅ Write comprehensive tests for all new code
- ✅ Follow existing code patterns and conventions
- ✅ Set up proper infrastructure and configuration
- ✅ Ensure full integration and end-to-end functionality 