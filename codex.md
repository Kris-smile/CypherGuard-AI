# CODEX — 基于AI驱动的网络安全知识体系管理系统（微服务 + Docker）

> 你是本项目的编码代理（AI Coding Agent）。  
> 目标：在 **可私有化部署** 的前提下，实现一个可运行的“知识入库 → 向量化 → 检索+重排 → 带引用对话问答”的系统，并支持在线/离线模型接入（Ollama/Xinference/云API等 OpenAI-Compatible 形式）。  
> 要求：单人可落地、可演示、可测、可写论文。优先实现 MVP 闭环，其余功能可作为扩展。

---

## 0. 项目范围与原则

### 0.1 MVP 必须实现（不可缺）
1. 用户登录/注册：邮箱 + 用户名，RBAC 仅 `admin` 与 `user`。
2. 知识管理：上传文档 + 导入笔记链接（抓取HTML正文）。
3. 知识学习（索引流水线）：解析 → 切分chunk → embedding → 写入向量库；写入元数据到关系库；原始文件/HTML快照存对象存储。
4. AI 对话/问答：基于“向量召回 + rerank + 证据上下文”回答，并输出引用来源（doc/链接/页码/片段ID）。
5. 模型配置管理：chat/embedding/rerank（可扩展 vision/doc-parse）；在线/离线可切换。
6. 并发与排队：多人同时对话时，不崩溃；需要限流/并发闸门/排队/超时/降级策略。

### 0.2 明确不做（或放到展望）
- 不自研训练 embedding/rerank/LLM 模型，不做模型微调。
- 不做复杂知识图谱推理（可选“轻量结构化抽取”作为扩展）。
- 不做复杂多智能体编排（仅做“模式/预设Prompt模板”）。

### 0.3 质量红线（必须遵守）
- 回答必须“有证据可追溯”，严谨模式下无证据必须拒答。
- URL 导入必须做 SSRF 防护（禁止内网/本机/metadata地址等）。
- 敏感信息（API Key）不得明文记录到日志。

---

## 1. 技术栈与总体架构（默认选型）

> 可替换但需保持接口契约一致。默认以 Python 为主，微服务 Docker 化。

### 1.1 核心组件
- 后端微服务：**Python 3.11 + FastAPI + Uvicorn**
- 异步任务：**Celery + Redis**
- 关系数据库：**PostgreSQL**
- 向量数据库：**Qdrant**（单机部署简单、适合毕设）
- 对象存储：**MinIO (S3 compatible)**
- 网关：**Nginx**（反向代理、CORS、基础限流可选）
- 可观测性（MVP可简化）：结构化日志 + `/healthz` + 关键耗时记录（可选 Prometheus）

### 1.2 微服务边界（MVP 版本）
- `gateway`：Nginx 路由
- `auth-service`：注册/登录/JWT/RBAC
- `kb-service`：文档/链接管理、任务触发、元数据查询
- `chat-service`：检索编排、引用输出、对话记录
- `model-gateway`：统一对接在线/离线模型 + 并发/排队/限流
- `worker`：URL抓取、文档解析、chunk切分、embedding、写向量库

基础设施容器：
- `postgres`、`redis`、`minio`、`qdrant`

---

## 2. 目录结构（单仓库 Monorepo）

repo-root/
codex.md
docker-compose.yml
.env.example
gateway/
nginx.conf
services/
auth-service/
app/
Dockerfile
pyproject.toml (or requirements.txt)
kb-service/
app/
Dockerfile
chat-service/
app/
Dockerfile
model-gateway/
app/
Dockerfile
worker/
app/
Dockerfile
shared/
python/
common/ # 共享的 Pydantic 模型、工具函数、异常、日志、配置加载
infra/
db/
init.sql
minio/
policies/
docs/
api.md
architecture.md

> 共享代码放 `shared/python/common`，各服务通过本地路径依赖引用，保持一致的数据模型与错误码。

---

## 3. 数据模型设计（PostgreSQL）

