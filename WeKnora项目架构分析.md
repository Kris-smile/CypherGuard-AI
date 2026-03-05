# WeKnora 项目架构分析文档

## 📋 项目概述

**WeKnora** 是腾讯开源的基于大语言模型(LLM)的文档理解与检索框架，专注于处理复杂、异构文档的深度理解和语义检索。

- **项目名称**: WeKnora
- **版本**: v0.2.10
- **开源协议**: MIT License
- **官方网站**: https://weknora.weixin.qq.com
- **GitHub**: https://github.com/Tencent/WeKnora

---

## 🏗️ 系统架构图

### 1. 总体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                          用户层 (User Layer)                          │
├─────────────────────────────────────────────────────────────────────┤
│  Web UI (Vue3)  │  RESTful API  │  MCP Server  │  微信对话开放平台   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        应用层 (Application Layer)                     │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Agent引擎   │  │  会话管理    │  │  知识库管理  │              │
│  │  (ReACT)     │  │  (Session)   │  │  (KB Mgmt)   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  检索引擎    │  │  文档解析    │  │  模型管理    │              │
│  │  (Retrieval) │  │  (DocReader) │  │  (Model)     │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        服务层 (Service Layer)                         │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  知识服务    │  │  Chunk服务   │  │  FAQ服务     │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Embedding   │  │  Rerank      │  │  Summary     │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Web Search  │  │  MCP Client  │  │  Graph RAG   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      中间件层 (Middleware Layer)                      │
├─────────────────────────────────────────────────────────────────────┤
│  认证授权  │  日志追踪  │  错误处理  │  限流熔断  │  事件总线      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       数据层 (Data Layer)                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  PostgreSQL  │  │  Redis       │  │  MinIO/COS   │              │
│  │  (pgvector)  │  │  (Cache/MQ)  │  │  (Storage)   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Qdrant      │  │  Neo4j       │  │  DuckDB      │              │
│  │  (Vector DB) │  │  (Graph DB)  │  │  (Analytics) │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      外部服务 (External Services)                     │
├─────────────────────────────────────────────────────────────────────┤
│  LLM API  │  Embedding API  │  OCR服务  │  搜索引擎  │  监控追踪    │
│  (Ollama, │  (BGE, GTE)     │ (Paddle)  │(DuckDuckGo)│  (Jaeger)    │
│   OpenAI) │                 │           │            │              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 核心功能模块

### 1. Agent 引擎模块

**位置**: `internal/agent/`

**功能**:
- 实现 ReACT (Reasoning + Acting) Agent 模式
- 支持多轮对话和工具调用
- 内置工具：知识库检索、数据分析、文档信息获取、Chunk搜索
- 支持 MCP (Model Context Protocol) 工具扩展
- 支持 Web 搜索集成

**核心组件**:
```
agent/
├── engine.go           # Agent 执行引擎
├── prompts.go          # Prompt 模板管理
└── tools/              # 内置工具集
    ├── knowledge_search.go      # 知识库检索工具
    ├── data_analysis.go         # 数据分析工具
    ├── database_query.go        # 数据库查询工具
    ├── get_document_info.go     # 文档信息工具
    └── grep_chunks.go           # Chunk 搜索工具
```

### 2. 文档解析模块 (DocReader)

**位置**: `docreader/`

**技术栈**: Python 3.10+

**功能**:
- 多格式文档解析：PDF、Word、Excel、Markdown、HTML、图片
- OCR 文本提取 (PaddleOCR)
- 图片描述生成 (VLM)
- 文档结构化提取
- gRPC 服务接口

**核心依赖**:
```python
- paddleocr>=2.10.0        # OCR引擎
- pdfplumber>=0.11.7       # PDF解析
- python-docx>=1.2.0       # Word解析
- markitdown>=0.1.3        # 多格式转换
- beautifulsoup4>=4.14.2   # HTML解析
- grpcio>=1.76.0           # gRPC服务
```

### 3. 知识库管理模块

**位置**: `internal/application/service/`

