# 🚀 SharkLearning Deployment Guide

## Overview

This guide covers the complete deployment process for SharkLearning, from local development setup to production deployment. The platform uses Docker containers for consistent environments across all stages.

## 🏗️ System Requirements

### Development Environment
- **Docker**: Version 20.0+ with Docker Compose V2
- **Node.js**: Version 18+ (for local frontend development)
- **Git**: Latest version
- **OS**: macOS, Linux, or Windows with WSL2

### Production Environment
- **CPU**: 4+ cores recommended
- **RAM**: 8GB+ recommended
- **Storage**: 50GB+ available space
- **Docker**: Version 20.0+ with Docker Compose V2
- **Reverse Proxy**: Nginx or similar (for production)

---

## 🛠️ Local Development Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd sharklearning
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

#### Environment Variables
```bash
# Database Configuration
POSTGRES_DB=sharklearning
POSTGRES_USER=sharklearning
POSTGRES_PASSWORD=your_secure_password
DATABASE_URL=postgresql://sharklearning:your_secure_password@postgres:5432/sharklearning

# Redis Configuration
REDIS_URL=redis://redis:6379

# JWT Configuration
JWT_SECRET=your_super_secure_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# API Configuration
API_GATEWAY_PORT=8000
USER_SERVICE_PORT=8001
CONTENT_SERVICE_PORT=8002
PROGRESS_SERVICE_PORT=8003

# Frontend Configuration
VITE_API_URL=http://localhost:8000

# Development/Production Mode
NODE_ENV=development
```

### 3. Start Development Environment
```bash
# Make sure Docker is running
docker --version

# Start all services
./scripts/dev.sh

# Or manually with docker-compose
docker-compose up --build
```

### 4. Verify Services
```bash
# Check all containers are running
docker ps

# Check API Gateway health
curl http://localhost:8000/health

# Check individual services
curl http://localhost:8001/health  # User Service
curl http://localhost:8002/health  # Content Service  
curl http://localhost:8003/health  # Progress Service

# Access frontend
open http://localhost:3000
```

---

## 🔧 Development Workflow

### Development Script (`scripts/dev.sh`)
```bash
#!/bin/bash

echo "🔥 Killing existing services..."
# Kill all Node.js processes (following the rules)
pkill -f node || true
pkill -f npm || true

# Stop Docker containers
docker-compose down --volumes --remove-orphans

echo "🐳 Starting Docker services..."
# Start backend services
docker-compose up --build -d

echo "⏳ Waiting for services to start..."
sleep 10

echo "✅ Services started successfully!"
echo "🌐 API Gateway: http://localhost:8000"
echo "🎨 Frontend: http://localhost:3000"
echo "📊 Database: localhost:5432"

# Health check
curl -f http://localhost:8000/health && echo "✅ API Gateway is healthy"
```

### Frontend Development (Optional Local)
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Frontend will be available at http://localhost:3000
```

### Database Management
```bash
# Connect to PostgreSQL
docker exec -it sharklearning-postgres-1 psql -U sharklearning -d sharklearning

# View database logs
docker logs sharklearning-postgres-1

# Backup database
docker exec sharklearning-postgres-1 pg_dump -U sharklearning sharklearning > backup.sql

# Restore database
cat backup.sql | docker exec -i sharklearning-postgres-1 psql -U sharklearning -d sharklearning
```

---

## 🧪 Testing & Quality Assurance

### API Testing
```bash
# Test user registration
curl -X POST http://localhost:8000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'

# Test user login
curl -X POST http://localhost:8000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Test protected endpoint (replace TOKEN)
curl -X GET http://localhost:8000/api/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Service Health Checks
```bash
# Automated health check script
#!/bin/bash
services=(
  "http://localhost:8000/health"
  "http://localhost:8001/health" 
  "http://localhost:8002/health"
  "http://localhost:8003/health"
)

for service in "${services[@]}"; do
  if curl -f "$service" > /dev/null 2>&1; then
    echo "✅ $service is healthy"
  else
    echo "❌ $service is down"
  fi
done
```

