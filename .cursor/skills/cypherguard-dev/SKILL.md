---
name: cypherguard-dev
description: CypherGuard AI 功能开发蓝图与实施指南。借鉴 WeKnora 架构，涵盖12个功能模块的设计、实现步骤和验收标准。当需要实现新功能、完善系统模块或查询开发计划时使用此技能。
---

# CypherGuard AI 功能开发蓝图

> 基于 WeKnora 架构设计，去除 MCP Server 和微信对话开放平台，适配 CypherGuard AI 的网络安全知识体系管理系统。

## 技术栈约束

- 后端: Python 3.11 + FastAPI + Celery
- 前端: React 19 + TypeScript + Vite + Tailwind
- 存储: PostgreSQL + Qdrant + Redis + MinIO
- 网关: Nginx
- 部署: Docker Compose

## 功能模块总览（12个模块，按优先级排序）

| 优先级 | 模块 | 状态 | 说明 |
|--------|------|------|------|
| P0 | M1 文档解析增强 | ✅ 已完成 | DOCX/XLSX/CSV/PPTX + pdfplumber |
| P0 | M2 混合检索引擎 | ✅ 已完成 | BM25 + Vector + RRF 融合 |
| P0 | M3 流式响应 SSE | ✅ 已完成 | 实时流式对话输出 |
| P0 | M4 多轮上下文管理 | ✅ 已完成 | 滑动窗口 + 查询改写 |
| P1 | M5 FAQ 知识库 | ✅ 已完成 | Q&A CRUD + CSV导入 + 向量化 |
| P1 | M6 Web 搜索集成 | ✅ 已完成 | DuckDuckGo 实时搜索 |
| P1 | M7 文档摘要与标签 | ✅ 已完成 | 自动摘要 + 标签CRUD |
| P1 | M8 Chunk 管理 | ✅ 已完成 | 查看/编辑/禁用 + 重索引 |
| P2 | M9 Agent 模式 | ✅ 已完成 | ReACT + 3个内置工具 |
| P2 | M10 前端功能完善 | ✅ 已完成 | 流式UI + Agent + API层 |
| P2 | M11 安全增强 | ✅ 已完成 | Refresh Token + 安全头 |
| P2 | M12 网安实体抽取 | ✅ 已完成 | CVE/IP/域名/Hash 正则 |

## 实施顺序

```
M1(文档解析) → M2(混合检索) → M3(流式响应) → M4(多轮上下文)
    → M5(FAQ) → M6(Web搜索) → M7(摘要标签) → M8(Chunk管理)
    → M9(Agent) → M10(前端) → M11(安全) → M12(网安抽取)
```

---

## M1: 文档解析增强

**目标**: 支持 DOCX、XLSX、CSV 等多格式文档，对标 WeKnora DocReader。

**涉及文件**:
- `services/worker/app/celery_app.py` — 添加解析器
- `services/worker/requirements.txt` — 新增依赖
- `services/kb-service/app/main.py` — MIME 类型白名单
- `frontend/src/pages/KnowledgeBase.tsx` — accept 属性

**新增依赖** (`worker/requirements.txt`):
```
python-docx>=1.1.0
openpyxl>=3.1.0
python-pptx>=0.6.23
pdfplumber>=0.11.0
```

**实现步骤**:
1. `extract_text` 函数添加分支:
   - `.docx`: `python-docx` 逐段提取，保留标题层级
   - `.xlsx/.csv`: `openpyxl` 逐行读取，sheet→section
   - `.pptx`: `python-pptx` 逐slide提取
   - `.pdf`: 替换 `pypdf` 为 `pdfplumber`，提取表格+文字
2. `kb-service` MIME 白名单扩展
3. 前端 accept 属性更新
4. `init.sql` 无需改动（`mime_type` 已是 text 类型）

**验收**: 上传 .docx/.xlsx/.csv/.pptx 后能正常解析、分块、检索。

---

## M2: 混合检索引擎

**目标**: BM25 关键词 + Vector 语义的混合检索，对标 WeKnora 的 Hybrid Retrieval。

**涉及文件**:
- `infra/db/init.sql` — chunks 表添加 tsvector 列 + GIN 索引
- `services/worker/app/celery_app.py` — 写入时生成 tsvector
- `services/chat-service/app/main.py` — 混合检索逻辑
- `shared/python/common/schemas.py` — 检索配置 schema
- `infra/db/init.sql` — modes 表添加检索策略字段