**功能**:
- 知识库 CRUD 操作
- 支持文档型和 FAQ 型知识库
- 文档上传、解析、分块
- 向量化和索引
- 标签管理
- 在线编辑

**知识库类型**:

- **Document**: 文档型知识库，支持文件上传、URL导入、文件夹导入
- **FAQ**: 问答型知识库，支持问题-答案对管理

### 4. 检索引擎模块

**位置**: `internal/application/service/retriever/`

**检索策略**:
- **BM25**: 稀疏检索，基于关键词匹配
- **Dense Retrieval**: 密集检索，基于向量相似度
- **Hybrid Retrieval**: 混合检索，结合 BM25 和向量检索
- **GraphRAG**: 知识图谱增强检索

**检索流程**:
```
用户查询
    ↓
查询改写 (可选)
    ↓
查询扩展 (可选)
    ↓
多路召回 (BM25 + Vector + Graph)
    ↓
结果合并
    ↓
Rerank 重排序
    ↓
阈值过滤
    ↓
返回 Top-K 结果
```

### 5. 向量数据库集成

**支持的向量数据库**:
- **PostgreSQL + pgvector**: 默认方案，关系型+向量
- **Qdrant**: 专业向量数据库
- **Elasticsearch**: 全文检索+向量

**向量维度**: 可配置 (常见: 768, 1024, 1536)

### 6. 知识图谱模块

**位置**: `internal/application/service/graph/`

**功能**:
- 实体提取
- 关系抽取
- 知识图谱构建
- 图谱查询和推理

**存储**: Neo4j

**实体类型**:
```
Person, Organization, Location, Product, Event, 
Date, Work, Concept, Resource, Category, Operation
```

### 7. 会话管理模块

**位置**: `internal/handler/session/`

**功能**:
- 多轮对话管理
- 上下文压缩策略
- 会话历史存储
- 对话策略配置

**上下文压缩策略**:

- **sliding_window**: 滑动窗口，保留最近 N 条消息
- **smart**: 智能压缩，使用 LLM 总结历史消息

### 8. 模型管理模块

**位置**: `internal/models/`

**支持的模型类型**:
- **Chat Model**: 对话生成模型
- **Embedding Model**: 文本向量化模型
- **Rerank Model**: 结果重排序模型
- **VLM Model**: 视觉语言模型

**模型来源**:
- **Local**: 本地部署 (Ollama)
- **API**: 云端 API (OpenAI, Qwen, DeepSeek 等)
- **Built-in**: 内置共享模型

### 9. MCP 集成模块

**位置**: `internal/mcp/`

**功能**:
- MCP 客户端实现
- 支持 uvx、npx 启动器
- 支持 Stdio、HTTP、SSE 传输协议
- 工具动态加载

**配置示例**:
```json
{
  "mcpServers": {
    "weknora": {
      "command": "python",
      "args": ["path/to/run_server.py"],
      "env": {
        "WEKNORA_API_KEY": "sk-xxx",
        "WEKNORA_BASE_URL": "http://localhost:8080/api/v1"
      }
    }
  }
}
```

### 10. Web 搜索模块

**位置**: `internal/handler/web_search.go`

**支持的搜索引擎**:
- **DuckDuckGo**: 默认内置
- **Google**: 可扩展

**功能**:
- 实时网络搜索
- 结果去重和排序
- 内容提取和摘要

---

## 📊 数据库设计

### ER 图

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Tenants   │1      ∞ │ Knowledge Bases  │1      ∞ │  Knowledges │
│─────────────│◄────────│──────────────────│◄────────│─────────────│
│ id (PK)     │         │ id (PK)          │         │ id (PK)     │
│ name        │         │ name             │         │ title       │
│ api_key     │         │ type             │         │ source      │
│ status      │         │ tenant_id (FK)   │         │ kb_id (FK)  │
│ agent_config│         │ chunking_config  │         │ parse_status│
└─────────────┘         │ embedding_model  │         │ file_path   │
                        │ vlm_config       │         │ metadata    │
                        └──────────────────┘         └─────────────┘
                                                             │1
                                                             │
                                                             │∞
                        ┌──────────────────┐         ┌─────────────┐
                        │    Sessions      │1      ∞ │   Messages  │
                        │──────────────────│◄────────│─────────────│
                        │ id (PK)          │         │ id (PK)     │
                        │ tenant_id (FK)   │         │ session_id  │
                        │ kb_id (FK)       │         │ role        │
                        │ agent_config     │         │ content     │
                        │ context_config   │         │ references  │
                        └──────────────────┘         │ agent_steps │
                                                     └─────────────┘
                                                             
