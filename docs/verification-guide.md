# CypherGuard AI 系统验证与优化指南

> 本文档提供详细的操作步骤，用于验证系统功能、性能测试、安全审计和部署准备。

---

## 📋 目录

1. [立即验证：图片持久化和Vision格式](#step1)
2. [端到端测试：18个功能模块](#step2)
3. [性能压测：大规模文档和并发](#step3)
4. [安全审计：加密和配置](#step4)
5. [部署准备：生产环境检查](#step5)

---

## <a id="step1"></a>步骤 1：立即验证 M13/M16（图片持久化和Vision格式）

### 1.1 验证图片持久化（M13）

**目标**：确认图片发送后能存入数据库，刷新页面后仍能显示。

#### 操作步骤：

**A. 检查数据库结构**
```powershell
# 连接到 PostgreSQL
docker exec -it cypherguard-postgres psql -U postgres -d cypherguard

# 检查 messages 表是否有 images_json 列
\d messages

# 应该看到：
# images_json | jsonb |

# 退出
\q
```

**B. 前端代码验证**
```powershell
# 检查前端是否正确读取 images_json
```

**需要检查的文件**：
- `frontend/src/pages/Chat.tsx` - MessageBubble 组件
- `frontend/src/services/api.ts` - Message 类型定义

**C. 功能测试**
1. 启动系统：`docker compose up -d`
2. 访问 `http://localhost:5173`
3. 登录并进入对话页面
4. 粘贴一张图片（Ctrl+V）或点击附件按钮上传
5. 发送消息
6. **刷新页面**（F5）
7. **验证点**：图片是否仍然显示在消息中

**D. 数据库验证**
```sql
-- 查询最近的消息，检查 images_json 字段
SELECT id, role, content, images_json, created_at
FROM messages
WHERE images_json IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

**预期结果**：
- ✅ `images_json` 字段包含 base64 图片数据
- ✅ 刷新页面后图片仍然显示
- ❌ 如果图片消失，需要修复前端回显逻辑

---

### 1.2 验证 Vision API 格式（M16）

**目标**：确认图片以正确格式传递给 OpenAI/Ollama Vision 模型。

#### 操作步骤：

**A. 检查后端代码**
```powershell
# 检查 chat-service 是否正确构建 Vision 消息格式
```

**需要检查的文件**：
- `services/chat-service/app/main.py` - `build_context_prompt` 函数
- `services/model-gateway/app/main.py` - `/internal/chat/stream` 端点

**B. 代码审查要点**

**OpenAI Vision 格式**（应该是）：
```python
{
    "role": "user",
    "content": [
        {"type": "text", "text": "用户问题"},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}
    ]
}
```

**Ollama Vision 格式**（应该是）：
```python
{
    "role": "user",
    "content": "用户问题",
    "images": ["base64_string_without_prefix"]
}
```

**C. 功能测试**
1. 配置一个 Vision 模型（如 `gpt-4o` 或 Ollama `llava`）
2. 在对话中上传一张包含文字的图片
3. 提问："图片中有什么内容？"
4. **验证点**：AI 是否能正确识别图片内容

**D. 日志验证**
```powershell
# 查看 chat-service 日志
docker compose logs -f chat-service | grep -i "image\|vision"

# 查看 model-gateway 日志
docker compose logs -f model-gateway | grep -i "image\|vision"
```

**预期结果**：
- ✅ AI 能正确描述图片内容
- ✅ 日志显示正确的消息格式
- ❌ 如果 AI 无法识别图片，需要修复格式转换逻辑

---

## <a id="step2"></a>步骤 2：端到端测试（18个功能模块）

### 2.1 测试准备

**A. 准备测试数据**
```powershell
# 创建测试文档目录
mkdir -p test_data

# 准备测试文件（需要手动准备）：
# - test.pdf (包含文字的PDF)
# - test.docx (Word文档)
# - test.xlsx (Excel表格)
# - test.csv (CSV文件)
# - test.pptx (PowerPoint)
# - test_image.png (包含文字的图片)
```

**B. 准备测试账号**
```sql
-- 创建测试用户（如果需要）
INSERT INTO users (email, username, password_hash, role)
VALUES ('test@cypherguard.local', 'testuser', 'hashed_password', 'user');
```

---

### 2.2 模块测试清单

#### ✅ M1: 文档解析增强
**测试步骤**：
1. 进入 Knowledge Core 页面
2. 创建新知识库："测试知识库"
3. 依次上传：PDF、DOCX、XLSX、CSV、PPTX
4. 点击每个文档的"学习"按钮
5. 等待状态变为 `ready`
6. **验证点**：所有格式都能成功解析

**验证命令**：
```sql
SELECT title, mime_type, status FROM documents ORDER BY created_at DESC LIMIT 10;
```

---

#### ✅ M2: 混合检索引擎
**测试步骤**：
1. 上传一个包含关键词"CVE-2024-1234"的文档
2. 进入对话页面
3. 提问："CVE-2024-1234 是什么漏洞？"
4. **验证点**：能准确召回包含该关键词的文档

**验证命令**：
```sql
-- 检查 BM25 索引
SELECT id, text FROM chunks WHERE tsv @@ to_tsquery('CVE') LIMIT 5;
```

---

#### ✅ M3: 流式响应 SSE
**测试步骤**：
1. 进入对话页面
2. 发送任意问题
3. **验证点**：回答逐字显示（打字机效果）

**浏览器验证**：
- 打开开发者工具 → Network → 找到 `/messages?stream=true`
- 查看 Response 是否为 `text/event-stream`

---

#### ✅ M4: 多轮上下文管理
**测试步骤**：
1. 第一轮："什么是 SQL 注入？"
2. 第二轮："它的危害有哪些？"（指代消解）
3. 第三轮："如何防御？"
4. **验证点**：AI 能理解"它"指的是 SQL 注入

---

#### ✅ M5: FAQ 知识库
**测试步骤**：
1. 创建 FAQ 类型知识库
2. 添加 Q&A 对：
   - Q: "如何重置密码？"
   - A: "点击登录页面的忘记密码链接。"
3. 在对话中提问："怎么重置密码？"
4. **验证点**：AI 引用 FAQ 回答

**验证命令**：
```sql
SELECT * FROM faq_entries;
```

---

#### ✅ M6: Web 搜索集成
**测试步骤**：
1. 进入对话页面
2. 点击工具栏的"网络搜索"图标（Globe）开启
3. 提问："2026年最新的网络安全趋势"
4. **验证点**：回答包含实时信息，引用来源标注为 `web_search`

---

#### ✅ M7: 文档摘要与标签
**测试步骤**：
1. 上传文档并学习
2. 查看文档卡片
3. **验证点**：显示自动生成的摘要
4. 添加标签："安全", "漏洞"
5. 按标签筛选文档

**验证命令**：
```sql
SELECT title, summary, tags FROM documents WHERE summary IS NOT NULL;
```

---

#### ✅ M8: Chunk 管理
**测试步骤**：
1. 点击文档进入详情页
2. 查看 Chunk 列表
3. 编辑某个 Chunk 的内容
4. 禁用某个 Chunk
5. 在对话中提问相关内容
6. **验证点**：被禁用的 Chunk 不会被召回

**验证命令**：
```sql
SELECT id, text, is_enabled FROM chunks WHERE document_id = 'your_doc_id';
```

---

#### ✅ M9: Agent 模式
**测试步骤**：
1. 进入对话页面
2. 点击工具栏的"模型"图标（Cpu）
3. 开启 Agent 模式
4. 提问："搜索知识库中关于 XSS 的文档，然后总结防御方法"
5. **验证点**：AI 自动调用 `knowledge_search` 工具，显示推理步骤

---

#### ✅ M10: 前端功能完善
**测试步骤**：
- 流式对话 UI ✅
- FAQ 管理页 ✅
- Chunk 查看器 ✅
- 任务进度 ✅
- 文档摘要展示 ✅
- Web 搜索开关 ✅
- 标签管理 ✅
- Agent 步骤展示 ✅
- 模型管理页 ✅

---

#### ✅ M11: 安全增强
**测试步骤**：
1. 登录后，等待 15 分钟（Access Token 过期）
2. 发送请求
3. **验证点**：自动使用 Refresh Token 续期，无需重新登录

**验证命令**：
```powershell
# 检查 Nginx 安全头
curl -I http://localhost
# 应该看到：
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
```

---

#### ✅ M12: 网安实体抽取
**测试步骤**：
1. 上传包含以下内容的文档：
   - CVE-2024-1234
   - 192.168.1.1
   - example.com
   - d41d8cd98f00b204e9800998ecf8427e (MD5)
2. 学习文档
3. **验证点**：实体被自动提取

**验证命令**：
```sql
SELECT entity_type, value, count FROM entities WHERE document_id = 'your_doc_id';
```

---

#### ✅ M13: 对话图片持久化
**测试步骤**：见 [步骤 1.1](#step1)

---

#### ✅ M14: 聊天模型选择
**测试步骤**：
1. 配置多个 Chat 模型（如 gpt-4o-mini, gpt-4o）
2. 进入对话页面
3. 点击工具栏"模型"图标
4. 切换模型
5. 发送消息
6. **验证点**：回答来自选定的模型

**验证日志**：
```powershell
docker compose logs -f model-gateway | grep "model_name"
```

---

#### ✅ M15: 知识库学习按钮
**测试步骤**：
1. 上传文档
2. **验证点**：状态为 `pending`，不自动处理
3. 点击"学习"按钮
4. **验证点**：状态变为 `processing` → `ready`

---

#### ✅ M16: 多模态 Vision 格式
**测试步骤**：见 [步骤 1.2](#step1)

---

#### ✅ M17: 上传与处理解耦
**测试步骤**：见 M15

---

#### ✅ M18: 对话输入栏重构
**测试步骤**：
1. 进入对话页面
2. **验证点**：输入框下方有工具栏，包含：
   - Cpu 图标（模型选择）
   - Globe 图标（网络搜索）
   - Trash2 图标（清空消息）
   - BookOpen 图标（引用知识库）

---

## <a id="step3"></a>步骤 3：性能压测

### 3.1 大规模文档测试

**目标**：测试系统处理大量文档的能力。

#### 操作步骤：

**A. 准备测试数据**
```powershell
# 创建 100 个测试文档（Python 脚本）
python scripts/generate_test_docs.py --count 100 --output test_data/
```

**B. 批量上传**
```powershell
# 使用 API 批量上传
python scripts/bulk_upload.py --dir test_data/ --kb-id <your_kb_id>
```

**C. 监控性能**
```powershell
# 监控 Worker 日志
docker compose logs -f worker

# 监控数据库连接
docker exec -it cypherguard-postgres psql -U postgres -d cypherguard -c "SELECT count(*) FROM pg_stat_activity;"

# 监控 Qdrant 内存
docker stats cypherguard-qdrant
```

**D. 性能指标**
- 文档处理速度：每分钟处理多少个文档
- 内存使用：Qdrant 和 PostgreSQL 内存占用
- 检索延迟：查询响应时间

**预期结果**：
- ✅ 100 个文档能在 30 分钟内处理完成
- ✅ 内存使用稳定，无内存泄漏
- ✅ 检索延迟 < 2 秒

---

### 3.2 并发对话测试

**目标**：测试系统处理并发请求的能力。

#### 操作步骤：

**A. 准备压测工具**
```powershell
# 安装 locust
pip install locust
```

**B. 创建压测脚本**
```python
# scripts/load_test.py
from locust import HttpUser, task, between

class ChatUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        # 登录获取 token
        response = self.client.post("/auth/login", json={
            "username": "test@cypherguard.local",
            "password": "test123"
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    @task
    def send_message(self):
        # 创建对话
        conv_response = self.client.post(
            "/chat/conversations",
            json={"mode_id": "default_mode_id"},
            headers=self.headers
        )
        conv_id = conv_response.json()["id"]

        # 发送消息
        self.client.post(
            f"/chat/conversations/{conv_id}/messages",
            json={"content": "什么是 SQL 注入？"},
            headers=self.headers
        )
```

**C. 运行压测**
```powershell
# 启动 locust
locust -f scripts/load_test.py --host=http://localhost

# 访问 http://localhost:8089
# 设置：50 用户，每秒增加 5 个用户
```

**D. 监控指标**
```powershell
# 监控所有服务
docker stats

# 监控 Redis
docker exec -it cypherguard-redis redis-cli INFO stats
```

**预期结果**：
- ✅ 50 并发用户，响应时间 < 5 秒
- ✅ 错误率 < 1%
- ✅ CPU 使用率 < 80%

---

## <a id="step4"></a>步骤 4：安全审计

### 4.1 API Key 加密检查

**目标**：确认 API Key 使用加密存储。

#### 操作步骤：

**A. 检查数据库**
```sql
-- 查看 model_configs 表
SELECT id, name, provider, api_key_encrypted FROM model_configs;

-- 验证点：api_key_encrypted 应该是加密后的字符串，不是明文
```

**B. 检查加密实现**
```powershell
# 查看加密代码
```

**需要检查的文件**：
- `shared/python/common/auth.py` - `encrypt_api_key` 和 `decrypt_api_key` 函数

**C. 验证加密强度**
- 当前使用 Base64 编码（⚠️ 不安全）
- **建议升级**：使用 Fernet 或 AES-256-GCM

**修复建议**：
```python
# 使用 cryptography 库
from cryptography.fernet import Fernet

def encrypt_api_key(plain_key: str, secret: str) -> str:
    f = Fernet(secret.encode())
    return f.encrypt(plain_key.encode()).decode()

def decrypt_api_key(encrypted_key: str, secret: str) -> str:
    f = Fernet(secret.encode())
    return f.decrypt(encrypted_key.encode()).decode()
```

---

### 4.2 CORS 配置检查

**目标**：限制跨域访问。

#### 操作步骤：

**A. 检查当前配置**
```powershell
# 查看所有服务的 CORS 配置
grep -r "allow_origins" services/*/app/main.py
```

**B. 当前状态**
```python
# ⚠️ 当前配置（开发环境）
allow_origins=["*"]
```

**C. 生产环境建议**
```python
# ✅ 生产环境配置
allow_origins=[
    "https://cypherguard.yourdomain.com",
    "https://app.yourdomain.com"
]
```

---

### 4.3 JWT Secret 检查

**目标**：确认生产环境使用强密钥。

#### 操作步骤：

**A. 检查 .env 文件**
```powershell
cat .env | grep JWT_SECRET
```

**B. 验证点**
- ❌ 如果是 `your-secret-key-change-in-production`，必须修改
- ✅ 应该是 32+ 字符的随机字符串

**C. 生成强密钥**
```powershell
# 生成随机密钥
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

### 4.4 SQL 注入检查

**目标**：确认所有数据库查询使用参数化。

#### 操作步骤：

**A. 代码审查**
```powershell
# 搜索可能的 SQL 注入点
grep -r "f\"SELECT" services/
grep -r "f'SELECT" services/
grep -r ".format(" services/ | grep -i "select\|insert\|update\|delete"
```

**B. 验证点**
- ✅ 所有查询使用 SQLAlchemy ORM 或参数化查询
- ❌ 如果发现字符串拼接 SQL，需要修复

---

### 4.5 XSS 防护检查

**目标**：确认前端正确转义用户输入。

#### 操作步骤：

**A. 测试 XSS**
1. 在对话中发送：`<script>alert('XSS')</script>`
2. **验证点**：应该显示为纯文本，不执行脚本

**B. 检查前端代码**
```powershell
# 查看是否使用 dangerouslySetInnerHTML
grep -r "dangerouslySetInnerHTML" frontend/src/
```

**C. 验证点**
- ✅ 使用 React 默认转义或 `ReactMarkdown`
- ❌ 如果使用 `dangerouslySetInnerHTML`，需要添加 DOMPurify

---

## <a id="step5"></a>步骤 5：部署准备

### 5.1 环境变量检查

**目标**：确认所有敏感配置已修改。

#### 操作步骤：

**A. 创建生产环境配置清单**
```powershell
# 复制 .env.example 为 .env.production
cp .env.example .env.production
```

**B. 必须修改的配置**
```bash
# .env.production

# ⚠️ 必须修改
JWT_SECRET=<生成的强密钥>
POSTGRES_PASSWORD=<强密码>
MINIO_ROOT_PASSWORD=<强密码>
API_KEY_ENCRYPTION_SECRET=<Fernet密钥>

# ⚠️ 生产环境域名
FRONTEND_URL=https://app.yourdomain.com
BACKEND_URL=https://api.yourdomain.com

# ⚠️ 生产数据库
POSTGRES_HOST=<生产数据库地址>
REDIS_URL=redis://<生产Redis地址>:6379
QDRANT_URL=http://<生产Qdrant地址>:6333
```

---

### 5.2 数据库备份策略

**目标**：设置自动备份。

#### 操作步骤：

**A. 创建备份脚本**
```bash
#!/bin/bash
# scripts/backup_db.sh

BACKUP_DIR="/backups/cypherguard"
DATE=$(date +%Y%m%d_%H%M%S)

# 备份 PostgreSQL
docker exec cypherguard-postgres pg_dump -U postgres cypherguard > "$BACKUP_DIR/postgres_$DATE.sql"

# 备份 Qdrant
docker exec cypherguard-qdrant tar -czf - /qdrant/storage > "$BACKUP_DIR/qdrant_$DATE.tar.gz"

# 备份 MinIO
docker exec cypherguard-minio mc mirror local/documents "$BACKUP_DIR/minio_$DATE/"

# 保留最近 7 天的备份
find "$BACKUP_DIR" -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

**B. 设置定时任务**
```bash
# 添加到 crontab
crontab -e

# 每天凌晨 2 点备份
0 2 * * * /path/to/scripts/backup_db.sh
```

---

### 5.3 监控和日志

**目标**：设置生产环境监控。

#### 操作步骤：

**A. 配置日志聚合**
```yaml
# docker-compose.production.yml
services:
  chat-service:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

**B. 健康检查端点**
```powershell
# 测试健康检查
curl http://localhost/healthz
```

**C. 监控指标**
- 服务可用性：每 5 分钟检查 `/healthz`
- 磁盘空间：PostgreSQL、MinIO、Qdrant
- 内存使用：所有容器
- 响应时间：API 平均响应时间

---

### 5.4 SSL/TLS 配置

**目标**：启用 HTTPS。

#### 操作步骤：

**A. 获取 SSL 证书**
```bash
# 使用 Let's Encrypt
certbot certonly --standalone -d api.yourdomain.com
```

**B. 配置 Nginx**
```nginx
# gateway/nginx.conf
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ... 其他配置
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

### 5.5 性能优化

**目标**：优化生产环境性能。

#### 操作步骤：

**A. 数据库索引优化**
```sql
-- 检查慢查询
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- 添加缺失的索引
CREATE INDEX CONCURRENTLY idx_messages_conversation_created
ON messages(conversation_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_chunks_document_enabled
ON chunks(document_id, is_enabled) WHERE is_enabled = true;
```

**B. Redis 缓存配置**
```bash
# 增加 Redis 内存限制
docker exec -it cypherguard-redis redis-cli CONFIG SET maxmemory 2gb
docker exec -it cypherguard-redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

**C. Qdrant 优化**
```python
# 优化向量检索参数
qdrant_client.search(
    collection_name=COLLECTION_NAME,
    query_vector=query_vector,
    limit=top_k,
    search_params={"hnsw_ef": 128, "exact": False}  # 平衡精度和速度
)
```

---

## 📊 验证报告模板

完成所有步骤后，填写以下报告：

```markdown
# CypherGuard AI 验证报告

**日期**：2026-03-11
**验证人**：[姓名]

## 功能验证

| 模块 | 状态 | 备注 |
|------|------|------|
| M1: 文档解析 | ✅/❌ | |
| M2: 混合检索 | ✅/❌ | |
| M3: 流式响应 | ✅/❌ | |
| ... | | |
| M18: 输入栏重构 | ✅/❌ | |

## 性能测试

- 文档处理速度：XX 个/分钟
- 并发用户数：XX 用户
- 平均响应时间：XX 秒
- 错误率：XX%

## 安全审计

- [ ] API Key 加密已升级
- [ ] CORS 配置已限制
- [ ] JWT Secret 已修改
- [ ] SQL 注入检查通过
- [ ] XSS 防护检查通过

## 部署准备

- [ ] 环境变量已配置
- [ ] 备份策略已设置
- [ ] 监控已配置
- [ ] SSL 证书已安装
- [ ] 性能优化已完成

## 遗留问题

1. [问题描述]
2. [问题描述]

## 建议

1. [建议内容]
2. [建议内容]
```

---

## 🎯 下一步行动

1. **立即执行**：步骤 1（图片持久化和Vision格式验证）
2. **本周完成**：步骤 2（端到端测试）
3. **下周完成**：步骤 3（性能压测）
4. **部署前**：步骤 4 和 5（安全审计和部署准备）

---

**祝验证顺利！如有问题，请查看日志或联系开发团队。**
