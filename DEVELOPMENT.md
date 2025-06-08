# 🦈 SharkLearning Development Environment Guide

## 🚀 Quick Start

### Option 1: Use the Automated Startup Script (Recommended)
```bash
./start-dev.sh
```

### Option 2: Manual Setup
```bash
# 1. Start backend services
docker-compose up -d api-gateway user-service content-service progress-service postgres-users postgres-courses postgres-learning redis

# 2. Wait for services to be healthy (check with)
docker-compose ps

# 3. Start frontend development server
cd frontend
npm run dev
```

## 🏗️ Architecture Overview

### Service Ports
| Service | Port | Docker | Local Dev | URL |
|---------|------|--------|-----------|-----|
| **Frontend** | 3000+ | ❌ | ✅ | http://localhost:3000+ |
| **API Gateway** | 3000 | ✅ | ❌ | http://localhost:3000 |
| **User Service** | 3001 | ✅ | ❌ | http://localhost:3001 |
| **Content Service** | 3011 | ✅ | ❌ | http://localhost:3011 |
| **Progress Service** | 3021 | ✅ | ❌ | http://localhost:3021 |
| **Redis** | 6379 | ✅ | ❌ | localhost:6379 |

### Development Strategy
- **Backend Services**: Run in Docker containers for consistency
- **Frontend**: Run locally with Vite dev server for hot reload
- **Databases**: PostgreSQL containers with persistent volumes
- **API Communication**: Frontend proxies `/api/*` calls to API Gateway

## 🔧 Configuration Details

### Frontend Proxy Configuration
The Vite dev server is configured to proxy API calls:
```typescript
// frontend/vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:3000',  // API Gateway
    changeOrigin: true,
  },
}
```

### CORS Configuration
Backend services are configured to allow frontend origins:
```javascript
// API Gateway CORS
origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003']
```

## 🐛 Troubleshooting

### Common Issues

#### 1. "Endpoint not found" errors
**Problem**: Frontend can't reach backend APIs
**Solutions**:
- Ensure API Gateway is running: `curl http://localhost:3000/health`
- Check Vite proxy configuration points to correct port (3000)
- Verify CORS origins include your frontend port

#### 2. Port conflicts
**Problem**: Services fail to start due to port conflicts
**Solutions**:
- Use the automated script: `./start-dev.sh`
- Manually check ports: `lsof -i :3000`
- Stop conflicting processes: `pkill -f "vite"`

#### 3. Database connection errors
**Problem**: Services can't connect to databases
**Solutions**:
- Restart database containers: `docker-compose restart postgres-users postgres-courses postgres-learning`
- Check container health: `docker-compose ps`
- Verify init scripts: `ls database/init-scripts/*/`

#### 4. Frontend shows blank page
**Problem**: Authentication or routing issues
**Solutions**:
- Clear browser localStorage: `localStorage.clear()`
- Check browser network tab for API errors
- Verify backend services are healthy

### Health Check Commands
```bash
# Check all container status
docker-compose ps

# Check API Gateway health
curl http://localhost:3000/health

# Check individual service health
curl http://localhost:3001/health  # User Service
curl http://localhost:3011/health  # Content Service
curl http://localhost:3021/health  # Progress Service

# Check database connections
docker-compose exec postgres-users psql -U sharklearning -d sharklearning_users -c "SELECT 1;"
```

### Log Inspection
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api-gateway
docker-compose logs -f user-service
docker-compose logs -f content-service

# Frontend logs (check terminal running npm run dev)
```

## 🔄 Development Workflow

### Starting Development
1. Run `./start-dev.sh` or manual setup
2. Wait for "Ready for development!" message
3. Access frontend at displayed URL (usually http://localhost:3000+)

### Making Changes

#### Backend Changes
- Code changes require container rebuild: `docker-compose up -d --build [service-name]`
- Database schema changes: Update init scripts and recreate volumes
- Environment changes: Update docker-compose.yml

#### Frontend Changes
- Hot reload works automatically with Vite
- New dependencies: `cd frontend && npm install`
- Route changes: Check App.tsx routing configuration

### Testing
```bash
# Run frontend tests
cd frontend
npm test

# Run backend tests
cd services/user-service && npm test
cd services/content-service && npm test
cd services/progress-service && npm test

# Run integration tests
npm run test:e2e
```

## 🌍 Environment Variables

### Required for Backend
```env
# Database
POSTGRES_PASSWORD=password
JWT_SECRET=your-super-secret-jwt-key

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003
```

### Frontend Environment (automatically set by Vite)
- `VITE_API_URL`: Set via proxy configuration
- Development mode automatically enabled

## 📊 Monitoring & Debugging

### Available Tools
- **Prometheus**: http://localhost:9090 - Metrics collection
- **Grafana**: http://localhost:3030 - Dashboards (admin/admin)
- **Jaeger**: http://localhost:16686 - Distributed tracing
- **Kibana**: http://localhost:5601 - Log visualization

### Performance Monitoring
- React DevTools for frontend debugging
- Docker stats: `docker stats`
- Service health endpoints: `/health`

## 🚫 Common Mistakes to Avoid

1. **Don't run multiple frontend instances** - Only use Vite dev server OR Docker, not both
2. **Don't hardcode ports** - Use environment variables and proxy configuration
3. **Don't skip health checks** - Wait for services to be healthy before testing
4. **Don't ignore CORS errors** - Ensure frontend port is in allowed origins
5. **Don't mix development and production configs** - Use appropriate environment settings

## 🆘 Emergency Reset

If everything is broken:
```bash
# Nuclear option - reset everything
docker-compose down -v  # Stops all containers and removes volumes
docker system prune -f  # Clean up Docker resources
pkill -f "vite"         # Stop any rogue frontend processes
rm -rf frontend/node_modules  # Remove frontend dependencies
cd frontend && npm install    # Reinstall frontend dependencies
./start-dev.sh          # Start fresh
```

## 📞 Getting Help

1. Check this guide first
2. Inspect logs: `docker-compose logs -f [service]`
3. Verify health endpoints
4. Check browser network tab for API errors
5. Clear browser cache and localStorage

---

**Happy coding! 🦈🚀** 