### Load Testing
```bash
# Install Apache Bench
brew install httpd  # macOS
sudo apt-get install apache2-utils  # Ubuntu

# Test API Gateway performance
ab -n 1000 -c 10 http://localhost:8000/health

# Test with authentication
ab -n 100 -c 5 -H "Authorization: Bearer YOUR_TOKEN" \
   http://localhost:8000/api/users/profile
```

---

## 🐳 Production Deployment

### 1. Production Environment Setup

#### Docker Compose Production
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 30s
      timeout: 10s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 5
    restart: unless-stopped

  api-gateway:
    build: 
      context: ./services/api-gateway
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      NODE_ENV: production
      JWT_SECRET: ${JWT_SECRET}
      USER_SERVICE_URL: http://user-service:8001
      CONTENT_SERVICE_URL: http://content-service:8002
      PROGRESS_SERVICE_URL: http://progress-service:8003
    depends_on:
      - user-service
      - content-service
      - progress-service
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 5
    restart: unless-stopped

  user-service:
    build: 
      context: ./services/user-service
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
      REDIS_URL: ${REDIS_URL}
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 5
    restart: unless-stopped

  content-service:
    build: 
      context: ./services/content-service
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
    depends_on:
      - postgres
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8002/health"]
      interval: 30s
      timeout: 10s
      retries: 5
    restart: unless-stopped

  progress-service:
    build: 
      context: ./services/progress-service
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
    depends_on:
      - postgres
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8003/health"]
      interval: 30s
      timeout: 10s
      retries: 5
    restart: unless-stopped

  frontend:
    build: 
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    environment:
      VITE_API_URL: ${VITE_API_URL}
    depends_on:
      - api-gateway
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  default:
    name: sharklearning-network
```

### 2. Production Dockerfile Optimization

#### Frontend Production Dockerfile
```dockerfile
# frontend/Dockerfile.prod
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Nginx Configuration
```nginx
# frontend/nginx.conf
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        # Handle client-side routing
        location / {
            try_files $uri $uri/ /index.html;
        }

        # API proxy
        location /api/ {
            proxy_pass http://api-gateway:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
    }
}
```

### 3. Production Deployment Script
```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "🚀 Starting production deployment..."

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Build and deploy
echo "🏗️ Building production images..."
docker-compose -f docker-compose.prod.yml build --no-cache

echo "🔄 Stopping old containers..."
docker-compose -f docker-compose.prod.yml down

echo "🆙 Starting new containers..."
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for services to start..."
sleep 30

# Health checks
echo "🏥 Running health checks..."
services=(
  "http://localhost:8000/health"
  "http://localhost:8001/health" 
  "http://localhost:8002/health"
  "http://localhost:8003/health"
)

all_healthy=true
for service in "${services[@]}"; do
  if curl -f "$service" > /dev/null 2>&1; then
    echo "✅ $service is healthy"
  else
    echo "❌ $service is down"
    all_healthy=false
  fi
done

if [ "$all_healthy" = true ]; then
  echo "🎉 Deployment successful!"
  echo "🌐 Application: http://localhost:3000"
  echo "📡 API: http://localhost:8000"
else
  echo "💥 Deployment failed - some services are unhealthy"
  exit 1
fi
```

---

## 🌐 Reverse Proxy Setup (Nginx)

### Domain Configuration
```nginx
# /etc/nginx/sites-available/sharklearning.com
server {
    listen 80;
    listen [::]:80;
    server_name sharklearning.com www.sharklearning.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name sharklearning.com www.sharklearning.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/sharklearning.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sharklearning.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Authorization, Content-Type";
    }
}
```

---

## 📊 Monitoring & Observability

