# SharkLearning Development Setup Guide

## Quick Start (Frontend Only)

If you just want to run the frontend for development/testing:

```bash
cd frontend
npm install
npm run dev
```

The frontend will start on `http://localhost:3000` (or next available port) with mock data when backend services are not available.

**Default Test Credentials:**
- Admin: `admin@sharklearning.com` / `admin123`
- User: `user@sharklearning.com` / `user123`

## Full Stack Development

### Prerequisites

- Node.js ≥18
- PostgreSQL 14+
- Docker & Docker Compose (for full stack)

### Option 1: Docker Compose (Recommended)

```bash
# Start all services
npm run dev

# This starts:
# - PostgreSQL databases
# - All microservices (user, content, progress)
# - API Gateway
# - Frontend
# - Monitoring stack
```

### Option 2: Manual Service Startup

1. **Start PostgreSQL** (if not using Docker):
```bash
# Create databases
createdb sharklearning_users
createdb sharklearning_content  
createdb sharklearning_progress
```

2. **Start Backend Services**:
```bash
# Terminal 1: User Service
cd services/user-service
DATABASE_URL=postgresql://username@localhost:5432/sharklearning_users npm start

# Terminal 2: Content Service  
cd services/content-service
DATABASE_URL=postgresql://username@localhost:5432/sharklearning_content npm start

# Terminal 3: Progress Service
cd services/progress-service
DATABASE_URL=postgresql://username@localhost:5432/sharklearning_progress npm start

# Terminal 4: API Gateway
cd services/api-gateway
npm start
```

3. **Start Frontend**:
```bash
cd frontend
npm run dev
```

## Service Ports

- **Frontend**: http://localhost:3000+ (auto-increments)
- **API Gateway**: http://localhost:8000
- **User Service**: http://localhost:8001
- **Content Service**: http://localhost:8002
- **Progress Service**: http://localhost:8003

## API Endpoints

### With API Gateway (Production-like)
- Login: `POST /api/users/login`
- Tracks: `GET /api/content/tracks`
- Profile: `GET /api/users/profile`

### Direct Service Access (Development)
- Content Service: `GET http://localhost:8002/tracks`
- User Service: `POST http://localhost:8001/login`

## Troubleshooting

### Blank Page Issues

1. **Check Console Errors**: Open browser dev tools and check for JavaScript errors
2. **Clear Cache**: 
   ```bash
   cd frontend
   rm -rf node_modules/.vite
   rm -rf dist
   npm run dev
   ```
3. **Kill Conflicting Processes**:
   ```bash
   pkill -f "vite"
   pkill -f "npm run dev"
   ```

### Backend Connection Issues

The frontend has fallback mock data when backend services are unavailable:

- **Dashboard**: Shows mock learning tracks and stats
- **Courses**: Shows mock course catalog
- **Authentication**: Uses mock login (see credentials above)

### Database Issues

```bash
# Reset databases
docker-compose down -v
docker-compose up -d postgres-users postgres-content postgres-progress

# Or manually:
dropdb sharklearning_users && createdb sharklearning_users
dropdb sharklearning_content && createdb sharklearning_content
dropdb sharklearning_progress && createdb sharklearning_progress
```

### Port Conflicts

If ports are in use:
```bash
# Find processes using ports
lsof -i :3000,8000,8001,8002,8003

# Kill specific processes
kill -9 <PID>
```

## Development Workflow

1. **Frontend-only development**: Just run `cd frontend && npm run dev`
2. **API development**: Start specific backend services as needed
3. **Full-stack development**: Use `npm run dev` in project root
4. **Testing**: Run `npm test` in frontend directory

## Environment Variables

Create `.env` files in service directories:

**services/user-service/.env**:
```
DATABASE_URL=postgresql://username@localhost:5432/sharklearning_users
JWT_SECRET=your-secret-key
```

**services/content-service/.env**:
```
DATABASE_URL=postgresql://username@localhost:5432/sharklearning_content
```

**services/api-gateway/.env**:
```
USER_SERVICE_URL=http://localhost:8001
CONTENT_SERVICE_URL=http://localhost:8002
PROGRESS_SERVICE_URL=http://localhost:8003
```

## Testing

```bash
# Frontend tests
cd frontend
npm test

# Backend tests
cd services/user-service
npm test

cd services/content-service  
npm test
```

## Common Issues & Solutions

### "Failed to resolve import" errors
- Clear Vite cache: `rm -rf node_modules/.vite`
- Restart dev server

### Authentication not working
- Check if using correct mock credentials
- Verify API gateway is running if using real backend

### Database connection errors
- Ensure PostgreSQL is running
- Check DATABASE_URL environment variables
- Verify database exists

### CORS errors
- API Gateway handles CORS for production
- For development, services have CORS enabled

## Production Deployment

See `docker-compose.yml` for production configuration with:
- Nginx reverse proxy
- PostgreSQL with persistent volumes
- Redis for caching
- Monitoring with Prometheus/Grafana
- Logging with ELK stack 