┌─────────────┐                                      ┌─────────────┐
│   Chunks    │                                      │   Models    │
│─────────────│                                      │─────────────│
│ id (PK)     │                                      │ id (PK)     │
│ knowledge_id│                                      │ tenant_id   │
│ content     │                                      │ name        │
│ chunk_type  │                                      │ type        │
│ chunk_index │                                      │ parameters  │
│ parent_id   │                                      │ is_default  │
│ flags       │                                      └─────────────┘
└─────────────┘
```

### 核心数据表

#### 1. tenants (租户表)

```sql
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,                    -- 租户ID (从10000开始)
    name VARCHAR(255) NOT NULL,               -- 租户名称
    description TEXT,                         -- 描述
    api_key VARCHAR(64) NOT NULL,             -- API密钥 (sk-开头)
    retriever_engines JSONB DEFAULT '[]',     -- 检索引擎配置
    status VARCHAR(50) DEFAULT 'active',      -- 状态
    business VARCHAR(255) NOT NULL,           -- 业务标识
    storage_quota BIGINT DEFAULT 10737418240, -- 存储配额(10GB)
    storage_used BIGINT DEFAULT 0,            -- 已使用存储
    agent_config JSONB,                       -- Agent配置
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);
```

#### 2. knowledge_bases (知识库表)

```sql
CREATE TABLE knowledge_bases (
    id VARCHAR(36) PRIMARY KEY,               -- 知识库ID (UUID)
    name VARCHAR(255) NOT NULL,               -- 知识库名称
    type VARCHAR(32) DEFAULT 'document',      -- 类型: document/faq
    is_temporary BOOLEAN DEFAULT false,       -- 是否临时知识库
    description TEXT,                         -- 描述
    tenant_id INTEGER NOT NULL,               -- 租户ID
    chunking_config JSONB,                    -- 分块配置
    image_processing_config JSONB,            -- 图片处理配置
    embedding_model_id VARCHAR(64),           -- Embedding模型ID
    summary_model_id VARCHAR(64),             -- 摘要模型ID
    vlm_config JSONB,                         -- 多模态配置
    cos_config JSONB,                         -- 存储配置
    extract_config JSONB,                     -- 图谱提取配置
    faq_config JSONB,                         -- FAQ配置
    question_generation_config JSONB,         -- 问题生成配置
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);
```

#### 3. knowledges (知识表)

```sql
CREATE TABLE knowledges (
    id VARCHAR(36) PRIMARY KEY,               -- 知识ID (UUID)
    tenant_id INTEGER NOT NULL,               -- 租户ID
    knowledge_base_id VARCHAR(36) NOT NULL,   -- 知识库ID
    tag_id VARCHAR(36),                       -- 标签ID
    type VARCHAR(50) NOT NULL,                -- 类型: manual/faq
    title VARCHAR(255) NOT NULL,              -- 标题
    description TEXT,                         -- 描述
    source VARCHAR(128) NOT NULL,             -- 来源
    parse_status VARCHAR(50),                 -- 解析状态
    summary_status VARCHAR(32),               -- 摘要状态
    enable_status VARCHAR(50),                -- 启用状态
    embedding_model_id VARCHAR(64),           -- Embedding模型ID
    file_name VARCHAR(255),                   -- 文件名
    file_type VARCHAR(50),                    -- 文件类型
    file_size BIGINT,                         -- 文件大小
    file_hash VARCHAR(64),                    -- 文件哈希
    file_path TEXT,                           -- 文件路径
    storage_size BIGINT DEFAULT 0,            -- 存储大小
    metadata JSONB,                           -- 元数据
    last_faq_import_result JSONB,             -- FAQ导入结果
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    processed_at TIMESTAMP,
    error_message TEXT,
    deleted_at TIMESTAMP
);
```

#### 4. chunks (文本块表)

```sql
CREATE TABLE chunks (
    id VARCHAR(36) PRIMARY KEY,               -- Chunk ID (UUID)
    seq_id BIGINT AUTO_INCREMENT UNIQUE,      -- 序列ID (FAQ使用)
    tenant_id INTEGER NOT NULL,               -- 租户ID
    knowledge_base_id VARCHAR(36) NOT NULL,   -- 知识库ID
    knowledge_id VARCHAR(36) NOT NULL,        -- 知识ID
    tag_id VARCHAR(36),                       -- 标签ID
    content TEXT NOT NULL,                    -- 内容
    chunk_index INTEGER NOT NULL,             -- 索引位置
    is_enabled BOOLEAN DEFAULT true,          -- 是否启用
    flags INTEGER DEFAULT 1,                  -- 标志位 (推荐等)
    status INTEGER DEFAULT 0,                 -- 状态
    start_at INTEGER NOT NULL,                -- 起始位置
    end_at INTEGER NOT NULL,                  -- 结束位置
    pre_chunk_id VARCHAR(36),                 -- 前一个Chunk
    next_chunk_id VARCHAR(36),                -- 后一个Chunk
    chunk_type VARCHAR(20) DEFAULT 'text',    -- 类型
    parent_chunk_id VARCHAR(36),              -- 父Chunk ID
    relation_chunks JSONB,                    -- 关系Chunk
    indirect_relation_chunks JSONB,           -- 间接关系
    metadata JSONB,                           -- 元数据
    content_hash VARCHAR(64),                 -- 内容哈希
    image_info TEXT,                          -- 图片信息
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);
```

**Chunk 类型**:
- `text`: 普通文本
- `image_ocr`: 图片OCR文本
- `image_caption`: 图片描述
- `summary`: 摘要
- `entity`: 实体
- `relationship`: 关系
- `faq`: FAQ条目
- `web_search`: Web搜索结果
- `table_summary`: 表格摘要
- `table_column`: 表格列描述

#### 5. sessions (会话表)

```sql
CREATE TABLE sessions (
    id VARCHAR(36) PRIMARY KEY,               -- 会话ID (UUID)
    tenant_id INTEGER NOT NULL,               -- 租户ID
    title VARCHAR(255),                       -- 会话标题
    description TEXT,                         -- 描述
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);
```

#### 6. messages (消息表)

```sql
CREATE TABLE messages (
    id VARCHAR(36) PRIMARY KEY,               -- 消息ID (UUID)
    request_id VARCHAR(36) NOT NULL,          -- 请求ID
    session_id VARCHAR(36) NOT NULL,          -- 会话ID
    role VARCHAR(50) NOT NULL,                -- 角色: user/assistant
    content TEXT NOT NULL,                    -- 内容
    knowledge_references JSONB DEFAULT '[]',  -- 知识引用
    agent_steps JSONB,                        -- Agent步骤
    is_completed BOOLEAN DEFAULT false,       -- 是否完成
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);
```

#### 7. models (模型表)

```sql
CREATE TABLE models (
    id VARCHAR(64) PRIMARY KEY,               -- 模型ID (UUID)
    tenant_id INTEGER NOT NULL,               -- 租户ID
    name VARCHAR(255) NOT NULL,               -- 模型名称
    type VARCHAR(50) NOT NULL,                -- 类型: chat/embedding/rerank
    source VARCHAR(50) NOT NULL,              -- 来源: local/api/builtin
    description TEXT,                         -- 描述
    parameters JSONB NOT NULL,                -- 参数配置
    is_default BOOLEAN DEFAULT false,         -- 是否默认
    status VARCHAR(50) DEFAULT 'active',      -- 状态
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);
```

---

## 🛠️ 技术栈详解

### 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Go** | 1.24+ | 主要开发语言 |
| **Gin** | 1.11.0 | Web 框架 |
| **GORM** | 1.25.12 | ORM 框架 |
| **PostgreSQL** | 17 (ParadeDB) | 主数据库 + 向量存储 |
| **Redis** | 7.0 | 缓存 + 消息队列 |
| **gRPC** | 1.78.0 | 微服务通信 |
| **Viper** | 1.20.1 | 配置管理 |
| **Asynq** | 0.25.1 | 异步任务队列 |
| **OpenTelemetry** | 1.38.0 | 链路追踪 |

### 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Vue.js** | 3.5.13 | 前端框架 |
| **TypeScript** | 5.8.0 | 类型系统 |
| **Vite** | 7.2.2 | 构建工具 |
| **Pinia** | 3.0.1 | 状态管理 |
| **Vue Router** | 4.5.0 | 路由管理 |
| **TDesign** | 1.17.2 | UI 组件库 |
| **Axios** | 1.8.4 | HTTP 客户端 |
| **Marked** | 5.1.2 | Markdown 渲染 |

### Python 技术栈 (DocReader)

| 技术 | 版本 | 用途 |
|------|------|------|
| **Python** | 3.10+ | 开发语言 |
| **gRPC** | 1.76.0 | 服务接口 |
| **PaddleOCR** | 2.10.0 | OCR 引擎 |
| **PDFPlumber** | 0.11.7 | PDF 解析 |
| **python-docx** | 1.2.0 | Word 解析 |
| **BeautifulSoup4** | 4.14.2 | HTML 解析 |
| **Pillow** | 12.0.0 | 图像处理 |
| **OpenAI** | 2.7.1 | LLM 客户端 |
| **Ollama** | 0.6.0 | 本地 LLM |

### 中间件和存储

| 组件 | 版本 | 用途 |
|------|------|------|
| **PostgreSQL (ParadeDB)** | v0.18.9-pg17 | 关系型数据库 + pgvector |
| **Redis** | 7.0-alpine | 缓存 + 消息队列 |
| **MinIO** | RELEASE.2025-09-07 | 对象存储 |
| **Neo4j** | 2025.10.1 | 图数据库 |
| **Qdrant** | v1.16.2 | 向量数据库 |
| **Jaeger** | 1.76.0 | 分布式追踪 |
| **DuckDB** | 2.5.4 | 嵌入式分析数据库 |

### AI/ML 模型支持

**LLM 模型**:
- Ollama (本地部署)
- OpenAI GPT 系列
- Qwen (通义千问)
- DeepSeek
- 其他 OpenAI 兼容 API

**Embedding 模型**:
- BGE 系列
- GTE 系列
- OpenAI Embeddings
- 本地 Embedding 模型

**Rerank 模型**:
- BGE-Reranker
- 自定义 Rerank 模型

**VLM 模型**:
- Ollama 多模态模型
- OpenAI Vision API

---

## 🔄 核心业务流程

### 1. 文档上传与处理流程

```
用户上传文档
    ↓
