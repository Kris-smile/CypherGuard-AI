#!/bin/bash
# CypherGuard AI - Phase 2 功能演示脚本

echo "========================================="
echo "CypherGuard AI - Phase 2 功能演示"
echo "========================================="
echo ""

# 1. 测试用户注册
echo "1. 测试用户注册..."
REGISTER_RESPONSE=$(curl -s -X POST "http://localhost/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","username":"testuser","password":"test123456"}')

echo "$REGISTER_RESPONSE" | python -m json.tool
echo ""

# 提取 token
TOKEN=$(echo "$REGISTER_RESPONSE" | python -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ 注册失败"
    exit 1
fi

echo "✅ 注册成功！Token: ${TOKEN:0:50}..."
echo ""

# 2. 测试用户登录
echo "2. 测试用户登录..."
LOGIN_RESPONSE=$(curl -s -X POST "http://localhost/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"test123456"}')

echo "$LOGIN_RESPONSE" | python -m json.tool
echo ""
echo "✅ 登录成功！"
echo ""

# 3. 测试文档列表
echo "3. 测试获取文档列表..."
curl -s -X GET "http://localhost/kb/documents" | python -m json.tool
echo ""
echo "✅ 文档列表获取成功！"
echo ""

# 4. 测试文件上传（创建一个测试文件）
echo "4. 测试文件上传..."
echo "这是一个测试文档的内容。" > /tmp/test_document.txt

UPLOAD_RESPONSE=$(curl -s -X POST "http://localhost/kb/documents/upload" \
  -F "file=@/tmp/test_document.txt" \
  -F "title=测试文档" \
  -F "tags=test,demo")

echo "$UPLOAD_RESPONSE" | python -m json.tool
echo ""

# 提取 document_id
DOC_ID=$(echo "$UPLOAD_RESPONSE" | python -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

if [ -z "$DOC_ID" ]; then
    echo "❌ 文件上传失败"
else
    echo "✅ 文件上传成功！Document ID: $DOC_ID"
    echo ""

    # 5. 查看任务状态
    echo "5. 查看文档处理任务状态..."
    sleep 2
    curl -s -X GET "http://localhost/kb/tasks?document_id=$DOC_ID" | python -m json.tool
    echo ""
    echo "✅ 任务状态查询成功！"
    echo ""

    # 6. 查看 worker 日志
    echo "6. 查看 Worker 处理日志..."
    docker logs cypherguard-worker 2>&1 | grep -A 10 "Processing document" | tail -15
    echo ""
fi

echo "========================================="
echo "Phase 2 功能演示完成！"
echo "========================================="
