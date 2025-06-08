#!/bin/bash

# 🧪 SharkLearning Comprehensive Test Runner
# This script runs all tests across the entire platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo -e "${PURPLE}🧪 SharkLearning Comprehensive Test Suite${NC}"
echo -e "${PURPLE}==========================================${NC}\n"

# Function to run tests for a service
run_service_tests() {
    local service_name=$1
    local service_path=$2
    local test_type=$3
    
    echo -e "${BLUE}📦 Testing $service_name - $test_type${NC}"
    echo -e "${CYAN}─────────────────────────────────────${NC}"
    
    cd "$service_path"
    
    if [ ! -f "package.json" ]; then
        echo -e "${YELLOW}⚠️  No package.json found, skipping $service_name${NC}\n"
        return
    fi
    
    # Check if test script exists
    if ! npm run | grep -q "test"; then
        echo -e "${YELLOW}⚠️  No test script found, skipping $service_name${NC}\n"
        return
    fi
    
    echo "Running: npm run test"
    
    if npm run test 2>&1; then
        echo -e "${GREEN}✅ $service_name $test_type tests PASSED${NC}\n"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}❌ $service_name $test_type tests FAILED${NC}\n"
        ((FAILED_TESTS++))
    fi
    
    ((TOTAL_TESTS++))
    cd - > /dev/null
}

# Function to run integration tests with real services
run_integration_tests() {
    local service_name=$1
    local service_path=$2
    
    echo -e "${BLUE}🔗 Integration Testing $service_name${NC}"
    echo -e "${CYAN}─────────────────────────────────────${NC}"
    
    cd "$service_path"
    
    # Check if integration test script exists
    if npm run | grep -q "test:integration"; then
        echo "Running: npm run test:integration"
        
        if npm run test:integration 2>&1; then
            echo -e "${GREEN}✅ $service_name integration tests PASSED${NC}\n"
            ((PASSED_TESTS++))
        else
            echo -e "${RED}❌ $service_name integration tests FAILED${NC}\n"
            ((FAILED_TESTS++))
        fi
        ((TOTAL_TESTS++))
    else
        echo -e "${YELLOW}⚠️  No integration tests found for $service_name${NC}\n"
    fi
    
    cd - > /dev/null
}

# Function to check if services are running
check_services() {
    echo -e "${BLUE}🔍 Checking Service Health${NC}"
    echo -e "${CYAN}─────────────────────────────────────${NC}"
    
    # Check if Docker services are running
    if docker-compose -f docker-compose.simple.yml ps | grep -q "Up"; then
        echo -e "${GREEN}✅ Docker services are running${NC}"
    else
        echo -e "${YELLOW}⚠️  Docker services not running, starting them...${NC}"
        docker-compose -f docker-compose.simple.yml up -d
        sleep 10
    fi
    
    # Health check endpoints
    services=(
        "user-service:3001/health"
        "content-service:3002/health"
        "progress-service:3003/health"
        "api-gateway:3000/health"
    )
    
    for service in "${services[@]}"; do
        service_name=$(echo $service | cut -d: -f1)
        endpoint=$(echo $service | cut -d: -f2-)
        
        if curl -s http://localhost:$endpoint > /dev/null; then
            echo -e "${GREEN}✅ $service_name is healthy${NC}"
        else
            echo -e "${RED}❌ $service_name is not responding${NC}"
        fi
    done
    echo ""
}

# Function to run all tests with coverage
run_coverage_tests() {
    echo -e "${PURPLE}📊 Running Coverage Tests${NC}"
    echo -e "${CYAN}─────────────────────────────────────${NC}"
    
    # Backend services coverage
    services=("user-service" "progress-service" "content-service")
    
    for service in "${services[@]}"; do
        if [ -d "services/$service" ]; then
            echo -e "${BLUE}📊 Coverage for $service${NC}"
            cd "services/$service"
            
            if npm run | grep -q "test:coverage"; then
                npm run test:coverage 2>/dev/null || echo -e "${YELLOW}⚠️  Coverage failed for $service${NC}"
            fi
            
            cd - > /dev/null
        fi
    done
    
    # Frontend coverage
    if [ -d "frontend" ]; then
        echo -e "${BLUE}📊 Coverage for frontend${NC}"
        cd frontend
        
        if npm run | grep -q "test:coverage"; then
            npm run test:coverage 2>/dev/null || echo -e "${YELLOW}⚠️  Coverage failed for frontend${NC}"
        fi
        
        cd - > /dev/null
    fi
    echo ""
}

# Function to generate test report
generate_report() {
    echo -e "${PURPLE}📋 Test Summary Report${NC}"
    echo -e "${PURPLE}=====================${NC}"
    echo -e "Total Test Suites: ${BLUE}$TOTAL_TESTS${NC}"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}💥 Some tests failed!${NC}"
        exit 1
    fi
}

# Main execution
main() {
    # Parse command line arguments
    RUN_INTEGRATION=false
    RUN_COVERAGE=false
    CHECK_SERVICES=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --integration)
                RUN_INTEGRATION=true
                shift
                ;;
            --coverage)
                RUN_COVERAGE=true
                shift
                ;;
            --check-services)
                CHECK_SERVICES=true
                shift
                ;;
            --all)
                RUN_INTEGRATION=true
                RUN_COVERAGE=true
                CHECK_SERVICES=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 [--integration] [--coverage] [--check-services] [--all]"
                exit 1
                ;;
        esac
    done
    
    # Check services if requested
    if [ "$CHECK_SERVICES" = true ]; then
        check_services
    fi
    
    # Run unit tests for all services
    echo -e "${PURPLE}🧪 Running Unit Tests${NC}"
    echo -e "${PURPLE}===================${NC}\n"
    
    # Backend services
    if [ -d "services/user-service" ]; then
        run_service_tests "User Service" "services/user-service" "Unit"
    fi
    
    if [ -d "services/progress-service" ]; then
        run_service_tests "Progress Service" "services/progress-service" "Unit"
    fi
    
    if [ -d "services/content-service" ]; then
        run_service_tests "Content Service" "services/content-service" "Unit"
    fi
    
    # Frontend tests
    if [ -d "frontend" ]; then
        run_service_tests "Frontend" "frontend" "Component"
    fi
    
    # Run integration tests if requested
    if [ "$RUN_INTEGRATION" = true ]; then
        echo -e "${PURPLE}🔗 Running Integration Tests${NC}"
        echo -e "${PURPLE}===========================${NC}\n"
        
        if [ -d "services/user-service" ]; then
            run_integration_tests "User Service" "services/user-service"
        fi
        
        if [ -d "services/progress-service" ]; then
            run_integration_tests "Progress Service" "services/progress-service"
        fi
    fi
    
    # Run coverage tests if requested
    if [ "$RUN_COVERAGE" = true ]; then
        run_coverage_tests
    fi
    
    # Generate final report
    generate_report
}

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ] && [ ! -f "docker-compose.simple.yml" ]; then
    echo -e "${RED}❌ Please run this script from the SharkLearning root directory${NC}"
    exit 1
fi

# Run main function with all arguments
main "$@" 