#!/bin/bash

# 🔍 SharkLearning Configuration Validation Script
# Ensures all configuration files are synchronized

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Validating SharkLearning Configuration${NC}"
echo "=========================================="

validation_errors=0

# Function to report validation error
report_error() {
    echo -e "${RED}❌ $1${NC}"
    ((validation_errors++))
}

# Function to report success
report_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

echo "🔍 Checking Docker Compose port mappings..."

# Check Docker Compose port mappings using arrays
services=("api-gateway" "user-service" "content-service" "progress-service" "frontend")
expected_mappings=("3000:3000" "3001:3001" "8000:8000" "3021:3021" "3040:80")

for i in "${!services[@]}"; do
    service="${services[$i]}"
    expected="${expected_mappings[$i]}"
    actual=$(grep -A 5 "^  $service:" docker-compose.yml | grep -E "^\s*-\s*\"[0-9]+:[0-9]+\"" | head -1 | sed 's/.*"\([0-9]*:[0-9]*\)".*/\1/' 2>/dev/null || echo "NOT_FOUND")
    
    if [ "$actual" = "$expected" ]; then
        report_success "$service port mapping: $actual"
    else
        report_error "$service port mapping mismatch. Expected: $expected, Found: $actual"
    fi
done

echo ""
echo "🔍 Checking API Gateway service routing..."

# Check API Gateway routing configuration
if [ -f "services/api-gateway/src/server.js" ]; then
    # Check if API Gateway routes match expected services
    api_gateway_file="services/api-gateway/src/server.js"
    
    # Check user service URL
    if grep -q "user-service:3001" "$api_gateway_file"; then
        report_success "API Gateway -> User Service routing"
    else
        report_error "API Gateway user service URL mismatch"
    fi
    
    # Check content service URL
    if grep -q "content-service:8000" "$api_gateway_file"; then
        report_success "API Gateway -> Content Service routing"
    else
        report_error "API Gateway content service URL mismatch"
    fi
    
    # Check progress service URL
    if grep -q "progress-service:3021" "$api_gateway_file"; then
        report_success "API Gateway -> Progress Service routing"
    else
        report_error "API Gateway progress service URL mismatch"
    fi
else
    report_error "API Gateway server.js not found"
fi

echo ""
echo "🔍 Checking Frontend proxy configuration..."

# Check frontend Nginx configuration
if [ -f "frontend/nginx.conf" ]; then
    nginx_conf="frontend/nginx.conf"
    
    # Check if Nginx proxies to correct API Gateway port
    if grep -q "proxy_pass.*:3000" "$nginx_conf"; then
        report_success "Frontend Nginx -> API Gateway proxy"
    else
        report_error "Frontend Nginx proxy configuration mismatch"
    fi
else
    report_error "Frontend nginx.conf not found"
fi

echo ""
echo "🔍 Checking service package.json configurations..."

# Check service package.json files for correct ports
service_names=("api-gateway" "user-service" "content-service" "progress-service")
expected_service_ports=("3000" "3001" "8000" "3021")

for i in "${!service_names[@]}"; do
    service="${service_names[$i]}"
    expected_port="${expected_service_ports[$i]}"
    package_json="services/$service/package.json"
    
    if [ -f "$package_json" ]; then
        # Check if package.json has correct port configuration
        if grep -q "\"PORT\".*$expected_port" "$package_json" || grep -q "port.*$expected_port" "$package_json"; then
            report_success "$service package.json port configuration"
        else
            # This might not be an error if port is configured via environment variables
            echo -e "${YELLOW}⚠️ $service package.json: port not explicitly set (using env vars)${NC}"
        fi
    else
        report_error "$service package.json not found"
    fi
done

echo ""
echo "🔍 Checking database configuration consistency..."

# Check database URLs in docker-compose.yml
db_service_names=("postgres-users" "postgres-courses" "postgres-learning")

for service in "${db_service_names[@]}"; do
    if grep -A 10 "^  $service:" docker-compose.yml | grep -q "POSTGRES_DB"; then
        report_success "$service database configuration found"
    else
        report_error "$service database configuration missing"
    fi
done

echo ""
echo "🔍 Checking environment variable consistency..."

# Check if .env.example exists and has required variables
if [ -f ".env.example" ]; then
    required_env_vars=("JWT_SECRET" "DATABASE_URL" "REDIS_URL" "NODE_ENV")
    
    for var in "${required_env_vars[@]}"; do
        if grep -q "^$var=" ".env.example"; then
            report_success ".env.example has $var"
        else
            report_error ".env.example missing $var"
        fi
    done
else
    report_error ".env.example file not found"
fi

echo ""
echo "🔍 Checking required directories and files..."

# Check required directories
required_dirs=(
    "services/api-gateway/src"
    "services/user-service/src"
    "services/content-service/src"
    "services/progress-service/src"
    "frontend/src"
    "database/init-scripts"
)

for dir in "${required_dirs[@]}"; do
    if [ -d "$dir" ]; then
        report_success "Directory exists: $dir"
    else
        report_error "Directory missing: $dir"
    fi
done

# Check required files
required_files=(
    "docker-compose.yml"
    "frontend/Dockerfile"
    "frontend/nginx.conf"
    "database/init-scripts/courses/init-content-service.sql"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        report_success "File exists: $file"
    else
        report_error "File missing: $file"
    fi
done

echo ""
echo "📊 Configuration Validation Summary:"
echo "===================================="

if [ $validation_errors -eq 0 ]; then
    echo -e "${GREEN}🎉 All configurations are valid and synchronized!${NC}"
    echo ""
    echo "✅ Port mappings are consistent"
    echo "✅ Service routing is correct"
    echo "✅ Proxy configurations match"
    echo "✅ Required files and directories exist"
    echo ""
    echo -e "${GREEN}Your environment is ready for development!${NC}"
    exit 0
else
    echo -e "${RED}⚠️ Found $validation_errors configuration issues${NC}"
    echo ""
    echo "🔧 Please fix the issues above before starting development."
    echo ""
    echo "Common fixes:"
    echo "  • Update port mappings in docker-compose.yml"
    echo "  • Synchronize API Gateway routing with service ports"
    echo "  • Update frontend proxy configurations"
    echo "  • Ensure all required files exist"
    echo ""
    echo "After fixing issues, run this script again to validate."
    exit 1
fi 