# Development Rules and Guidelines

## 🏗️ Core Development Principles

### **SOLID Principles**
- **S** - Single Responsibility Principle: Each class/function should have one reason to change
- **O** - Open/Closed Principle: Open for extension, closed for modification
- **L** - Liskov Substitution Principle: Objects should be replaceable with instances of their subtypes
- **I** - Interface Segregation Principle: No client should depend on methods it doesn't use
- **D** - Dependency Inversion Principle: Depend on abstractions, not concretions

### **KISS (Keep It Simple, Stupid)**
- Always prefer simple solutions over complex ones
- Avoid over-engineering
- Write code that is easy to understand and maintain

### **DRY (Don't Repeat Yourself)**
- Avoid duplication of code whenever possible
- Check for other areas of the codebase that might already have similar code and functionality
- Extract common functionality into reusable components/functions

## 🔧 Server & Testing Rules

- After making changes, ALWAYS make sure to start up a new server so I can test it
- Always kill all existing related servers that may have been created in previous testing before trying to start a new server

## 📝 Code Development Rules

- Always look for existing code to iterate on instead of creating new code
- Do not drastically change the patterns before trying to iterate on existing patterns
- You are careful to only make changes that are requested or you are confident are well understood and related to the change being requested
- When fixing an issue or bug, do not introduce a new pattern or technology without first exhausting all options for the existing implementation. And if you finally do this, make sure to remove the old implementation afterwards so we don't have duplicate logic

## 🏗️ Code Organization & Quality

- Keep the codebase very clean and organized
- Avoid having files over 200-300 lines of code. Refactor at that point
- Avoid writing scripts in files if possible, especially if the script is likely only to be run once
- Write code that takes into account the different environments: dev, test, and prod
- Write thorough tests for all major functionality

## 🎯 Focus & Scope Rules

- Focus on the areas of code relevant to the task
- Do not touch code that is unrelated to the task
- Avoid making major changes to the patterns and architecture of how a feature works, after it has shown to work well, unless explicitly instructed
- Always think about what other methods and areas of code might be affected by code changes

## 🚫 Data & Environment Restrictions

- Mocking data is only needed for tests, never mock data for dev or prod
- Never add stubbing or fake data patterns to code that affects the dev or prod environments
- Never overwrite my .env file without first asking and confirming

## 🔄 Git Configuration & Contribution Guidelines

### **Git User Configuration**
- **Repository Email**: `ayefimenko1337@gmail.com`
- **Repository Name**: `Anton Efimenko`
- **GitHub Repository**: `https://github.com/ayefimenko/horizon.git`

### **Contribution Tracking**
- Ensure the git email (`ayefimenko1337@gmail.com`) is added to your GitHub account's verified email addresses
- This is critical for GitHub contribution graph visibility and proper commit attribution
- All commits must use the correct email to appear in GitHub contributions

### **Git Best Practices**
- Always verify git configuration before committing: `git config user.email`
- Write clear, descriptive commit messages that explain the changes
- Commit related changes together in logical units
- Push changes promptly after committing to keep the remote repository up to date

### **Commit Message Format**
- Use descriptive commit messages that explain what was changed and why
- Include relevant context about the implementation approach
- Mention any breaking changes or important architectural decisions

## 📋 Summary of Key Principles

1. **Follow SOLID principles** for clean, maintainable code architecture
2. **Keep It Simple (KISS)** - prefer simple solutions over complex ones
3. **Don't Repeat Yourself (DRY)** - avoid code duplication
4. **Iterate on existing code** rather than creating new patterns
5. **Always restart servers** after changes for testing
6. **Focus only on relevant code** for the task at hand
7. **Maintain clean, organized codebase** with proper separation of concerns
8. **Never mock data** in dev/prod environments
9. **Consider cross-environment compatibility** (dev, test, prod)
10. **Think about impact** on other parts of the codebase when making changes
11. **Use correct git configuration** (`ayefimenko1337@gmail.com`) for proper contribution tracking 