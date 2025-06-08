#!/bin/bash

# SharkLearning Development Script
# This script starts the entire development environment

echo "🦈 Starting SharkLearning Development Environment..."

# Kill any existing related servers (following the rules)
echo "🛑 Killing existing servers..."
pkill -f "node.*services" || true
pkill -f "docker-compose" || true
docker-compose down || true

# Install dependencies if not already installed
echo "📦 Installing dependencies..."
npm install

# Build Docker images
echo "🏗️ Building Docker images..."
docker-compose build

# Start the development environment
echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🔍 Checking service health..."
echo "API Gateway: http://localhost:8000/health"
curl -s http://localhost:8000/health | jq '.' || echo "API Gateway not ready yet"

echo "User Service: http://localhost:8001/health"
curl -s http://localhost:8001/health | jq '.' || echo "User Service not ready yet"

echo ""
echo "✅ Development environment started!"
echo ""
echo "🌐 Available services:"
echo "  - Frontend: http://localhost:3000"
echo "  - API Gateway: http://localhost:8000"
echo "  - User Service: http://localhost:8001"
echo "  - Content Service: http://localhost:8002"
echo "  - Progress Service: http://localhost:8003"
echo "  - Notification Service: http://localhost:8004"
echo "  - Admin Panel: http://localhost:3001"
echo ""
echo "📊 Database:"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo ""
echo "📝 Logs: docker-compose logs -f [service-name]"
echo "🛑 Stop: docker-compose down" 