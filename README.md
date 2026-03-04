# CypherGuard AI

**基于 AI 驱动的网络安全知识体系管理系统**

现代化 RAG（检索增强生成）系统，专为网络安全知识管理设计。支持文档上传、自动索引、向量检索和带引用的 AI 问答。

---

## 功能概览

| 模块 | 能力 |
|------|------|
| **用户认证** | JWT Token、注册/登录（邮箱或用户名）、RBAC（admin/user） |
| **知识库** | 上传 PDF/TXT/MD/DOC/DOCX，自动解析、切分、向量化索引 |
| **AI 对话** | RAG 检索 + Rerank + LLM 生成，每条回答附带引用来源 |
| **模型管理** | 支持 OpenAI / Azure / Cohere / Ollama / 自定义兼容 API |
| **异步处理** | Celery Worker 异步执行文档摄取流水线 |

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS + Framer Motion |
| 后端 | Python 3.11 + FastAPI + Celery |
| 数据库 | PostgreSQL 15 · Redis 7 · Qdrant（向量库） · MinIO（对象存储） |
| 网关 | Nginx |
| 部署 | Docker + Docker Compose |

---

## 系统架构

```
┌──────────────────────────────────────────────────────────┐
│                   Frontend (React)                        │
│   Login/Register · Knowledge Base · AI Chat · Settings   │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ↓
┌──────────────────────────────────────────────────────────┐
│                   Gateway (Nginx :80)                     │
│         /auth  /kb  /chat  /models  /modes               │
└────────────────────────┬─────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┬──────────────┐
         ↓               ↓               ↓              ↓
   Auth Service    KB Service     Chat Service    Model Gateway
         │               │               │              │
         └───────────────┴───────────────┴──────────────┘
                         │
         ┌───────────────┼───────────────┬──────────────┐
         ↓               ↓               ↓              ↓
     PostgreSQL        Redis           MinIO          Qdrant
```

---

## 快速开始

### 前置要求

- **Docker Desktop** 已安装并运行
- 8 GB+ 内存、20 GB+ 可用磁盘
- 确保端口 `80 / 5173 / 5433 / 6333 / 6380 / 9000 / 9001` 未被占用

### 1. 配置环境变量

```bash
# 根目录
cp .env.example .env
# 前端
cp frontend/.env.example frontend/.env
```

> 生产环境务必修改 `.env` 中的 `JWT_SECRET`、`POSTGRES_PASSWORD`、`MINIO_ROOT_PASSWORD`。

### 2. 启动所有服务

**Windows:**
```bat
start_frontend.bat
```

**Linux / macOS:**
```bash
chmod +x start_frontend.sh && ./start_frontend.sh
```

**手动:**
```bash
docker-compose up -d
docker-compose ps          # 确认全部 healthy / running
```

### 3. 访问应用

| 入口 | 地址 | 说明 |
|------|------|------|
| **前端应用** | `http://localhost:5173` | React 开发服务器 |
| **API 网关** | `http://localhost` | Nginx 代理后端 API |
| MinIO 控制台 | `http://localhost:9001` | 对象存储管理（minioadmin / minioadmin） |
| Qdrant Dashboard | `http://localhost:6333/dashboard` | 向量库管理 |

> **注意:** 当前 Nginx 根路径 `/` 仅返回 API 信息，前端请使用 `:5173`。

### 4. 首次使用

1. 打开 `http://localhost:5173`，注册一个账号
2. 进入 **Knowledge Core**，上传文档，等待状态变为 `ready`
3. 进入 **Neural Chat**，新建对话并提问

### 5. 配置 AI 模型（关键步骤）

如果不配置模型，系统会使用 mock 回答。要使用真实 AI：

1. 进入 **System Config → 模型管理**
2. 至少添加一个 **Embedding 模型**（如 `text-embedding-3-small`）并设为默认
3. 至少添加一个 **Chat 模型**（如 `gpt-4o-mini`）并设为默认
4. （可选）添加 **Rerank 模型**（如 Cohere `rerank-english-v3.0`）

支持的提供商：OpenAI / Azure OpenAI / Cohere / Ollama / 自定义 OpenAI-Compatible API。

