@echo off
echo ==========================================
echo CypherGuard AI - Frontend Quick Start
echo ==========================================
echo.

echo Checking if Docker is running...
docker ps >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [OK] Docker is running
echo.

echo Starting all services with Docker Compose...
docker-compose up -d

echo.
echo Waiting for services to be ready...
timeout /t 10 /nobreak >nul

echo.
echo Checking service status...
docker-compose ps

echo.
echo ==========================================
echo Services are starting up!
echo ==========================================
echo.
echo Please wait 30-60 seconds for all services to be fully ready.
echo.
echo Then open your browser and visit:
echo   http://localhost
echo.
echo To check logs:
echo   docker-compose logs -f frontend
echo   docker-compose logs -f gateway
echo.
echo To stop all services:
echo   docker-compose down
echo.
pause
