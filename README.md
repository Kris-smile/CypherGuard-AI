# CypherGuard AI

<div align="center">

![CypherGuard AI](https://img.shields.io/badge/CypherGuard-AI-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Production%20Ready-success?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**基于 AI 驱动的网络安全知识体系管理系统**

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [架构设计](#-架构设计) • [文档](#-文档) • [贡献](#-贡献)

</div>

---

## 📖 项目简介

CypherGuard AI 是一个现代化的 RAG（检索增强生成）系统，专为网络安全知识管理设计。系统支持文档上传、自动索引、向量检索和带引用的 AI 问答，帮助用户快速获取准确的安全知识。

### 核心特性

- 🔐 **用户认证** - JWT Token 认证，支持注册和登录
- 📚 **知识库管理** - 支持多种文档格式上传和管理
- 🤖 **AI 对话** - 基于 RAG 的智能问答系统
- 📝 **引用溯源** - 每个回答都有可追溯的来源
- 🎨 **现代化 UI** - 响应式设计，流畅动画
- 🐳 **Docker 部署** - 一键启动所有服务

## ✨ 功能特性

### 前端功能

- ✅ 用户注册和登录
- ✅ 文档上传（PDF, TXT, MD, DOC, DOCX）
- ✅ 文档列表和状态跟踪
- ✅ AI 对话问答
- ✅ 引用来源展示
- ✅ 对话历史管理
- ✅ 响应式设计

### 后端功能

- ✅ 用户认证和授权（RBAC）
- ✅ 文档解析和切分
- ✅ 向量化和索引
- ✅ 向量检索和 Rerank
- ✅ LLM 生成和引用
- ✅ 异步任务处理
- ✅ 并发控制和限流

## 🚀 快速开始

### 前置要求

- Docker Desktop
- 8GB+ RAM
- 20GB+ 磁盘空间

### 一键启动

**Windows:**
```bash
start_frontend.bat
```

**Linux/Mac:**
```bash
chmod +x start_frontend.sh
./start_frontend.sh
```

**手动启动:**
```bash
docker-compose up -d
```

### 访问应用

打开浏览器访问：**http://localhost**

### 首次使用

1. **注册账号**
   - 点击 "Don't have an account? Register"
   - 填写邮箱、用户名和密码
   - 自动登录到仪表板

2. **上传文档**
   - 点击左侧 "Knowledge Core"
   - 选择文件并上传
   - 等待处理完成（状态变为 "ready"）

3. **开始对话**
   - 点击左侧 "Neural Chat"
   - 点击 "New Conversation"
   - 输入问题并查看回答

## 🏗️ 架构设计

### 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  - Login/Register  - Knowledge Base  - AI Chat          │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────┐
│                  Gateway (Nginx)                         │
│  - Routing  - CORS  - Load Balancing                    │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┬─────────────┐
        ↓             ↓             ↓             ↓
┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│ Auth Service │ │ KB Svc   │ │ Chat Svc │ │ Model Gateway│
└──────┬───────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘
       │              │            │               │
       └──────────────┴────────────┴───────────────┘
                      │
        ┌─────────────┼─────────────┬─────────────┐
        ↓             ↓             ↓             ↓
┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  PostgreSQL  │ │  Redis   │ │  MinIO   │ │  Qdrant  │
└──────────────┘ └──────────┘ └──────────┘ └──────────┘
```

### 技术栈

**前端:**
- React 19 + TypeScript
- Vite + Tailwind CSS
- React Router + Axios
- Framer Motion

**后端:**
- Python 3.11 + FastAPI
- PostgreSQL + Redis
- MinIO + Qdrant
- Celery

**部署:**
- Docker + Docker Compose
- Nginx

## 📁 项目结构

```
cypherguard-ai/
├── frontend/              # 前端应用
│   ├── src/
│   │   ├── components/   # 可复用组件
│   │   ├── contexts/     # React Context
│   │   ├── pages/        # 页面组件
│   │   └── services/     # API 服务
│   └── Dockerfile
├── services/              # 后端微服务
│   ├── auth-service/     # 认证服务
│   ├── kb-service/       # 知识库服务
│   ├── chat-service/     # 对话服务
│   ├── model-gateway/    # 模型网关
│   └── worker/           # 异步任务
├── gateway/               # Nginx 网关
├── shared/                # 共享代码
├── infra/                 # 基础设施配置
├── docs/                  # 文档
└── docker-compose.yml     # Docker 配置
```

## 📚 文档

| 文档 | 说明 |
|------|------|
| [FRONTEND_SETUP.md](FRONTEND_SETUP.md) | 前端快速启动指南 |
| [FRONTEND_IMPLEMENTATION.md](FRONTEND_IMPLEMENTATION.md) | 前端实现详情 |
| [VERIFICATION_CHECKLIST.md](VERIFICATION_CHECKLIST.md) | 功能验证清单 |
| [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) | 项目总结 |
| [frontend/README.md](frontend/README.md) | 前端使用文档 |
| [docs/api.md](docs/api.md) | API 接口文档 |
| [docs/architecture.md](docs/architecture.md) | 系统架构文档 |
| [codex.md](codex.md) | 项目规范文档 |

## 🧪 测试

### 运行集成测试

```bash
chmod +x test_frontend_backend.sh
./test_frontend_backend.sh
```

### 手动测试

参见 [VERIFICATION_CHECKLIST.md](VERIFICATION_CHECKLIST.md)

## 🔧 开发

### 本地开发模式

```bash
# 启动后端服务
docker-compose up -d postgres redis minio qdrant gateway \
  auth-service kb-service chat-service model-gateway worker

# 启动前端开发服务器
cd frontend
npm install
npm run dev
# 访问 http://localhost:5173
```

### 查看日志

```bash
# 所有服务
docker-compose logs -f

# 特定服务
docker-compose logs -f frontend
docker-compose logs -f chat-service
```

### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart frontend
```

## 🐛 故障排除

### 服务无法启动

```bash
docker-compose down
docker-compose up -d
docker-compose ps
```

### 前端无法访问

```bash
docker-compose logs gateway
docker-compose logs frontend
docker-compose restart gateway frontend
```

### API 请求失败

```bash
docker-compose logs auth-service
docker-compose logs kb-service
docker-compose logs chat-service
```

更多故障排除信息，请查看 [FRONTEND_SETUP.md](FRONTEND_SETUP.md)

## 🎯 使用场景

- 📖 **安全知识库** - 管理和检索安全文档
- 🔍 **智能问答** - 快速获取准确答案
- 📝 **引用追溯** - 验证信息来源
- 🎓 **学习辅助** - 安全知识学习助手
- 🔬 **研究工具** - 安全研究资料管理

## 🔒 安全特性

- JWT Token 认证
- 密码 bcrypt 加密
- CORS 配置
- SQL 注入防护
- XSS 防护
- 敏感信息加密

## 📊 性能指标

- 首屏加载：< 2s
- API 响应：< 1s
- 向量检索：< 100ms
- AI 生成：< 3s
- 支持并发：多用户同时使用

## 🗺️ 路线图

### Phase 6 ✅（已完成）
- ✅ 前端用户认证
- ✅ 前端知识库管理
- ✅ 前端 AI 对话
- ✅ 前后端完全联通

### Phase 7 🚧（计划中）
- [ ] 模型配置管理界面
- [ ] 系统设置页面
- [ ] 文档预览功能
- [ ] 对话历史搜索

### Phase 8 📋（计划中）
- [ ] 多语言支持
- [ ] 深色模式切换
- [ ] PWA 支持
- [ ] 移动端优化

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- FastAPI - 现代化的 Python Web 框架
- React - 用户界面库
- Qdrant - 向量数据库
- Tailwind CSS - CSS 框架
- 所有开源贡献者

## 📞 支持

- 📧 Email: support@cypherguard.ai
- 📖 文档: [docs/](docs/)
- 🐛 问题: [GitHub Issues](https://github.com/your-repo/issues)

---

<div align="center">

**CypherGuard AI - 让安全知识触手可及** 🛡️

Made with ❤️ by CypherGuard Team

</div>
