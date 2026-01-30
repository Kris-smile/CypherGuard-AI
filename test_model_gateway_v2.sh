#!/bin/bash

# Test Model Gateway V2 - Real AI Integration
# This script tests the new model gateway with real API integrations

echo "========================================="
echo "Model Gateway V2 Integration Test"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Model Gateway URL (internal)
MODEL_GATEWAY_URL="http://model-gateway:8000"

echo "Step 1: Health Check"
echo "-------------------"
HEALTH=$(docker exec cypherguard-model-gateway curl -s http://localhost:8000/internal/health)
if [ "$HEALTH" == "Model Gateway V2 OK" ]; then
    echo -e "${GREEN}✓ Model Gateway V2 is running${NC}"
else
    echo -e "${RED}✗ Model Gateway V2 health check failed${NC}"
    exit 1
fi
echo ""

echo "Step 2: Test Mock Embedding (No Config)"
echo "---------------------------------------"
echo "Testing embedding generation with mock fallback..."
EMBED_RESULT=$(docker exec cypherguard-model-gateway curl -s -X POST \
    http://localhost:8000/internal/embeddings \
    -H "Content-Type: application/json" \
    -d '{"texts": ["Hello world", "Test document"]}')

if echo "$EMBED_RESULT" | grep -q "embeddings"; then
    echo -e "${GREEN}✓ Mock embedding generation works${NC}"
    echo "Response preview:"
    echo "$EMBED_RESULT" | python3 -m json.tool | head -20
else
    echo -e "${RED}✗ Embedding generation failed${NC}"
    echo "$EMBED_RESULT"
fi
echo ""

echo "Step 3: Test Mock Chat (No Config)"
echo "----------------------------------"
echo "Testing chat completion with mock fallback..."
CHAT_RESULT=$(docker exec cypherguard-model-gateway curl -s -X POST \
    http://localhost:8000/internal/chat \
    -H "Content-Type: application/json" \
    -d '{"messages": [{"role": "user", "content": "Hello, how are you?"}]}')

if echo "$CHAT_RESULT" | grep -q "content"; then
    echo -e "${GREEN}✓ Mock chat generation works${NC}"
    echo "Response:"
    echo "$CHAT_RESULT" | python3 -m json.tool
else
    echo -e "${RED}✗ Chat generation failed${NC}"
    echo "$CHAT_RESULT"
fi
echo ""

echo "Step 4: Test Mock Rerank (No Config)"
echo "------------------------------------"
echo "Testing document reranking with mock fallback..."
RERANK_RESULT=$(docker exec cypherguard-model-gateway curl -s -X POST \
    http://localhost:8000/internal/rerank \
    -H "Content-Type: application/json" \
    -d '{
        "query": "machine learning",
        "documents": [
            "Machine learning is a subset of artificial intelligence",
            "Python is a programming language",
            "Deep learning uses neural networks"
        ],
        "top_n": 2
    }')

if echo "$RERANK_RESULT" | grep -q "results"; then
    echo -e "${GREEN}✓ Mock rerank works${NC}"
    echo "Response:"
    echo "$RERANK_RESULT" | python3 -m json.tool
else
    echo -e "${RED}✗ Rerank failed${NC}"
    echo "$RERANK_RESULT"
fi
echo ""

echo "========================================="
echo "Mock Tests Complete!"
echo "========================================="
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Add real model configurations via the Settings page in the UI"
echo "2. Configure OpenAI API key for embeddings and chat"
echo "3. Configure Cohere API key for reranking (optional)"
echo "4. Configure Ollama endpoint for local models (optional)"
echo ""
echo "Example: Add OpenAI Embedding Model"
echo "-----------------------------------"
echo "POST http://localhost/models/"
echo '{'
echo '  "model_name": "text-embedding-3-small",'
echo '  "model_type": "embedding",'
echo '  "provider": "openai",'
echo '  "api_key": "sk-your-api-key-here",'
echo '  "base_url": "https://api.openai.com/v1",'
echo '  "enabled": true,'
echo '  "is_default": true'
echo '}'
echo ""
echo "Example: Add OpenAI Chat Model"
echo "------------------------------"
echo "POST http://localhost/models/"
echo '{'
echo '  "model_name": "gpt-4o-mini",'
echo '  "model_type": "chat",'
echo '  "provider": "openai",'
echo '  "api_key": "sk-your-api-key-here",'
echo '  "base_url": "https://api.openai.com/v1",'
echo '  "enabled": true,'
echo '  "is_default": true'
echo '}'
echo ""
echo "Example: Add Cohere Rerank Model"
echo "--------------------------------"
echo "POST http://localhost/models/"
echo '{'
echo '  "model_name": "rerank-english-v3.0",'
echo '  "model_type": "rerank",'
echo '  "provider": "cohere",'
echo '  "api_key": "your-cohere-api-key",'
echo '  "base_url": "https://api.cohere.ai/v1",'
echo '  "enabled": true,'
echo '  "is_default": true'
echo '}'
echo ""
