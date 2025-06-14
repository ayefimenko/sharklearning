# 🏗️ SharkLearning Development Rules & Architecture Guidelines

## 🚨 CRITICAL ENVIRONMENT & DEPLOYMENT RULES

### **1. Docker-First Development Workflow**
- **ALWAYS use Docker for development** - No exceptions for backend services
- **NEVER run services directly with npm/node** in development
- **ALL changes must be tested in Docker containers** before considering them complete
- **Frontend can run locally (Vite) OR in Docker** - both must work consistently

### **2. Configuration Consistency Rules**
- **Port mappings MUST be consistent** across all configuration files:
  - `docker-compose.yml` port mappings
  - Service internal ports
  - Frontend proxy configurations
  - API Gateway routing
- **Environment variables MUST be synchronized** between:
  - `.env` files
  - `docker-compose.yml` environment sections
  - Service configuration files
  - Frontend build configurations

### **3. Change Propagation Protocol**
When making ANY configuration change:
```bash
# 1. ALWAYS rebuild affected containers
docker compose build [service-name]

# 2. ALWAYS restart affected services  
docker compose up -d [service-name]

# 3. ALWAYS verify the change took effect
docker logs [container-name] --tail 20
curl -I [test-endpoint]

# 4. ALWAYS test end-to-end functionality
```

### **4. Database Initialization Rules**
- **Database seeding MUST be automated** and repeatable
- **NEVER rely on manual database setup** in development
- **ALL database changes MUST include migration scripts**
- **Database state MUST be consistent** across team members

---

## 🔧 MANDATORY DEVELOPMENT WORKFLOW

### **Pre-Development Checklist**
Before starting ANY development work:
```bash
# 1. Clean slate - kill all processes
pkill -f node || true
pkill -f npm || true
docker compose down --volumes --remove-orphans

# 2. Verify Docker is running
docker --version
docker compose version

# 3. Start fresh environment
docker compose up --build -d

# 4. Wait for services to initialize
sleep 30

# 5. Verify ALL services are healthy
./scripts/health-check.sh
```

### **Post-Change Verification Protocol**
After making ANY change:
```bash
# 1. Rebuild affected services
docker compose build [affected-services]

# 2. Restart services
docker compose up -d [affected-services]

# 3. Check logs for errors
docker logs [container-name] --tail 50

# 4. Test API endpoints
curl -f http://localhost:3000/health
curl -f http://localhost:3000/api/content/tracks

# 5. Test frontend functionality
open http://localhost:3040
```

---

## 🏗️ CORE DEVELOPMENT PRINCIPLES

### **1. Never Change the Technology Stack Without Explicit Request**
- Do NOT switch databases (e.g., PostgreSQL to SQLite) 
- Do NOT change frameworks or libraries arbitrarily
- Do NOT replace existing technologies with "simpler" alternatives
- Maintain consistency with the existing architecture

### **2. No Simplified Versions**
- Do NOT create simplified or dumbed-down versions of components
- Always implement the full functionality as intended
- If there's an issue, fix the root cause, don't work around it
- Maintain the original complexity and feature set

### **3. Proper Issue Resolution**
- Identify and fix the actual root cause of problems
- Don't create workarounds that mask underlying issues
- Use proper debugging techniques to understand what's wrong
- Fix configuration, setup, and infrastructure issues properly

### **4. Test Coverage Requirements**
- **ALL new functionality MUST be covered with tests**
- Write unit tests for business logic
- Write integration tests for API endpoints
- Write component tests for React components
- Ensure edge cases and error scenarios are tested
- Test coverage should be comprehensive, not minimal

### **5. Database and Infrastructure**
- Set up proper database schemas and migrations
- Use appropriate environment variables and configuration
- Ensure proper database initialization and seeding
- Don't skip database setup steps

### **6. Code Quality Standards**
- Follow existing code patterns and conventions
- Maintain consistent import structures
- Use proper error handling throughout
- Write clear, maintainable code

### **7. Full Implementation Approach**
- Implement complete features, not partial solutions
- Include all necessary components (frontend, backend, database)
- Ensure proper integration between all parts
- Test the entire flow end-to-end

