#!/bin/bash

# SharkLearning Development Environment Startup Script
# This script starts all services in the correct order with proper configuration

set -e  # Exit on any error

echo "🦈 Starting SharkLearning Development Environment..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

print_status "Checking for port conflicts..."

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Stop any conflicting processes
print_status "Stopping any conflicting frontend processes..."
pkill -f "vite" 2>/dev/null || true
pkill -f "npm.*dev" 2>/dev/null || true

# Stop the Docker frontend container if it's running
print_status "Stopping Docker frontend container..."
docker stop sharklearning-frontend-1 2>/dev/null || true

# Start backend services with Docker Compose
print_status "Starting backend services (Docker Compose)..."
docker-compose up -d --build \
    api-gateway \
    user-service \
    content-service \
    progress-service \
    postgres-users \
    postgres-courses \
    postgres-learning \
    redis

# Wait for services to be healthy
print_status "Waiting for backend services to be healthy..."
max_attempts=30
attempt=0

services=("api-gateway" "user-service" "content-service" "progress-service")

for service in "${services[@]}"; do
    print_status "Checking health of $service..."
    while [ $attempt -lt $max_attempts ]; do
        if docker-compose ps $service | grep -q "healthy"; then
            print_success "$service is healthy!"
            break
        elif [ $attempt -eq $((max_attempts-1)) ]; then
            print_error "$service failed to become healthy after $max_attempts attempts"
            print_warning "Continuing anyway..."
            break
        else
            attempt=$((attempt+1))
            print_status "Waiting for $service to be healthy... (attempt $attempt/$max_attempts)"
            sleep 2
        fi
    done
    attempt=0
done

# Verify backend services are responding
print_status "Verifying backend services..."

# Check API Gateway
if curl -f http://localhost:3000/health >/dev/null 2>&1; then
    print_success "API Gateway (port 3000) is responding"
else
    print_warning "API Gateway health check failed, but continuing..."
fi

# Check if port 3000 is available for frontend
if check_port 3000; then
    print_warning "Port 3000 is in use. Frontend will find another port."
fi

# Start frontend development server
print_status "Starting frontend development server..."
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_status "Installing frontend dependencies..."
    npm install
fi

print_status "Starting Vite development server..."
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 5

# Find which port the frontend is using
frontend_port=$(lsof -ti:3000,3001,3002,3003,3004,3005 2>/dev/null | head -1 | xargs -I {} lsof -Pan -p {} -i 2>/dev/null | grep LISTEN | head -1 | sed -n 's/.*:\([0-9]*\).*/\1/p')

if [ -n "$frontend_port" ]; then
    print_success "Frontend is running on http://localhost:$frontend_port"
else
    print_error "Could not determine frontend port"
    frontend_port="3000+"
fi

# Display service status
echo ""
echo "🎉 SharkLearning Development Environment is Ready!"
echo "================================================="
echo ""
echo "📋 Service Status:"
echo "  🖥️  Frontend:         http://localhost:$frontend_port"
echo "  🌐 API Gateway:      http://localhost:3000"
echo "  👤 User Service:     http://localhost:3001"
echo "  📚 Content Service:  http://localhost:3011"
echo "  📊 Progress Service: http://localhost:3021"
echo "  🗄️  Redis:           localhost:6379"
echo ""
echo "🔧 Management URLs:"
echo "  📊 Prometheus:       http://localhost:9090"
echo "  📈 Grafana:          http://localhost:3030 (admin/admin)"
echo "  🔍 Jaeger:           http://localhost:16686"
echo "  📝 Kibana:           http://localhost:5601"
echo ""
echo "⚙️  Development Commands:"
echo "  Stop All:            docker-compose down"
echo "  View Logs:           docker-compose logs -f [service-name]"
echo "  Restart Service:     docker-compose restart [service-name]"
echo ""
print_success "Ready for development! 🚀"
echo ""

# Keep script running to maintain frontend process
print_status "Press Ctrl+C to stop all services..."
trap 'print_status "Stopping services..."; kill $FRONTEND_PID 2>/dev/null; docker-compose down; exit 0' INT

# Wait for frontend process
wait $FRONTEND_PID 