> 先实现最小字段，后续可扩展。必须能支持“引用溯源”。

### 3.1 表结构（建议）
- `users`
  - `id (uuid pk)`
  - `email (unique)`
  - `username (unique)`
  - `password_hash`
  - `role` enum: `admin|user`
  - `created_at`

- `documents`
  - `id (uuid pk)`
  - `owner_user_id (uuid fk users.id)`
  - `title`
  - `source_type` enum: `upload|url`
  - `source_uri` (file path or url)
  - `mime_type`
  - `status` enum: `pending|processing|ready|failed|deleted`
  - `tags` (text[] optional)
  - `version` int default 1
  - `created_at`, `updated_at`

- `chunks`
  - `id (uuid pk)`  // chunk_id
  - `document_id (uuid fk documents.id)`
  - `chunk_index` int
  - `text` (可选：若向量库payload存全文，这里存摘要/或不存)
  - `text_hash` (用于去重缓存)
  - `page_start` int null
  - `page_end` int null
  - `section_title` text null
  - `source_offset_start` int null
  - `source_offset_end` int null
  - `created_at`

- `ingestion_tasks`
  - `id (uuid pk)`
  - `document_id (uuid fk)`
  - `task_type` enum: `fetch_url|parse|chunk|embed|index`
  - `celery_task_id` text
  - `status` enum: `pending|running|success|failed`
  - `progress` int (0-100)
  - `error_message` text null
  - `created_at`, `updated_at`

- `model_configs`
  - `id (uuid pk)`
  - `name` text
  - `model_type` enum: `chat|embedding|rerank|vision|doc_parse`
  - `provider` text (e.g. openai, azure, ollama, xinference, custom)
  - `base_url` text
  - `model_name` text
  - `api_key_encrypted` text null
  - `is_default` bool
  - `params_json` jsonb (temperature/max_tokens/timeout/…)
  - `max_concurrency` int default 4
  - `rate_limit_rpm` int null
  - `enabled` bool default true
  - `created_at`, `updated_at`

- `modes`
  - `id (uuid pk)`
  - `name` text (e.g. quick, strict, analyst)
  - `description` text
  - `system_prompt` text
  - `top_k` int default 20
  - `top_n` int default 6
  - `min_score` float default 0.0
  - `require_citations` bool default true
  - `no_evidence_behavior` enum: `refuse|answer_with_warning`
  - `created_at`, `updated_at`

- `conversations`
  - `id (uuid pk)`
  - `user_id (uuid fk)`
  - `mode_id (uuid fk)`
  - `title` text null
  - `created_at`

- `messages`
  - `id (uuid pk)`
  - `conversation_id (uuid fk)`
  - `role` enum: `user|assistant|system`
  - `content` text
  - `citations_json` jsonb null  // 引用列表
  - `created_at`

- `audit_logs`（MVP 可选）
  - `id`
  - `user_id`
  - `action` (login/upload/chat/…)
  - `meta_json`
  - `created_at`

---

## 4. 向量库设计（Qdrant）

### 4.1 Collection
- collection: `kb_chunks_v1`
- vector size: 由 embedding 模型决定（存配置中）
- payload 必须包含：
  - `chunk_id`
  - `document_id`
  - `title`
  - `source_type`
  - `source_uri`
  - `page_start`, `page_end`
  - `chunk_index`
  - `text`（建议存全文，方便引用；如果担心payload太大，可存摘要+在PG取全文）
  - `text_hash`
  - `created_at`

### 4.2 检索约定
- `top_k`：向量召回数量（模式可配置）
- `top_n`：rerank后最终供LLM使用数量（模式可配置）
- 支持过滤：`document_id`、`source_type`、`tags`（可后续扩展）

---

## 5. 模型网关（Model Gateway）设计：统一接入 + 调度控流

> 核心：解决多人并发对话的排队与资源调度问题。

### 5.1 对外（内部服务）接口
- `POST /internal/embeddings`
- `POST /internal/chat`
- `POST /internal/rerank`
- `POST /internal/health`

