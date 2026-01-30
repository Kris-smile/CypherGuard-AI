# CypherGuard AI Frontend

现代化的 AI 驱动网络安全知识管理系统前端界面。

## 功能特性

### ✅ 已实现功能

1. **用户认证**
   - 用户注册和登录
   - JWT Token 认证
   - 受保护的路由
   - 自动登出

2. **知识库管理**
   - 文档上传（PDF, TXT, MD, DOC, DOCX）
   - 文档列表查看
   - 文档状态跟踪（pending, processing, ready, failed）
   - 文档删除
   - 标签管理

3. **AI 对话**
   - 创建新对话
   - 多对话管理
   - 实时消息发送
   - 引用来源展示
   - 对话模式选择（Quick/Strict）
   - 引用高亮和展开

4. **用户界面**
   - 响应式设计
   - 深色/浅色主题
   - 流畅动画效果
   - 侧边栏折叠
   - 现代化 UI 组件

## 技术栈

- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **React Router** - 路由管理
- **Axios** - HTTP 客户端
- **Tailwind CSS** - 样式框架
- **Framer Motion** - 动画库
- **Lucide React** - 图标库

## 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

### Docker 部署

```bash
# 使用 docker-compose 启动整个系统（包括前端）
docker-compose up -d

# 访问前端
# http://localhost
```

## 环境变量

创建 `.env` 文件：

```env
VITE_API_BASE_URL=http://localhost
```

## 项目结构

```
frontend/
├── src/
│   ├── components/          # 可复用组件
│   │   └── ProtectedRoute.tsx
│   ├── contexts/            # React Context
│   │   └── AuthContext.tsx
│   ├── pages/               # 页面组件
│   │   ├── Login.tsx        # 登录/注册页面
│   │   ├── Dashboard.tsx    # 主仪表板
│   │   ├── Chat.tsx         # AI 对话页面
│   │   └── KnowledgeBase.tsx # 知识库管理
│   ├── services/            # API 服务
│   │   └── api.ts           # API 客户端
│   ├── App.tsx              # 应用根组件
│   ├── main.tsx             # 应用入口
│   └── utils.ts             # 工具函数
├── public/                  # 静态资源
├── Dockerfile               # Docker 配置
└── package.json             # 依赖配置
```

## API 集成

前端通过 Axios 与后端 API 通信：

- **Auth API**: `/auth/*` - 用户认证
- **KB API**: `/kb/*` - 知识库管理
- **Chat API**: `/chat/*` - AI 对话

所有请求自动携带 JWT Token，401 错误自动跳转登录页。

## 使用指南

### 1. 注册/登录

首次使用需要注册账号：
- 输入邮箱、用户名和密码
- 点击 "Create Account"
- 自动登录并跳转到仪表板

### 2. 上传文档

在 "Knowledge Core" 页面：
- 点击选择文件
- 可选：输入标题和标签
- 点击 "Upload Document"
- 等待处理完成（状态变为 "ready"）

### 3. AI 对话

在 "Neural Chat" 页面：
- 选择对话模式（Quick/Strict）
- 点击 "New Conversation"
- 输入问题并发送
- 查看 AI 回答和引用来源
- 点击 "sources" 展开引用详情

## 开发说明

### 添加新页面

1. 在 `src/pages/` 创建新组件
2. 在 `Dashboard.tsx` 添加路由
3. 更新侧边栏导航项

### 添加新 API

1. 在 `src/services/api.ts` 定义类型
2. 添加 API 函数
3. 在组件中调用

### 样式定制

使用 Tailwind CSS 类名，配置文件：`tailwind.config.js`

## 浏览器支持

- Chrome/Edge (最新版本)
- Firefox (最新版本)
- Safari (最新版本)

## 故障排除

### 无法连接后端

检查 `.env` 文件中的 `VITE_API_BASE_URL` 是否正确。

### 401 错误

Token 可能已过期，请重新登录。

### 文档上传失败

检查文件格式和大小限制。

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
