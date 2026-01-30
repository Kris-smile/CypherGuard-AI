#!/bin/bash

echo "=========================================="
echo "CypherGuard AI - Frontend Quick Start"
echo "=========================================="
echo ""

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo "[ERROR] Docker is not running!"
    echo "Please start Docker and try again."
    exit 1
fi

echo "[OK] Docker is running"
echo ""

echo "Starting all services with Docker Compose..."
docker-compose up -d

echo ""
echo "Waiting for services to be ready..."
sleep 10

echo ""
echo "Checking service status..."
docker-compose ps

echo ""
echo "=========================================="
echo "Services are starting up!"
echo "=========================================="
echo ""
echo "Please wait 30-60 seconds for all services to be fully ready."
echo ""
echo "Then open your browser and visit:"
echo "  http://localhost"
echo ""
echo "To check logs:"
echo "  docker-compose logs -f frontend"
echo "  docker-compose logs -f gateway"
echo ""
echo "To stop all services:"
echo "  docker-compose down"
echo ""