文件存储 (MinIO/COS)
    ↓
创建 Knowledge 记录 (status: pending)
    ↓
异步任务队列 (Asynq)
    ↓
DocReader gRPC 调用
    ↓
文档解析 (PDF/Word/Excel/...)
    ↓
OCR 处理 (可选)
    ↓
图片描述生成 (VLM, 可选)
    ↓
文本分块 (Chunking)
    ↓
向量化 (Embedding)
    ↓
存储 Chunks + Vectors
    ↓
索引构建 (BM25 + Vector)
    ↓
知识图谱提取 (可选)
    ↓
更新 Knowledge 状态 (status: completed)
```

### 2. 对话检索流程 (普通模式)

```
用户提问
    ↓
会话上下文加载
    ↓
查询改写 (多轮对话)
    ↓
查询扩展 (关键词提取)
    ↓
多路召回:
  ├─ BM25 关键词召回
  ├─ 向量相似度召回
  └─ 知识图谱召回 (可选)
    ↓
结果合并去重
    ↓
Rerank 重排序
    ↓
阈值过滤
    ↓
Top-K 结果
    ↓
Prompt 构建 (System + Context + Query)
    ↓
LLM 生成回答
    ↓
流式返回 + 引用标注
    ↓
保存消息历史
```

### 3. Agent 模式执行流程

```
用户提问
    ↓