**数据库变更**:
```sql
ALTER TABLE chunks ADD COLUMN tsv tsvector;
CREATE INDEX idx_chunks_tsv ON chunks USING GIN(tsv);
ALTER TABLE modes ADD COLUMN retrieval_strategy VARCHAR(20) DEFAULT 'hybrid';
-- retrieval_strategy: 'vector' | 'bm25' | 'hybrid'
ALTER TABLE modes ADD COLUMN bm25_weight FLOAT DEFAULT 0.3;
```

**实现步骤**:
1. Worker: 写入 chunk 时同步更新 `tsv` 列 (`to_tsvector('english', text)`)
2. Chat Service: 新增 `bm25_search(query, top_k)` 函数，用 `ts_rank` 排序
3. 混合策略: RRF (Reciprocal Rank Fusion) 合并 BM25 和 Vector 结果
4. Mode 配置: `retrieval_strategy` 和 `bm25_weight` 可调

**RRF 算法**:
```python
def rrf_merge(vector_results, bm25_results, k=60):
    scores = {}
    for rank, item in enumerate(vector_results):
        scores[item.id] = scores.get(item.id, 0) + 1 / (k + rank + 1)
    for rank, item in enumerate(bm25_results):
        scores[item.id] = scores.get(item.id, 0) + 1 / (k + rank + 1)
    return sorted(scores.items(), key=lambda x: x[1], reverse=True)
```

**验收**: 对比纯向量检索，混合模式对关键词查询召回率提升。

---

## M3: 流式响应 (SSE)

**目标**: 实时流式输出 LLM 回答，对标 WeKnora 的流式返回 + 引用标注。

**涉及文件**:
- `services/model-gateway/app/main.py` — 添加 streaming endpoint
- `services/chat-service/app/main.py` — SSE 封装
- `gateway/nginx.conf` — SSE 代理配置
- `frontend/src/pages/Chat.tsx` — EventSource/fetch streaming UI
- `frontend/src/services/api.ts` — streaming helper

**实现步骤**:
1. Model Gateway: `/internal/chat/stream` 返回 `StreamingResponse`
   ```python
   async def stream_chat(messages, model_config):
       async with httpx.AsyncClient() as client:
           async with client.stream("POST", url, json=payload) as resp:
               async for line in resp.aiter_lines():
                   if line.startswith("data: "):
                       yield line + "\n\n"
   ```
2. Chat Service: `POST /chat/conversations/{id}/messages?stream=true`
   - 先完成检索+rerank（非流式）
   - 构建 prompt 后，流式调用 LLM
   - SSE 格式: `data: {"type":"token","content":"..."}\n\n`
   - 最后: `data: {"type":"done","citations":[...]}\n\n`
3. Nginx: 添加 SSE 配置
   ```nginx
   proxy_buffering off;
   proxy_cache off;
   proxy_set_header Connection '';
   proxy_http_version 1.1;
   chunked_transfer_encoding off;
   ```
4. 前端: `fetch` + `ReadableStream` 实时渲染

**SSE 事件协议**:
```
data: {"type":"search","message":"正在检索知识库..."}
data: {"type":"rerank","message":"正在重排序..."}
data: {"type":"token","content":"根据"}
data: {"type":"token","content":"文档"}
data: {"type":"done","citations":[...], "trace":{...}}
```

**验收**: 对话时能逐字输出，体验流畅。

---

## M4: 多轮上下文管理

**目标**: 滑动窗口上下文 + LLM 查询改写，对标 WeKnora 的会话管理。

**涉及文件**:
- `services/chat-service/app/main.py` — 上下文加载+改写
- `infra/db/init.sql` — conversations 添加 context_config
- `shared/python/common/schemas.py` — context config schema

**数据库变更**:
```sql
ALTER TABLE conversations ADD COLUMN context_config JSONB DEFAULT '{"strategy":"sliding_window","window_size":10}';
```

**实现步骤**:
1. 消息发送前，加载最近 N 条历史消息（sliding_window）
2. 若多轮对话，用 LLM 将 "历史+当前问题" 改写为独立查询
3. 改写后的查询用于检索，原始问题保存到 messages

**查询改写 Prompt**:
```
Given the conversation history and the latest question, 
rewrite the question as a standalone query for knowledge retrieval.
Only output the rewritten query, nothing else.
```

**验收**: 多轮对话中指代消解正确（如"它的作者是谁"能关联上文）。

---

## M5: FAQ 知识库

