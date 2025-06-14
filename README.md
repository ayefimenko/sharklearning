# 🦈 SharkLearning - Interactive E-Learning Platform

> **⚠️ IMPORTANT: Read the [Development Rules](./rules.md) before starting development!**

SharkLearning is a comprehensive e-learning platform designed specifically for QA Engineers, featuring interactive courses, hands-on labs, and certification tracking.

## 🚀 Quick Start

### Prerequisites
- **Docker Desktop** (version 20.0+)
- **Node.js** (version 18+)
- **Git**

### 🏁 One-Command Setup
```bash
# Clone and start the entire development environment
git clone <repository-url>
cd sharklearning
npm run setup
```

This will:
- Install all dependencies
- Validate configuration consistency
- Start all services in Docker
- Initialize databases with sample data
- Run comprehensive health checks

### 🌐 Access Points
After successful setup:
- **Frontend**: http://localhost:3040
- **API Gateway**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api

---

## 🔧 Development Workflow

### **MANDATORY: Docker-First Development**
> ⚠️ **All backend services MUST run in Docker containers during development**

### Daily Development Commands
```bash
# Start development environment (clean slate)
npm run dev

# Check if everything is working
npm run health

# View logs for specific services
npm run logs:api        # API Gateway logs
npm run logs:content    # Content Service logs
npm run logs:frontend   # Frontend logs

# Stop everything
npm run dev:down
```

### Configuration Validation
```bash
# Validate all configurations are synchronized
npm run validate

# This checks:
# ✅ Port mappings consistency
# ✅ Service routing configuration
# ✅ Frontend proxy settings
# ✅ Database connections
# ✅ Required files exist
```

### Database Management
```bash
# Seed databases with sample data
npm run db:seed

# Reset databases (nuclear option)
npm run db:reset
```

---

## 🏗️ Architecture Overview

### Service Architecture
```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Admin Panel   │
│   (React)       │    │   (React)       │
│   Port: 3040    │    │   Port: 3041    │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────────┬───────────┘
                     │
          ┌─────────────────┐
          │  API Gateway    │
          │  Port: 3000     │
          └─────────┬───────┘
                    │
    ┌───────────────┼───────────────┐
    │               │               │
┌───▼────┐    ┌────▼────┐    ┌────▼────┐
│ User   │    │Content  │    │Progress │
│Service │    │Service  │    │Service  │
│:3001   │    │:8000    │    │:3021    │
└───┬────┘    └────┬────┘    └────┬────┘
    │              │              │
┌───▼────┐    ┌────▼────┐    ┌────▼────┐
│Users   │    │Courses  │    │Learning │
│DB      │    │DB       │    │DB       │
│:5432   │    │:5433    │    │:5434    │
└────────┘    └─────────┘    └─────────┘
```

### **Fixed Port Assignments**
> ⚠️ **DO NOT CHANGE** these ports without updating ALL related configurations

| Service | External Port | Internal Port | Purpose |
|---------|---------------|---------------|---------|
| API Gateway | 3000 | 3000 | Main API entry point |
| User Service | 3001 | 3001 | User management |
| Content Service | 8000 | 8000 | Courses & tracks |
| Progress Service | 3021 | 3021 | Learning progress |
| Frontend (Docker) | 3040 | 80 | React app (Nginx) |
| Frontend (Vite) | 3000 | 3000 | Local development |
| PostgreSQL (Users) | 5432 | 5432 | User database |
| PostgreSQL (Courses) | 5433 | 5432 | Content database |
| PostgreSQL (Learning) | 5434 | 5432 | Progress database |
| Redis | 6379 | 6379 | Caching & sessions |

---

## 🚫 Critical Rules & Anti-Patterns

### **NEVER Do This:**
- ❌ Run backend services with `npm start` in development
- ❌ Change ports without updating ALL related configurations
- ❌ Skip Docker rebuild after configuration changes
- ❌ Commit `.env` files with sensitive data
- ❌ Assume changes work without testing in Docker

### **ALWAYS Do This:**
- ✅ Use `npm run dev` to start development environment
- ✅ Run `npm run health` after making changes
- ✅ Validate configuration with `npm run validate`
- ✅ Test both Docker and local frontend configurations
- ✅ Check logs when something doesn't work

---

