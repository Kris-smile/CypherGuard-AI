#!/bin/bash

# Test Ollama Integration Features
# This script tests the new Ollama connection test and model detection features

echo "========================================="
echo "Ollama Integration Test"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Step 1: Test Ollama Connection (Chat Models)"
echo "--------------------------------------------"
echo "Testing connection to http://localhost:11434..."

RESULT=$(docker exec cypherguard-model-config curl -s -X POST \
    http://localhost:8000/models/test-ollama-connection \
    -H "Content-Type: application/json" \
    -d '{
        "base_url": "http://localhost:11434",
        "model_type": "chat"
    }')

if echo "$RESULT" | grep -q "success"; then
    echo -e "${GREEN}✓ Connection test endpoint works${NC}"
    echo "Response:"
    echo "$RESULT" | python3 -m json.tool
else
    echo -e "${YELLOW}⚠ Connection test returned error (expected if Ollama not running)${NC}"
    echo "Response:"
    echo "$RESULT" | python3 -m json.tool
fi
echo ""

echo "Step 2: Test Ollama Connection (Embedding Models)"
echo "-------------------------------------------------"
echo "Testing connection for embedding models..."

RESULT=$(docker exec cypherguard-model-config curl -s -X POST \
    http://localhost:8000/models/test-ollama-connection \
    -H "Content-Type: application/json" \
    -d '{
        "base_url": "http://localhost:11434",
        "model_type": "embedding"
    }')

if echo "$RESULT" | grep -q "success"; then
    echo -e "${GREEN}✓ Embedding model detection works${NC}"
    echo "Response:"
    echo "$RESULT" | python3 -m json.tool
else
    echo -e "${YELLOW}⚠ Connection test returned error (expected if Ollama not running)${NC}"
    echo "Response:"
    echo "$RESULT" | python3 -m json.tool
fi
echo ""

echo "Step 3: Test Invalid URL"
echo "------------------------"
echo "Testing with invalid URL (should fail gracefully)..."

RESULT=$(docker exec cypherguard-model-config curl -s -X POST \
    http://localhost:8000/models/test-ollama-connection \
    -H "Content-Type: application/json" \
    -d '{
        "base_url": "http://invalid-host:11434",
        "model_type": "chat"
    }')

if echo "$RESULT" | grep -q "detail"; then
    echo -e "${GREEN}✓ Error handling works correctly${NC}"
    echo "Error message:"
    echo "$RESULT" | python3 -m json.tool
else
    echo -e "${RED}✗ Unexpected response${NC}"
    echo "$RESULT"
fi
echo ""

echo "========================================="
echo "Test Complete!"
echo "========================================="
echo ""
echo -e "${YELLOW}Notes:${NC}"
echo "1. If Ollama is not running, connection tests will fail (expected)"
echo "2. To test with real Ollama:"
echo "   - Install Ollama: https://ollama.ai"
echo "   - Run: ollama serve"
echo "   - Pull a model: ollama pull llama3.2"
echo "   - Pull an embedding model: ollama pull nomic-embed-text"
echo "   - Re-run this test"
echo ""
echo "3. Frontend changes:"
echo "   - Ollama provider hides API Key field"
echo "   - Shows 'Test Connection' button"
echo "   - Auto-detects available models"
echo "   - Shows model dropdown after successful test"
echo ""