请求体包含：`model_config_id` 或 `model_type=default`，以及必要参数。

### 5.2 统一 OpenAI-Compatible 适配策略
- 优先用 OpenAI-style client（兼容 online/offline）。
- 不同 provider 通过 `base_url`、`api_key`、`model_name` 切换。

### 5.3 并发/排队/限流（必须实现）
对每个 `model_config_id` 建立：
- **并发闸门**：`max_concurrency`（Semaphore）
- **速率限制**：`rate_limit_rpm`（Token bucket，存 Redis）
- **队列**：当闸门满时，按服务策略：
  - 若 `queue_enabled=true`：进入 Redis list/stream，worker拉取执行（MVP可先不做队列，仅返回“繁忙”）
  - 若 `queue_enabled=false`：立即返回 429/503
- **超时**：`timeout`（防止请求无限占用）
- **降级策略（MVP至少实现1条）**：
  - rerank失败 → 退化为仅向量召回TopN
  - chat模型不可用 → 返回可解释错误（并建议切换模型配置）

### 5.4 日志与脱敏
- 记录：耗时、模型、token估计、错误码
- 不记录：api_key、原文长文本（可截断+hash）

---

## 6. 知识入库流水线（Worker）

### 6.1 上传文件（upload）
1. `kb-service` 接收文件 → 存 MinIO → 写 documents(status=pending)
2. 触发 Celery：parse → chunk → embed → index
3. 成功：documents(status=ready)，失败：status=failed + error_message

### 6.2 URL 导入（url）
1. `kb-service` 创建 documents(source_type=url, status=pending)
2. Celery `fetch_url`：
   - SSRF 防护：仅允许 http/https；拒绝内网IP、localhost、metadata地址；限制大小/超时/重定向次数
   - 下载HTML → 存MinIO快照
3. parse正文 → chunk → embedding → index（同上）

### 6.3 Chunk 策略（默认）
- 以段落/标题为优先边界
- 最大长度：`800~1200 tokens`（用字符长度近似即可，MVP不必精确tokenizer）
- 重叠：`50~150 tokens`（提高召回一致性）
- 保存 page_start/page_end（PDF能取则取）

---

## 7. 对话问答链路（Chat Service）

### 7.1 标准流程（你必须按此实现）
用户问题
  → 调用 embedding
  → Qdrant 向量召回 TopK
  → 调用 rerank 得分排序
  → 取 TopN 构造 context（带 chunk_id/doc_id）
  → 调用 chat LLM 生成答案
  → 输出：answer + citations[]