### **8. Error Handling**
- Implement proper error boundaries and fallbacks
- Log errors appropriately for debugging
- Provide meaningful error messages to users
- Handle network failures and edge cases gracefully

---

## 🏗️ ARCHITECTURE CONSISTENCY RULES

### **Service Communication Standards**
- **API Gateway (port 3000)** is the ONLY external entry point
- **All frontend API calls** MUST go through API Gateway
- **Service-to-service communication** uses internal Docker network
- **NO direct service access** from frontend

### **Port Allocation Standards**
```yaml
# FIXED PORT ASSIGNMENTS - DO NOT CHANGE
API Gateway:     3000 (external) -> 3000 (internal)
User Service:    3001 (external) -> 3001 (internal)  
Content Service: 8000 (external) -> 8000 (internal)
Progress Service: 3021 (external) -> 3021 (internal)
Frontend (Docker): 3040 (external) -> 80 (internal)
Frontend (Vite):   3000 (external) -> 3000 (internal)
PostgreSQL:      5432 (external) -> 5432 (internal)
Redis:           6379 (external) -> 6379 (internal)
```

### **Configuration File Synchronization**
These files MUST always be in sync:
- `docker-compose.yml` service definitions
- `services/*/package.json` port configurations
- `frontend/nginx.conf` proxy settings
- `frontend/vite.config.js` proxy settings
- API Gateway service routing

---

## 🚫 FORBIDDEN PRACTICES

### **Environment Anti-Patterns**
- ❌ **NEVER** run backend services with `npm start` in development
- ❌ **NEVER** hardcode ports or URLs in application code
- ❌ **NEVER** commit environment-specific configurations
- ❌ **NEVER** skip Docker rebuild after configuration changes
- ❌ **NEVER** assume changes work without testing in target environment

### **Configuration Anti-Patterns**
- ❌ **NEVER** change ports without updating ALL related configurations
- ❌ **NEVER** modify one config file without checking dependencies
- ❌ **NEVER** use different URLs/ports between development and Docker
- ❌ **NEVER** commit `.env` files with sensitive data

### **Development Anti-Patterns**
- ❌ Switch technology stacks without permission
- ❌ Create simplified "demo" versions
- ❌ Skip database setup and use mock data
- ❌ Implement partial features
- ❌ Skip writing tests
- ❌ Work around issues instead of fixing them
- ❌ Change existing working patterns unnecessarily

---

## ✅ MANDATORY PRACTICES

### **Environment Setup**
- ✅ **ALWAYS** use Docker Compose for backend services
- ✅ **ALWAYS** verify service health after changes
- ✅ **ALWAYS** test both Docker and local frontend configurations
- ✅ **ALWAYS** check logs when something doesn't work

### **Configuration Management**
- ✅ **ALWAYS** update ALL related config files when changing ports/URLs
- ✅ **ALWAYS** use environment variables for configuration
- ✅ **ALWAYS** document configuration dependencies
- ✅ **ALWAYS** test configuration changes end-to-end

### **Database Management**
- ✅ **ALWAYS** use database initialization scripts
- ✅ **ALWAYS** verify database seeding worked
- ✅ **ALWAYS** include sample data for development
- ✅ **ALWAYS** test database connectivity before application testing

### **Development Best Practices**
- ✅ Fix the actual root cause of issues
- ✅ Maintain the intended technology stack
- ✅ Implement complete, production-ready features
- ✅ Write comprehensive tests for all new code
- ✅ Follow existing code patterns and conventions
- ✅ Set up proper infrastructure and configuration
- ✅ Ensure full integration and end-to-end functionality

---

## 🔍 DEBUGGING PROTOCOL

### **When Something Doesn't Work**
1. **Check Docker container status**: `docker compose ps`
2. **Check service logs**: `docker logs [container-name] --tail 50`
3. **Verify port mappings**: `docker port [container-name]`
4. **Test service connectivity**: `curl -I [service-url]`
5. **Check configuration consistency** across all files
6. **Verify environment variables** are loaded correctly