Agent 引擎初始化
    ↓
ReACT 循环 (最多 N 轮):
  ├─ Thought: 分析问题
  ├─ Action: 选择工具
  │   ├─ knowledge_search (知识库检索)
  │   ├─ database_query (数据库查询)
  │   ├─ web_search (网络搜索)
  │   ├─ MCP 工具 (外部服务)
  │   └─ ...
  ├─ Observation: 工具执行结果
  └─ 判断是否需要继续
    ↓
Final Answer: 综合回答
    ↓
流式返回 + 步骤展示
    ↓
保存消息历史
```

### 4. FAQ 导入流程

```
用户上传 FAQ 文件 (Excel/CSV)
    ↓
解析文件结构
    ↓
验证数据格式
    ↓
批量创建 Chunk 记录:
  ├─ 问题 Chunk
  ├─ 相似问题 Chunk (可选)
  └─ 答案 Chunk (可选)
    ↓
向量化处理
    ↓
索引构建
    ↓
返回导入结果统计
```

---

## 🔐 安全与权限

### 认证机制

1. **用户认证**: JWT Token (Bearer)
2. **租户认证**: API Key (X-API-Key, sk- 前缀)
3. **双重认证**: 用户 + 租户隔离

### 权限控制

- 租户级别隔离
- 知识库访问控制
- 跨租户访问开关 (内网可开启)

### 数据安全

- 敏感信息加密存储 (AES)
- SQL 注入防护
- XSS 防护
- CORS 配置

---

## 📈 性能优化

### 1. 缓存策略

- **Redis 缓存**:
  - 模型配置缓存
  - 会话上下文缓存
  - 检索结果缓存

### 2. 并发控制

- **协程池**: `panjf2000/ants` (默认 5 并发)
- **数据库连接池**: GORM 连接池管理
- **gRPC 连接复用**

### 3. 异步任务

- **Asynq 任务队列**:
  - 文档解析任务
  - 向量化任务
  - 摘要生成任务
  - 知识图谱构建任务

### 4. 索引优化

- 数据库索引优化
- 向量索引 (HNSW/IVF)
- 全文检索索引

---

## 🚀 部署架构

### Docker Compose 部署

```yaml
services:
  - frontend (Nginx + Vue)
  - app (Go 后端)
  - docreader (Python gRPC)
  - postgres (ParadeDB)
  - redis
  - minio (可选)
  - neo4j (可选)
  - qdrant (可选)
  - jaeger (可选)