### 7.2 引用输出格式（统一协议）
返回 JSON：
```json
{
  "answer": "…",
  "citations": [
    {
      "document_id": "uuid",
      "title": "xxx.pdf",
      "source_type": "upload",
      "source_uri": "s3://… or https://…",
      "chunk_id": "uuid",
      "page_start": 3,
      "page_end": 4,
      "snippet": "命中的原文片段（截断）",
      "score": 0.87
    }
  ],
  "mode": "strict",
  "trace": {
    "top_k": 20,
    "top_n": 6,
    "latency_ms": {
      "embed": 50,
      "search": 30,
      "rerank": 80,
      "llm": 900
    }
  }
}
7.3 严谨模式：无证据拒答
若 TopN 全部低于阈值 or context为空：
answer 输出“无法从知识库找到依据…”
citations 为空
HTTP 200（业务拒答，不是系统错误）
8. API 设计（MVP）
仅列核心端点，具体 schema 在 docs/api.md 固化。
8.1 auth-service
POST /auth/register
POST /auth/login
GET /auth/me
8.2 kb-service
POST /kb/documents/upload
POST /kb/documents/import-url
GET /kb/documents
GET /kb/documents/{id}
DELETE /kb/documents/{id}
POST /kb/documents/{id}/reindex
GET /kb/tasks?document_id=...
8.3 chat-service
POST /chat/conversations
GET /chat/conversations
POST /chat/conversations/{id}/messages
GET /chat/conversations/{id}/messages
8.4 model-config（可放 model-gateway 或独立服务；MVP可放 auth-service 里作为 admin API）
GET /models
POST /models
PUT /models/{id}
POST /models/{id}/test
POST /models/set-default
8.5 modes
GET /modes
POST /modes（admin）
PUT /modes/{id}（admin）
9. Docker Compose（必须提供一键启动）
9.1 必备服务
gateway
postgres
redis
minio
qdrant
auth-service
kb-service
chat-service
model-gateway
worker
9.2 环境变量（写入 .env.example）
POSTGRES_URL
REDIS_URL
MINIO_ENDPOINT / ACCESS_KEY / SECRET_KEY / BUCKET
QDRANT_URL
JWT_SECRET
MODEL_*（默认模型配置可通过 DB 初始化脚本导入）
SSRF_ALLOWLIST / SSRF_BLOCKLIST（可选）
UPLOAD_MAX_MB / URL_FETCH_MAX_MB / TIMEOUTS
10. 实施顺序（AI 必须按顺序落地，不要一次写一堆不可运行代码）
Phase 1：基础设施可启动
编写 docker-compose.yml 启动 postgres/redis/minio/qdrant/gateway
给每个服务准备 Dockerfile（空app也行）确保 compose up 不报错
初始化数据库（infra/db/init.sql）
Phase 2：Auth + 最小 KB
实现 auth-service（注册/登录/JWT）
实现 kb-service（上传→MinIO→documents入库）
worker：实现 parse/chunk/embed 的最小骨架（先只打印日志）
Phase 3：Embedding + 向量库闭环
model-gateway：实现 /internal/embeddings（先走一个 provider）
worker：拿到文本chunk→embedding→写 Qdrant
kb-service：任务状态可查
Phase 4：检索 + rerank + chat（带引用）
chat-service：实现向量召回 + rerank（可先stub） + LLM回答
引用结构必须完整可追溯
增加 modes（quick/strict 两个预设）
Phase 5：并发/排队/调度（多人对话稳定性）
model-gateway：并发闸门 + rate limit（Redis计数） + 超时
增加降级：rerank失败→仅召回
加上关键耗时日志与trace字段
Phase 6：完善与文档
docs/architecture.md 写清楚架构与数据流
docs/api.md 固化接口
基础测试：至少对 auth、kb、chat 各 2-3 个用例
11. 验收标准（Definition of Done）
MVP 通过的判定条件：
docker compose up 后，所有服务健康检查通过
可注册/登录（admin 与 user）
上传PDF/MD后，系统能完成索引并在对话中引用该文档片段回答
导入一个公开网页URL后，系统能抓取正文入库并引用回答
可切换模型配置（online/offline，至少能切 base_url）
并发压测（简化）：同时 5~10 个对话请求不崩溃；超限能返回“繁忙”或排队结果，不出现死锁
日志不泄露 api_key
12. 编码规范（必须统一）
Python：black + isort + ruff（或flake8）
统一错误码与异常模型（shared/common）
所有服务提供：
GET /healthz
结构化日志（json）
request-id（从 gateway 透传或服务生成）
13. 安全要求（必须做）
密码 hash：bcrypt/argon2
JWT：签名密钥来自 env
URL 导入 SSRF 防护（强制）
上传限制：大小/类型白名单
API key：数据库加密存储（MVP可用对称加密 + env key）
14. 可选扩展（加分项）
引用高亮展示（前端必须做）
轻量结构化抽取：CVE/IP/域名/hash（规则即可）
审计日志：谁问了什么，引用了哪些doc/chunk（脱敏）
多队列：admin优先队列
15. 交付物清单
代码仓库（包含所有 Dockerfile 与 compose）
数据库初始化脚本
API 文档与架构文档
演示脚本（如何上传→索引→对话→引用）
开始编码前：请先创建 Phase 1 的最小骨架，确保 docker compose up 成功，再进入下一阶段。