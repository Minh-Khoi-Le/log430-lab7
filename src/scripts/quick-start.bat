@echo off
REM Unified Quick Start Script for LOG430 Lab 7
REM Complete system with Event-Driven Architecture and Choreographed Sagas

echo ========================================
echo   LOG430 Lab 7 - Complete System
echo   Event-Driven Architecture + Sagas
echo ========================================
echo.

echo [1/10] Stopping and removing all containers...
docker-compose down -v

echo.
echo [2/10] Building all Docker images...
docker-compose build

echo.
echo [3/10] Starting infrastructure services...
docker-compose up -d postgres redis mongodb rabbitmq prometheus grafana

echo.
echo [4/10] Waiting for infrastructure to be ready (10 seconds)...
timeout /t 10 /nobreak

echo.
echo [5/10] Setting up RabbitMQ queues and exchanges...
docker-compose run --rm --profile setup rabbitmq-setup

echo.
echo [6/10] Running database migrations...
docker-compose run --rm db-migrate

echo.
echo [7/10] Starting all microservices...
docker-compose up -d user-service catalog-service transaction-service complaint-service notification-service audit-service event-store-service

echo.
echo [8/10] Starting Kong API Gateway...
docker-compose up -d kong

echo.
echo [9/10] Waiting for Kong Gateway to be ready...
:wait_kong
curl -s http://localhost:8001/status > nul 2>&1
if %errorlevel% neq 0 (
    echo Kong not ready, waiting 5 seconds...
    timeout /t 5 /nobreak >nul
    goto wait_kong
)
echo Kong is ready!

echo.
echo [10/10] Seeding database with demo data...
docker-compose run --rm db-seed

echo.
echo ========================================
echo   Health Check - All Services
echo ========================================
echo.
curl -s http://localhost:3001/health && echo ✓ User Service OK || echo  User Service Error
curl -s http://localhost:3002/health && echo ✓ Catalog Service OK || echo  Catalog Service Error  
curl -s http://localhost:3003/health && echo ✓ Transaction Service OK || echo  Transaction Service Error
curl -s http://localhost:3005/health && echo ✓ Complaint Service OK || echo  Complaint Service Error
curl -s http://localhost:3006/health && echo ✓ Notification Service OK || echo  Notification Service Error
curl -s http://localhost:3007/health && echo ✓ Audit Service OK || echo  Audit Service Error
curl -s http://localhost:3008/health && echo ✓ Event Store Service OK || echo  Event Store Service Error

echo.
echo Starting frontend locally on http://localhost:5173 ...
cd /d "%~dp0..\web-client"
call npm install
start cmd /k "npm run dev"
cd /d "%~dp0"
echo Frontend started in a new terminal window.

echo.
echo ========================================
echo   LOG430 Lab 7 - System Ready!
echo ========================================
echo.
echo  Access Points:
echo - Web Client: http://localhost:5173
echo - API Gateway: http://localhost:8000  
echo - Kong Admin: http://localhost:8001
echo - RabbitMQ Management: http://localhost:15672 (admin/admin123)
echo - Prometheus: http://localhost:9090
echo - Grafana: http://localhost:3004 (admin/admin)
echo.
echo  Microservices:
echo - User Service: http://localhost:3001
echo - Catalog Service: http://localhost:3002
echo - Transaction Service: http://localhost:3003
echo - Complaint Service: http://localhost:3005
echo - Notification Service: http://localhost:3006
echo - Audit Service: http://localhost:3007
echo - Event Store Service: http://localhost:3008
echo.
echo  Demo Login Credentials:
echo - Admin: admin / admin123
echo - Client: client / client123
echo.
echo  Test Event-Driven Features:
echo   .\simulate-success-scenario.bat
echo   .\simulate-saga-failure.bat
echo.
echo System startup completed! Press any key to exit...
pause