## 🔍 Troubleshooting

### Common Issues & Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Frontend can't reach API** | Network errors, CORS issues | Check `frontend/nginx.conf` proxy settings |
| **Service returns 404** | API endpoints not found | Verify API Gateway routing in `services/api-gateway/src/server.js` |
| **Database connection fails** | Service startup errors | Check service dependencies and wait for DB initialization |
| **Changes don't appear** | Old behavior persists | Rebuild containers: `docker compose build [service]` |
| **Port conflicts** | Services won't start | Check port mappings in `docker-compose.yml` |

### Debugging Commands
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

### Health Check Interpretation
```bash
npm run health

# ✅ All green = Ready for development
# ❌ Any red = Fix issues before continuing
# ⚠️ Yellow warnings = Usually OK, but investigate
```

---

## 🧪 Testing

### Running Tests
```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Linting
npm run lint
npm run lint:fix
```

### Test Environment
- Tests run in isolated Docker containers
- Database is reset before each test suite
- All services must be healthy before running integration tests

---

## 📁 Project Structure

```
sharklearning/
├── 📁 services/                 # Backend microservices
│   ├── 📁 api-gateway/         # Main API gateway (port 3000)
│   ├── 📁 user-service/        # User management (port 3001)
│   ├── 📁 content-service/     # Courses & tracks (port 8000)
│   └── 📁 progress-service/    # Learning progress (port 3021)
├── 📁 frontend/                # React frontend (port 3040)
├── 📁 database/                # Database schemas & migrations
│   └── 📁 init-scripts/        # Database initialization
├── 📁 scripts/                 # Development & deployment scripts
│   ├── 🔧 dev-start.sh        # Development startup
│   ├── 🏥 health-check.sh     # Health validation
│   └── 🔍 validate-config.sh  # Configuration validation
├── 📁 docs/                    # Documentation
├── 🐳 docker-compose.yml      # Service orchestration
├── 📋 rules.md                # Development rules (READ THIS!)
└── 📦 package.json            # Project scripts
```

---

## 🚀 Production Deployment

### Prerequisites
- Docker Swarm or Kubernetes cluster
- SSL certificates
- Production databases
- Monitoring & logging infrastructure

### Deployment Steps
```bash
# Build production images
docker compose -f docker-compose.prod.yml build

# Deploy to production
docker stack deploy -c docker-compose.prod.yml sharklearning

# Monitor deployment
docker service ls
```

### Production Checklist
- [ ] SSL certificates configured
- [ ] Environment variables secured
- [ ] Database backups automated
- [ ] Monitoring & alerting active
- [ ] Load balancing configured
- [ ] Security scanning completed

---

## 🤝 Contributing

### Before Contributing
1. **Read [Development Rules](./rules.md)** - MANDATORY
2. **Validate your setup**: `npm run validate`
3. **Start development environment**: `npm run dev`
4. **Verify health**: `npm run health`

### Development Process
1. Create feature branch from `main`
2. Make changes following the rules
3. Test in Docker environment
4. Run validation: `npm run validate`
5. Ensure all tests pass: `npm test`
6. Submit pull request

### Code Quality Standards
- Follow existing patterns and conventions
- Write comprehensive tests
- Use TypeScript where applicable
- Document complex logic
- Ensure Docker compatibility

---

## 📚 Additional Resources

- [Development Rules](./rules.md) - **MUST READ**
- [API Documentation](./docs/api-documentation.md)
- [Database Schema](./docs/database-schema.md)
- [Frontend Guide](./docs/frontend-guide.md)
- [Deployment Guide](./docs/deployment-guide.md)
- [Testing Guide](./docs/testing-guide.md)

---

## 🆘 Getting Help

### Quick Help
```bash
# Validate your setup
npm run validate

# Check service health
npm run health

# View service logs
npm run logs:api
npm run logs:content
npm run logs:frontend
```

### Support Channels
- **Issues**: Create GitHub issue with logs and error details
- **Documentation**: Check `docs/` directory
- **Configuration**: Run `npm run validate` for diagnostics

---

## 📄 License

This project is licensed under UNLICENSED - see the [LICENSE](LICENSE) file for details.

---

**Remember: Following the [Development Rules](./rules.md) prevents hours of debugging and ensures a smooth development experience for everyone! 🚀** 