### **Debugging Process**
1. **Identify the exact error message and location**
2. **Check logs and console output for details**
3. **Understand the root cause, not just symptoms**
4. **Fix the underlying issue properly**
5. **Test the fix thoroughly**
6. **Ensure no regression in existing functionality**

### **Common Issues & Solutions**
| Issue | Root Cause | Solution |
|-------|------------|----------|
| Frontend can't reach API | Wrong proxy configuration | Update nginx.conf and rebuild frontend |
| Service returns 404 | Port mismatch or routing issue | Check docker-compose.yml and API Gateway config |
| Database connection fails | Service not ready or wrong URL | Check service dependencies and wait for initialization |
| Changes don't appear | Container not rebuilt | Always rebuild after config changes |

---

## 📋 IMPLEMENTATION CHECKLIST

### **When adding new functionality:**
- [ ] Implement the complete feature as specified
- [ ] Write comprehensive tests (unit, integration, component)
- [ ] Update database schema if needed
- [ ] Ensure proper error handling
- [ ] Test all happy path and edge case scenarios
- [ ] Verify integration with existing features
- [ ] Update documentation if necessary

### **Before Starting Work**
- [ ] Docker is running and accessible
- [ ] All containers are stopped and cleaned
- [ ] Latest code is pulled from repository
- [ ] Environment variables are configured
- [ ] Database initialization scripts are ready

### **During Development**
- [ ] Changes are made in appropriate configuration files
- [ ] Related configurations are updated simultaneously
- [ ] Services are rebuilt after configuration changes
- [ ] Logs are checked for errors after changes
- [ ] End-to-end functionality is tested

### **Before Committing**
- [ ] All services start successfully in Docker
- [ ] Frontend can communicate with backend
- [ ] Database operations work correctly
- [ ] No hardcoded URLs or ports in code
- [ ] Configuration files are synchronized
- [ ] Documentation is updated if needed

---

## 🎯 QUALITY STANDARDS

### **Code Quality**
- Follow existing patterns and conventions
- Write comprehensive tests for new functionality
- Implement proper error handling
- Use TypeScript where applicable
- Document complex logic and configurations

### **Architecture Quality**
- Maintain service boundaries and responsibilities
- Use proper dependency injection
- Implement circuit breakers and retries
- Follow microservices best practices
- Ensure scalability and maintainability

### **Deployment Quality**
- All services must be containerized
- Configuration must be externalized
- Health checks must be implemented
- Logging must be comprehensive
- Monitoring must be in place

---

## 🚀 PRODUCTION READINESS

### **Before Production Deployment**
- [ ] All services pass health checks
- [ ] Database migrations are tested
- [ ] Security configurations are reviewed
- [ ] Performance testing is completed
- [ ] Monitoring and alerting are configured
- [ ] Backup and recovery procedures are tested
- [ ] Documentation is complete and accurate

### **Production Environment Rules**
- Use production-grade databases and caching
- Implement proper security measures
- Use HTTPS for all communications
- Implement rate limiting and DDoS protection
- Use container orchestration (Kubernetes/Docker Swarm)
- Implement proper logging and monitoring
- Use secrets management for sensitive data

---

## 📚 REQUIRED READING

Before working on this project, developers MUST understand:
- Docker and Docker Compose fundamentals
- Microservices architecture principles
- API Gateway patterns
- Database design and migrations
- Frontend-backend communication patterns
- Environment configuration management
- Debugging containerized applications

---

## 🔄 CONTINUOUS IMPROVEMENT

### **Regular Reviews**
- Weekly architecture reviews
- Monthly dependency updates
- Quarterly security audits
- Performance optimization reviews
- Documentation updates

### **Metrics to Track**
- Service uptime and availability
- Response times and throughput
- Error rates and types
- Resource utilization
- Development velocity
- Bug resolution time

---

**Remember: These rules exist because we've experienced real problems with environment inconsistencies, configuration mismatches, and deployment issues. Following these rules prevents hours of debugging and ensures a smooth development experience for everyone.** 