**目标**: 支持 Q&A 对管理，对标 WeKnora 的 FAQ 型知识库。

**涉及文件**:
- `infra/db/init.sql` — 新增 `faq_entries` 表
- `services/kb-service/app/main.py` — FAQ CRUD + 批量导入
- `services/worker/app/celery_app.py` — FAQ 向量化
- `frontend/src/pages/KnowledgeBase.tsx` — FAQ 管理 UI

**数据库**:
```sql
CREATE TABLE faq_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID REFERENCES users(id),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    similar_questions TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

**API 端点**:
- `POST /kb/faq` — 创建单条 FAQ
- `POST /kb/faq/import` — 批量导入 (Excel/CSV)
- `GET /kb/faq` — FAQ 列表
- `PUT /kb/faq/{id}` — 编辑
- `DELETE /kb/faq/{id}` — 删除

**实现步骤**:
1. FAQ 创建/编辑时，将 question + similar_questions 向量化存入 Qdrant
2. 检索时，FAQ 结果与文档 chunk 一起参与 rerank
3. 前端: FAQ 管理页签，支持单条编辑和 CSV 批量导入

**验收**: 添加 FAQ 后，对话能引用 FAQ 回答。

---

## M6: Web 搜索集成

**目标**: 集成 DuckDuckGo 实时搜索，对标 WeKnora 的 Web Search。

**新增依赖**: `duckduckgo-search>=7.0.0` (chat-service)

**涉及文件**:
- `services/chat-service/app/main.py` — web search 工具
- `services/chat-service/requirements.txt` — 依赖
- `infra/db/init.sql` — modes 添加 enable_web_search

**实现步骤**:
1. `web_search(query, max_results=5)` 函数封装 DuckDuckGo
2. 当 mode.enable_web_search=true 且知识库召回不足时触发
3. 搜索结果格式化为 chunk-like 结构，参与 prompt 构建
4. 引用标注 `source_type: "web_search"`

**验收**: 开启 Web 搜索后，知识库无答案时能从网络获取信息。

---

## M7: 文档摘要与标签增强

**目标**: 自动摘要 + 标签管理 API。

**涉及文件**:
- `services/worker/app/celery_app.py` — 摘要生成任务
- `infra/db/init.sql` — documents 添加 summary 列
- `services/kb-service/app/main.py` — 标签 CRUD
- `infra/db/init.sql` — 新增 tags 表

**数据库**:
```sql
ALTER TABLE documents ADD COLUMN summary TEXT;
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(7) DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**实现步骤**:
1. Worker: 文档解析完成后，取前 N 个 chunk 调用 LLM 生成摘要
2. 摘要存入 `documents.summary`
3. Tags: 独立表管理，文档的 `tags` 字段改为引用 tag_id 数组
4. API: `GET/POST/DELETE /kb/tags`

**验收**: 上传文档后自动生成摘要，标签可独立管理。

---

## M8: Chunk 管理

**目标**: Chunk 查看、编辑、层级关系，对标 WeKnora 的 Chunk 服务。

**涉及文件**:
- `services/kb-service/app/main.py` — Chunk CRUD API
- `infra/db/init.sql` — chunks 添加 parent_chunk_id, chunk_type
- `frontend/src/pages/KnowledgeBase.tsx` — Chunk 查看器

**数据库变更**:
```sql
ALTER TABLE chunks ADD COLUMN chunk_type VARCHAR(20) DEFAULT 'text';
ALTER TABLE chunks ADD COLUMN parent_chunk_id UUID REFERENCES chunks(id);
ALTER TABLE chunks ADD COLUMN is_enabled BOOLEAN DEFAULT true;
```

**API 端点**:
- `GET /kb/documents/{id}/chunks` — 获取文档的所有 chunks
- `PUT /kb/chunks/{id}` — 编辑 chunk 内容
- `PATCH /kb/chunks/{id}/toggle` — 启用/禁用 chunk

**实现步骤**:
1. KB Service: Chunk 列表、编辑、禁用端点
2. 编辑 chunk 后自动重新向量化
3. 禁用的 chunk 不参与检索
4. 前端: 文档详情页展示 chunk 列表，支持点击编辑

**验收**: 能查看/编辑/禁用 chunk，编辑后检索结果更新。

---

## M9: Agent 模式 (ReACT)

**目标**: 轻量 ReACT Agent，对标 WeKnora Agent 引擎（简化版）。

**涉及文件**:
- `services/chat-service/app/main.py` — Agent 引擎
- `infra/db/init.sql` — messages 添加 agent_steps
- `shared/python/common/schemas.py` — Agent schemas