### Health Check Monitoring
```bash
# scripts/health-monitor.sh
#!/bin/bash

SERVICES=(
  "Frontend:http://localhost:3000"
  "API-Gateway:http://localhost:8000/health"
  "User-Service:http://localhost:8001/health"
  "Content-Service:http://localhost:8002/health"
  "Progress-Service:http://localhost:8003/health"
)

LOG_FILE="/var/log/sharklearning-health.log"

while true; do
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  
  for service_info in "${SERVICES[@]}"; do
    service_name=$(echo $service_info | cut -d: -f1)
    service_url=$(echo $service_info | cut -d: -f2-)
    
    if curl -f "$service_url" > /dev/null 2>&1; then
      echo "$timestamp - $service_name: UP" >> $LOG_FILE
    else
      echo "$timestamp - $service_name: DOWN" >> $LOG_FILE
      # Send alert (implement notification system)
    fi
  done
  
  sleep 60
done
```

### Docker Resource Monitoring
```bash
# Monitor resource usage
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

# Monitor logs
docker-compose logs -f --tail=100

# Check disk usage
docker system df
```

---

## 🔒 Security Considerations

### Environment Security
```bash
# Set secure file permissions
chmod 600 .env
chmod 600 docker-compose.prod.yml

# Use Docker secrets in production
docker secret create jwt_secret jwt_secret.txt
docker secret create db_password db_password.txt
```

### SSL/TLS Setup with Let's Encrypt
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d sharklearning.com -d www.sharklearning.com

# Auto-renewal setup
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Firewall Configuration
```bash
# UFW setup
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 🔄 Backup & Recovery

### Database Backup
```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/backups/sharklearning"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Database backup
docker exec sharklearning-postgres-1 pg_dump -U sharklearning sharklearning > \
  "$BACKUP_DIR/database_$DATE.sql"

# Compress backup
gzip "$BACKUP_DIR/database_$DATE.sql"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "database_*.sql.gz" -mtime +7 -delete

echo "Backup completed: database_$DATE.sql.gz"
```

### Automated Backup with Cron
```bash
# Add to crontab
# Backup daily at 2 AM
0 2 * * * /path/to/scripts/backup.sh

# Backup weekly (Sundays at 3 AM)
0 3 * * 0 /path/to/scripts/backup.sh
```

---

## 🚨 Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check logs
docker-compose logs service-name

# Check resource usage
docker system df
docker system prune

# Restart specific service
docker-compose restart service-name
```

#### Database Connection Issues
```bash
# Check database connectivity
docker exec -it sharklearning-postgres-1 psql -U sharklearning -d sharklearning -c "SELECT 1"

# Reset database
docker-compose down -v
docker-compose up postgres -d
# Wait for initialization, then start other services
```

#### Port Conflicts
```bash
# Check what's using ports
lsof -i :8000
lsof -i :3000
lsof -i :5432

# Kill processes if needed
sudo kill -9 PID
```

### Performance Issues
```bash
# Monitor resource usage
htop
docker stats

# Check database performance
docker exec -it sharklearning-postgres-1 psql -U sharklearning -d sharklearning -c "
  SELECT query, calls, total_time, total_time/calls as avg_time 
  FROM pg_stat_statements 
  ORDER BY total_time DESC 
  LIMIT 10;"
```

---

## 📈 Scaling Considerations

### Horizontal Scaling
```yaml
# docker-compose.scale.yml
version: '3.8'

services:
  api-gateway:
    deploy:
      replicas: 2

  user-service:
    deploy:
      replicas: 3

  content-service:
    deploy:
      replicas: 2

  progress-service:
    deploy:
      replicas: 3
```

### Load Balancer Configuration
```nginx
upstream api_backend {
    server localhost:8000;
    server localhost:8001;
    server localhost:8002;
}

server {
    location /api/ {
        proxy_pass http://api_backend;
    }
}
```

This comprehensive deployment guide ensures a smooth path from development to production while following all the established rules and principles of the SharkLearning platform. 