```

### 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| Frontend | 80 | Web UI |
| App | 8080 | 后端 API |
| DocReader | 50051 | gRPC 服务 |
| PostgreSQL | 5432 | 数据库 |
| Redis | 6379 | 缓存/MQ |
| MinIO | 9000/9001 | 对象存储 |
| Neo4j | 7474/7687 | 图数据库 |
| Qdrant | 6333/6334 | 向量数据库 |
| Jaeger | 16686 | 追踪 UI |

### 环境变量配置

关键环境变量:
```bash
# 数据库
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=weknora

# Redis
REDIS_PASSWORD=password

# 存储
STORAGE_TYPE=local/minio/cos
MINIO_ENDPOINT=minio:9000

# 模型
OLLAMA_BASE_URL=http://host.docker.internal:11434
INIT_LLM_MODEL_NAME=qwen2.5:latest
INIT_EMBEDDING_MODEL_NAME=bge-large-zh

# 功能开关
ENABLE_GRAPH_RAG=true
NEO4J_ENABLE=true
DISABLE_REGISTRATION=false
```

---

## 📝 API 接口概览

### 认证接口

- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/refresh` - 刷新 Token

### 知识库接口

- `GET /api/v1/knowledgebases` - 获取知识库列表
- `POST /api/v1/knowledgebases` - 创建知识库
- `GET /api/v1/knowledgebases/:id` - 获取知识库详情
- `PUT /api/v1/knowledgebases/:id` - 更新知识库
- `DELETE /api/v1/knowledgebases/:id` - 删除知识库