**数据库变更**:
```sql
ALTER TABLE messages ADD COLUMN agent_steps JSONB;
```

**内置工具**:
1. `knowledge_search(query)` — 知识库检索
2. `web_search(query)` — Web 搜索 (M6)
3. `get_document_info(doc_id)` — 文档信息

**ReACT 循环** (最多 5 轮):
```
Thought → Action(tool, args) → Observation → ... → Final Answer
```

**实现步骤**:
1. Agent Prompt 模板: system prompt 含工具描述
2. 循环解析 LLM 输出，提取 Action/Observation
3. 执行对应工具，将结果注入上下文
4. 达到 Final Answer 或最大轮次后返回
5. `agent_steps` 记录每步的 thought/action/observation

**验收**: Agent 模式下能自动选择工具回答复合问题。

---

## M10: 前端功能完善

**目标**: 完善前端交互，对标 WeKnora 前端核心页面。

**涉及文件**: `frontend/src/pages/*.tsx`, `frontend/src/services/api.ts`

**功能清单**:
1. **流式对话 UI**: token 逐字渲染 + 打字机效果 + 阶段提示
2. **FAQ 管理页**: 新增/编辑/删除/批量导入
3. **Chunk 查看器**: 文档详情中展示分块，支持编辑/禁用
4. **任务进度**: 文档处理状态实时刷新 (轮询)
5. **URL 导入 UI**: 输入 URL 导入知识
6. **文档摘要展示**: 文档卡片展示自动摘要
7. **Web 搜索开关**: 对话设置中切换 Web 搜索
8. **标签管理**: 标签选择器、按标签筛选
9. **Agent 步骤展示**: 展开查看 Agent 的推理过程
10. **模型管理页**: 从 Settings 移至独立 Dashboard 页签

**验收**: 所有新功能在前端可视化操作，体验流畅。

---

## M11: 安全增强

**目标**: JWT Refresh Token + 安全头。

**涉及文件**:
- `services/auth-service/app/main.py` — refresh token
- `shared/python/common/auth.py` — token 工具
- `gateway/nginx.conf` — 安全头

**实现步骤**:
1. 登录返回 `access_token` (15min) + `refresh_token` (7d)
2. `POST /auth/refresh` 用 refresh_token 换新 access_token
3. Nginx 添加安全头: `X-Content-Type-Options`, `X-Frame-Options`, `CSP`
4. 前端: 401 时自动尝试 refresh

**验收**: Token 过期后能自动续期，安全头生效。

---

## M12: 网络安全实体抽取

**目标**: 从文档中提取 CVE/IP/域名/Hash 等网安实体。

**涉及文件**:
- `services/worker/app/celery_app.py` — 正则抽取
- `infra/db/init.sql` — 新增 `entities` 表
- `services/kb-service/app/main.py` — 实体查询 API

**正则规则**:
```python
PATTERNS = {
    "cve": r"CVE-\d{4}-\d{4,}",
    "ipv4": r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
    "domain": r"\b[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}\b",
    "md5": r"\b[a-fA-F0-9]{32}\b",
    "sha256": r"\b[a-fA-F0-9]{64}\b",
    "email": r"\b[\w.-]+@[\w.-]+\.\w+\b",
}
```

**数据库**:
```sql
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES chunks(id),
    entity_type VARCHAR(20) NOT NULL,
    value TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_entities_type_value ON entities(entity_type, value);
```

**验收**: 上传含 CVE/IP 的文档后，能自动提取并在 UI 展示。

---

## 通用开发规范

### 每个模块的开发流程
1. 数据库变更 → `init.sql` 更新
2. 后端 API 实现 → 对应 service
3. 前端 UI 对接 → 对应 page/component
4. Docker 重建 → 验证

### 共享代码
- Pydantic schemas → `shared/python/common/schemas.py`
- 配置项 → `shared/python/common/config.py`
- 认证工具 → `shared/python/common/auth.py`

### 错误处理
- 所有错误信息使用中文
- HTTP 状态码遵循 RESTful 规范
- 业务错误返回 `{"detail": "中文描述"}`

### Nginx 路由
新增端点时同步更新 `gateway/nginx.conf` 的 location 配置。

## 详细参考

- 项目设计文档: [codex.md](../../../codex.md)
- WeKnora 架构分析: [WeKnora项目架构分析.md](../../../WeKnora项目架构分析.md)
