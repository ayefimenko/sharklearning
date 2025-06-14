#!/bin/bash

# 🚀 SharkLearning Development Startup Script
# Follows the mandatory development workflow rules

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting SharkLearning Development Environment${NC}"
echo "=================================================="

# Step 1: Clean slate - kill all processes
echo -e "${YELLOW}🧹 Cleaning up existing processes...${NC}"
pkill -f node || true
pkill -f npm || true
echo "✅ Node processes killed"

# Step 2: Stop and clean Docker containers
echo -e "${YELLOW}🐳 Stopping and cleaning Docker containers...${NC}"
docker compose down --volumes --remove-orphans
echo "✅ Docker containers stopped and cleaned"

# Step 3: Verify Docker is running
echo -e "${YELLOW}🔍 Verifying Docker is running...${NC}"
if ! docker --version > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not installed or not in PATH${NC}"
    exit 1
fi

if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker daemon is not running${NC}"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

echo "✅ Docker is running"
docker --version
docker compose version

# Step 4: Check for required files
echo -e "${YELLOW}📋 Checking required configuration files...${NC}"
required_files=(
    "docker-compose.yml"
    "database/init-scripts/courses/init-content-service.sql"
    "database/init-scripts/users/init-user-service.sql"
    "database/init-scripts/learning/init-progress-service.sql"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Required file missing: $file${NC}"
        exit 1
    fi
done
echo "✅ All required files present"

# Step 5: Build and start services
echo -e "${YELLOW}🏗️ Building and starting services...${NC}"
echo "This may take a few minutes on first run..."

# Build all services
docker compose build

# Start services in background
docker compose up -d

echo "✅ Services started"

# Step 6: Wait for services to initialize
echo -e "${YELLOW}⏳ Waiting for services to initialize...${NC}"
echo "Waiting 30 seconds for all services to start up..."

for i in {30..1}; do
    echo -n -e "\r⏳ $i seconds remaining..."
    sleep 1
done
echo ""

# Step 7: Run health check
echo -e "${YELLOW}🏥 Running comprehensive health check...${NC}"
if [ -f "scripts/health-check.sh" ]; then
    chmod +x scripts/health-check.sh
    if ./scripts/health-check.sh; then
        echo -e "${GREEN}✅ All services are healthy!${NC}"
    else
        echo -e "${RED}❌ Some services are not healthy. Check the output above.${NC}"
        echo ""
        echo "🔧 Troubleshooting commands:"
        echo "  docker compose ps                    # Check container status"
        echo "  docker logs [container-name]        # Check specific service logs"
        echo "  docker compose restart [service]    # Restart specific service"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️ Health check script not found, running basic checks...${NC}"
    
    # Basic container check
    echo "Checking containers..."
    docker compose ps
    
    # Basic API check
    echo "Checking API Gateway..."
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ API Gateway is responding"
    else
        echo -e "${RED}❌ API Gateway is not responding${NC}"
        exit 1
    fi
fi

# Step 8: Initialize databases if needed
echo -e "${YELLOW}🗄️ Checking database initialization...${NC}"

# Check if databases have data
content_tracks=$(docker exec sharklearning-postgres-courses-1 psql -U sharklearning -d sharklearning_courses -t -c "SELECT COUNT(*) FROM learning_tracks;" 2>/dev/null | xargs || echo "0")

if [ "$content_tracks" -eq "0" ]; then
    echo "🔄 Initializing content database with sample data..."
    docker exec -i sharklearning-postgres-courses-1 psql -U sharklearning -d sharklearning_courses < database/init-scripts/courses/init-content-service.sql
    echo "✅ Content database initialized"
else
    echo "✅ Content database already has data ($content_tracks tracks)"
fi

# Final status
echo ""
echo -e "${GREEN}🎉 Development environment is ready!${NC}"
echo "=========================================="
echo ""
echo "🌐 Available endpoints:"
echo "  • Frontend (Docker):  http://localhost:3040"
echo "  • API Gateway:        http://localhost:3000"
echo "  • API Documentation:  http://localhost:3000/api"
echo "  • User Service:       http://localhost:3001"
echo "  • Content Service:    http://localhost:8000"
echo "  • Progress Service:   http://localhost:3021"
echo ""
echo "🗄️ Database connections:"
echo "  • PostgreSQL (Users):    localhost:5432 (sharklearning_users)"
echo "  • PostgreSQL (Courses):  localhost:5433 (sharklearning_courses)"
echo "  • PostgreSQL (Learning): localhost:5434 (sharklearning_learning)"
echo "  • Redis:                 localhost:6379"
echo ""
echo "🔧 Useful commands:"
echo "  ./scripts/health-check.sh           # Run health check"
echo "  docker compose ps                   # Check container status"
echo "  docker compose logs [service]       # View service logs"
echo "  docker compose restart [service]    # Restart specific service"
echo "  docker compose down                 # Stop all services"
echo ""
echo -e "${BLUE}Happy coding! 🚀${NC}" 