### 知识接口

- `GET /api/v1/knowledges` - 获取知识列表
- `POST /api/v1/knowledges` - 上传知识
- `GET /api/v1/knowledges/:id` - 获取知识详情
- `DELETE /api/v1/knowledges/:id` - 删除知识

### 会话接口

- `GET /api/v1/sessions` - 获取会话列表
- `POST /api/v1/sessions` - 创建会话
- `DELETE /api/v1/sessions/:id` - 删除会话

### 对话接口

- `POST /api/v1/chat` - 发送消息 (流式)
- `GET /api/v1/messages` - 获取消息历史

### 模型接口

- `GET /api/v1/models` - 获取模型列表
- `POST /api/v1/models` - 创建模型
- `PUT /api/v1/models/:id` - 更新模型

---

## 🎨 前端架构

### 目录结构

```
frontend/
├── src/
│   ├── api/              # API 接口
│   ├── assets/           # 静态资源
│   ├── components/       # 组件
│   ├── router/           # 路由
│   ├── stores/           # Pinia 状态
│   ├── types/            # TypeScript 类型
│   ├── utils/            # 工具函数
│   ├── views/            # 页面视图
│   ├── App.vue           # 根组件
│   └── main.ts           # 入口文件
├── public/               # 公共资源
├── index.html            # HTML 模板
├── vite.config.ts        # Vite 配置
└── package.json          # 依赖配置
```

### 核心页面

- 知识库管理
- 知识管理
- 会话管理
- 对话界面
- 模型配置
- 系统设置

---

## 🔍 监控与追踪

### OpenTelemetry 集成

- **Trace**: 请求链路追踪
- **Span**: 操作耗时统计
- **Context**: 上下文传播

### Jaeger 可视化

- 请求链路可视化
- 性能瓶颈分析
- 错误追踪

### 日志系统

- 结构化日志 (logrus)
- 请求 ID 追踪
- 错误堆栈记录

---

## 🧪 测试与评估

### E2E 测试

**位置**: `dataset/`

**功能**:
- 检索召回率测试
- 答案质量评估
- BLEU/ROUGE 指标
- 可视化报告

### 数据集格式

- `queries.parquet`: 查询集
- `corpus.parquet`: 文档集
- `qrels.parquet`: 相关性标注
- `answers.parquet`: 标准答案

---

## 📚 开发指南

### 快速开发模式

```bash
# 启动基础设施
make dev-start

# 启动后端 (新终端)
make dev-app

# 启动前端 (新终端)
make dev-frontend
```

### 代码规范

- Go: `gofmt` + `golangci-lint`
- Python: `pylint`
- TypeScript: `eslint` + `prettier`

### Git 提交规范

```
feat: 新功能
fix: 修复bug
docs: 文档更新
test: 测试相关
refactor: 重构
```

---

## 🌟 核心特性总结

1. ✅ **多模态文档理解**: PDF、Word、图片等多格式支持
2. ✅ **Agent 模式**: ReACT 框架 + 工具调用
3. ✅ **混合检索**: BM25 + 向量 + 知识图谱
4. ✅ **知识图谱**: 实体关系提取与推理
5. ✅ **多租户隔离**: 企业级权限管理
6. ✅ **模型灵活配置**: 支持本地和云端模型
7. ✅ **MCP 扩展**: 标准化工具集成
8. ✅ **Web 搜索**: 实时信息补充
9. ✅ **异步任务**: 高效的后台处理
10. ✅ **可观测性**: 完整的监控追踪

---

## 📖 参考资料

- [官方文档](https://weknora.weixin.qq.com)
- [GitHub 仓库](https://github.com/Tencent/WeKnora)
- [API 文档](./docs/api/README.md)
- [开发指南](./docs/开发指南.md)
- [知识图谱配置](./docs/开启知识图谱功能.md)
- [MCP 功能说明](./docs/MCP功能使用说明.md)

---

**文档生成时间**: 2026-03-04  
**项目版本**: v0.2.10  
**文档作者**: Kiro AI Assistant
