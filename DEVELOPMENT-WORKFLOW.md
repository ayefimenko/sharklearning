# 🚀 SharkLearning Development Workflow

> **This document summarizes the new development workflow implemented to prevent environment and deployment issues.**

## 🎯 Overview

After experiencing multiple environment inconsistencies, port mismatches, and deployment issues, we've implemented a comprehensive development workflow with automated validation, health checks, and strict rules to ensure consistent development experience.

## 🔧 New Development Scripts

### 1. **Development Startup** (`npm run dev`)
```bash
./scripts/dev-start.sh
```
**What it does:**
- Kills all existing Node processes
- Stops and cleans Docker containers
- Verifies Docker is running
- Builds and starts all services
- Waits for initialization
- Runs comprehensive health checks
- Initializes databases with sample data

### 2. **Health Check** (`npm run health`)
```bash
./scripts/health-check.sh
```
**What it checks:**
- ✅ Docker container status
- ✅ Service health endpoints
- ✅ API Gateway routing
- ✅ Frontend accessibility
- ✅ Database connectivity
- ✅ Redis connectivity

### 3. **Configuration Validation** (`npm run validate`)
```bash
./scripts/validate-config.sh
```
**What it validates:**
- ✅ Port mappings consistency
- ✅ API Gateway service routing
- ✅ Frontend proxy configurations
- ✅ Required files and directories
- ✅ Environment variable templates

## 📋 Updated NPM Scripts

```json
{
  "dev": "./scripts/dev-start.sh",           // Start development environment
  "health": "./scripts/health-check.sh",     // Check system health
  "validate": "./scripts/validate-config.sh", // Validate configurations
  "dev:down": "docker-compose down --volumes --remove-orphans",
  "db:seed": "docker exec -i sharklearning-postgres-courses-1 psql -U sharklearning -d sharklearning_courses < database/init-scripts/courses/init-content-service.sql",
  "db:reset": "docker-compose down --volumes && docker-compose up -d && sleep 30 && npm run db:seed",
  "logs:api": "docker logs sharklearning-api-gateway-1 -f",
  "logs:content": "docker logs sharklearning-content-service-1 -f",
  "logs:frontend": "docker logs sharklearning-frontend-1 -f"
}
```

## 🏗️ Fixed Architecture Issues

### **Port Mapping Corrections**
- ✅ **Frontend Docker**: `3040:80` (was `3040:3000`)
- ✅ **API Gateway routing**: All services use correct internal ports
- ✅ **Frontend Nginx proxy**: Points to `host.docker.internal:3000`

### **Configuration Synchronization**
All these files are now synchronized:
- `docker-compose.yml` - Service definitions and port mappings
- `services/api-gateway/src/server.js` - Service routing
- `frontend/nginx.conf` - API proxy configuration
- `frontend/vite.config.ts` - Development proxy

## 🚫 Critical Rules Implemented

### **NEVER Do This:**
- ❌ Run backend services with `npm start` in development
- ❌ Change ports without updating ALL related configurations
- ❌ Skip Docker rebuild after configuration changes
- ❌ Assume changes work without testing in Docker

### **ALWAYS Do This:**
- ✅ Use `npm run dev` to start development
- ✅ Run `npm run health` after making changes
- ✅ Validate with `npm run validate` before committing
- ✅ Check logs when something doesn't work

## 🔄 Daily Development Workflow

### **Starting Development**
```bash
# 1. Start development environment
npm run dev

# 2. Verify everything is working
npm run health

# 3. Access the application
open http://localhost:3040
```

### **Making Changes**
```bash
# 1. Make your changes
# 2. If configuration changed, rebuild affected services
docker compose build [service-name]
docker compose up -d [service-name]

# 3. Verify changes work
npm run health

# 4. Check specific service logs if needed
npm run logs:api
npm run logs:content
```

### **Before Committing**
```bash
# 1. Validate all configurations
npm run validate

# 2. Run tests
npm test

# 3. Ensure health check passes
npm run health
```

## 🔍 Troubleshooting Guide

### **Common Issues & Solutions**

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Frontend can't reach API** | Network errors, CORS issues | Check `frontend/nginx.conf` proxy settings |
| **Service returns 404** | API endpoints not found | Verify API Gateway routing |
| **Database connection fails** | Service startup errors | Wait for DB initialization, check dependencies |
| **Changes don't appear** | Old behavior persists | Rebuild containers: `docker compose build [service]` |
| **Port conflicts** | Services won't start | Check port mappings in `docker-compose.yml` |

### **Debugging Commands**
```bash
# Check container status
docker compose ps

# View service logs
docker logs [container-name] --tail 50

# Test API connectivity
curl -I http://localhost:3000/health
curl -I http://localhost:3000/api/content/tracks

# Restart specific service
docker compose restart [service-name]

# Nuclear option (full reset)
docker compose down --volumes --remove-orphans
npm run dev
```

## 📊 Health Check Interpretation

```bash
npm run health

# ✅ All green = Ready for development
# ❌ Any red = Fix issues before continuing
# ⚠️ Yellow warnings = Usually OK, but investigate
```

## 🎯 Benefits of New Workflow

### **Before (Problems)**
- ❌ Manual service startup prone to errors
- ❌ Port mismatches causing connection failures
- ❌ Configuration drift between files
- ❌ No validation of environment setup
- ❌ Difficult to debug issues
- ❌ Inconsistent development experience

### **After (Solutions)**
- ✅ Automated, consistent environment setup
- ✅ Configuration validation prevents mismatches
- ✅ Comprehensive health checks catch issues early
- ✅ Clear troubleshooting guidance
- ✅ Standardized development workflow
- ✅ Faster issue resolution

## 🚀 Production Readiness

This workflow ensures:
- **Consistency**: Same environment for all developers
- **Reliability**: Automated validation catches issues
- **Maintainability**: Clear documentation and processes
- **Scalability**: Easy to add new services and checks
- **Debuggability**: Comprehensive logging and health checks

## 📚 Related Documentation

- [Development Rules](./rules.md) - **MUST READ**
- [README.md](./README.md) - Updated with new workflow
- [API Documentation](./docs/api-documentation.md)
- [Deployment Guide](./docs/deployment-guide.md)

---

**Remember: These improvements were implemented because we experienced real problems. Following this workflow prevents hours of debugging and ensures a smooth development experience for everyone! 🚀** 