---

## 本地开发

```bash
# 只启动后端基础设施和服务
docker-compose up -d postgres redis minio qdrant gateway \
  auth-service kb-service chat-service model-gateway model-config-service worker

# 前端本地开发（支持热重载）
cd frontend
npm install
npm run dev
# 访问 http://localhost:5173
```

---

## 项目结构

```
cypherguard-ai/
├── frontend/              # React 前端
│   ├── src/
│   │   ├── components/    # 复用组件
│   │   ├── contexts/      # React Context（Auth）
│   │   ├── pages/         # 页面（Login, Dashboard, Chat, KnowledgeBase, Settings）
│   │   └── services/      # API 客户端
│   └── Dockerfile
├── services/              # Python 微服务
│   ├── auth-service/      # 认证（JWT + RBAC）
│   ├── kb-service/        # 知识库（文档 CRUD + MinIO）
│   ├── chat-service/      # 对话（RAG 检索 + 引用）
│   ├── model-gateway/     # 模型路由（OpenAI / Ollama / Cohere）
│   ├── model-config-service/ # 模型配置管理
│   └── worker/            # Celery Worker（文档摄取流水线）
├── gateway/               # Nginx 配置
├── shared/                # Python 共享代码（models, schemas, config）
├── infra/                 # 数据库初始化脚本
├── docs/                  # API 和架构文档
│   ├── api.md
│   └── architecture.md
├── codex.md               # 项目规范（MVP 定义 + 编码约束）
├── 调研.md                # UI/UX 参考设计调研
├── github.md              # Git 工作流与命令参考
├── .env.example           # 环境变量模板
└── docker-compose.yml     # 容器编排
```

---

## API 端点速查

详见 [docs/api.md](docs/api.md)。

| 服务 | 路径 | 说明 |
|------|------|------|
| Auth | `POST /auth/register` | 注册 |
| Auth | `POST /auth/login` | 登录 |
| Auth | `GET /auth/me` | 当前用户信息 |
| KB | `POST /kb/documents/upload` | 上传文档 |
| KB | `GET /kb/documents` | 文档列表 |
| KB | `DELETE /kb/documents/{id}` | 删除文档 |
| Chat | `POST /chat/conversations` | 创建对话 |
| Chat | `POST /chat/conversations/{id}/messages` | 发送消息 |
| Models | `GET /models` | 模型配置列表 |
| Models | `POST /models` | 添加模型配置 |
| Health | `GET /healthz` | 所有服务健康检查 |

---

## 故障排除

```bash
# 查看所有服务状态
docker-compose ps

# 查看特定服务日志
docker-compose logs -f chat-service
docker-compose logs -f model-gateway

# 重启所有服务
docker-compose down && docker-compose up -d
```

| 现象 | 排查方向 |
|------|----------|
| 无法访问前端 | 确认 `docker-compose ps` 中 frontend 正在运行，访问 `:5173` |
| 401 错误 | Token 过期，重新登录 |
| AI 回答是 mock 文本 | 未配置模型，进入 Settings 添加 |
| 文档状态卡在 processing | 检查 worker 日志 `docker-compose logs -f worker` |

---

## 安全注意事项

- `JWT_SECRET` **生产环境必须修改**，默认值仅供开发
- API Key 当前使用 Base64 编码存储，生产建议升级为 Fernet/KMS 加密
- CORS 当前配置为 `*`，生产应限制为具体域名
- 初始化 SQL 包含默认 admin 账号（admin@cypherguard.local / admin123），首次登录后应立即修改密码

---

## 文档索引

| 文件 | 说明 |
|------|------|
| [docs/api.md](docs/api.md) | API 接口文档 |
| [docs/architecture.md](docs/architecture.md) | 系统架构与数据流 |
| [codex.md](codex.md) | 项目规范（MVP 定义、编码约束、质量红线） |
| [调研.md](调研.md) | UI/UX 参考设计 |
| [github.md](github.md) | Git 工作流与命令参考 |
| [frontend/README.md](frontend/README.md) | 前端开发文档 |

---

## 许可证

MIT License
