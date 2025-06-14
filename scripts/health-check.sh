#!/bin/bash

# 🏥 SharkLearning Health Check Script
# Verifies all services are running and healthy

set -e

echo "🏥 Starting comprehensive health check..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check service health
check_service() {
    local service_name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Checking $service_name... "
    
    if response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null); then
        if [ "$response" -eq "$expected_status" ]; then
            echo -e "${GREEN}✅ Healthy (HTTP $response)${NC}"
            return 0
        else
            echo -e "${RED}❌ Unhealthy (HTTP $response)${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Unreachable${NC}"
        return 1
    fi
}

# Function to check Docker container status
check_container() {
    local container_name=$1
    echo -n "Checking container $container_name... "
    
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$container_name.*Up"; then
        echo -e "${GREEN}✅ Running${NC}"
        return 0
    else
        echo -e "${RED}❌ Not running${NC}"
        return 1
    fi
}

# Check Docker is running
echo "🐳 Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running or accessible${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"

# Check containers are running
echo ""
echo "📦 Checking Docker containers..."
containers=(
    "sharklearning-api-gateway-1"
    "sharklearning-user-service-1"
    "sharklearning-content-service-1"
    "sharklearning-progress-service-1"
    "sharklearning-frontend-1"
    "sharklearning-postgres-users-1"
    "sharklearning-postgres-courses-1"
    "sharklearning-postgres-learning-1"
    "sharklearning-redis-1"
)

container_failures=0
for container in "${containers[@]}"; do
    if ! check_container "$container"; then
        ((container_failures++))
    fi
done

# Check service health endpoints
echo ""
echo "🌐 Checking service health endpoints..."
services=(
    "API Gateway:http://localhost:3000/health"
    "User Service:http://localhost:3001/health"
    "Content Service:http://localhost:8000/health"
    "Progress Service:http://localhost:3021/health"
)

service_failures=0
for service_info in "${services[@]}"; do
    IFS=':' read -r name url <<< "$service_info"
    if ! check_service "$name" "$url"; then
        ((service_failures++))
    fi
done

# Check API Gateway routing
echo ""
echo "🔀 Checking API Gateway routing..."
api_routes=(
    "API Documentation:http://localhost:3000/api"
    "Content API:http://localhost:3000/api/content/tracks"
)

routing_failures=0
for route_info in "${api_routes[@]}"; do
    IFS=':' read -r name url <<< "$route_info"
    if ! check_service "$name" "$url"; then
        ((routing_failures++))
    fi
done

# Check frontend accessibility
echo ""
echo "🎨 Checking frontend accessibility..."
frontend_failures=0

# Check Docker frontend
echo -n "Checking Docker frontend (port 3040)... "
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3040" | grep -q "200"; then
    echo -e "${GREEN}✅ Accessible${NC}"
else
    echo -e "${RED}❌ Not accessible${NC}"
    ((frontend_failures++))
fi

# Check database connectivity
echo ""
echo "🗄️ Checking database connectivity..."
db_failures=0

databases=(
    "sharklearning-postgres-users-1:sharklearning_users"
    "sharklearning-postgres-courses-1:sharklearning_courses"
    "sharklearning-postgres-learning-1:sharklearning_learning"
)

for db_info in "${databases[@]}"; do
    IFS=':' read -r container db_name <<< "$db_info"
    echo -n "Checking $db_name database... "
    
    if docker exec "$container" psql -U sharklearning -d "$db_name" -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Connected${NC}"
    else
        echo -e "${RED}❌ Connection failed${NC}"
        ((db_failures++))
    fi
done

# Check Redis connectivity
echo -n "Checking Redis... "
if docker exec sharklearning-redis-1 redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Connected${NC}"
else
    echo -e "${RED}❌ Connection failed${NC}"
    ((db_failures++))
fi

# Summary
echo ""
echo "📊 Health Check Summary:"
echo "========================"

total_failures=$((container_failures + service_failures + routing_failures + frontend_failures + db_failures))

if [ $container_failures -eq 0 ]; then
    echo -e "Containers: ${GREEN}✅ All running${NC}"
else
    echo -e "Containers: ${RED}❌ $container_failures failed${NC}"
fi

if [ $service_failures -eq 0 ]; then
    echo -e "Services: ${GREEN}✅ All healthy${NC}"
else
    echo -e "Services: ${RED}❌ $service_failures failed${NC}"
fi

if [ $routing_failures -eq 0 ]; then
    echo -e "API Routing: ${GREEN}✅ Working${NC}"
else
    echo -e "API Routing: ${RED}❌ $routing_failures failed${NC}"
fi

if [ $frontend_failures -eq 0 ]; then
    echo -e "Frontend: ${GREEN}✅ Accessible${NC}"
else
    echo -e "Frontend: ${RED}❌ $frontend_failures failed${NC}"
fi

if [ $db_failures -eq 0 ]; then
    echo -e "Databases: ${GREEN}✅ Connected${NC}"
else
    echo -e "Databases: ${RED}❌ $db_failures failed${NC}"
fi

echo ""
if [ $total_failures -eq 0 ]; then
    echo -e "${GREEN}🎉 All systems healthy! Ready for development.${NC}"
    echo ""
    echo "🌐 Available endpoints:"
    echo "  • Frontend (Docker): http://localhost:3040"
    echo "  • API Gateway: http://localhost:3000"
    echo "  • API Documentation: http://localhost:3000/api"
    exit 0
else
    echo -e "${RED}⚠️  $total_failures issues found. Please fix before continuing.${NC}"
    echo ""
    echo "🔧 Troubleshooting tips:"
    echo "  • Check logs: docker logs [container-name]"
    echo "  • Restart services: docker compose restart [service-name]"
    echo "  • Rebuild if needed: docker compose build [service-name]"
    echo "  • Full reset: docker compose down --volumes && docker compose up --build -d"
    exit 1
fi 