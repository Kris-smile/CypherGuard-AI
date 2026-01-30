# CypherGuard AI - 前端设置指南

## 快速启动

### 方式一：使用 Docker Compose（推荐）

这是最简单的方式，会同时启动前端和所有后端服务。

```bash
# 1. 启动所有服务
docker-compose up -d

# 2. 等待服务启动（约30秒）
docker-compose ps

# 3. 访问应用
# 打开浏览器访问: http://localhost
```

### 方式二：本地开发模式

如果你想修改前端代码并实时预览：

```bash
# 1. 启动后端服务（不包括前端）
docker-compose up -d postgres redis minio qdrant gateway auth-service kb-service chat-service model-gateway worker

# 2. 进入前端目录
cd frontend

# 3. 安装依赖（首次运行）
npm install

# 4. 启动开发服务器
npm run dev

# 5. 访问应用
# 打开浏览器访问: http://localhost:5173
```

## 功能演示

### 1. 用户注册和登录

**注册新账号：**
1. 访问 http://localhost
2. 点击 "Don't have an account? Register"
3. 填写：
   - Email: `admin@example.com`
   - Username: `admin`
   - Password: `Admin123!`
4. 点击 "Create Account"
5. 自动登录并跳转到仪表板

**登录已有账号：**
1. 输入邮箱和密码
2. 点击 "Authenticate"

### 2. 上传文档到知识库

1. 点击左侧菜单 "Knowledge Core"
2. 点击 "Select File" 选择文档
   - 支持格式：PDF, TXT, MD, DOC, DOCX
3. （可选）输入文档标题
4. （可选）输入标签，用逗号分隔
5. 点击 "Upload Document"
6. 等待状态变为 "ready"（绿色）

### 3. AI 对话问答

1. 点击左侧菜单 "Neural Chat"
2. 选择对话模式：
   - **Quick**: 快速模式，更宽松的回答
   - **Strict**: 严格模式，必须有证据才回答
3. 点击 "New Conversation"
4. 在输入框输入问题，例如：
   - "这个文档讲了什么？"
   - "总结一下主要内容"
   - "关于XXX有什么信息？"
5. 查看 AI 回答
6. 点击 "X sources" 展开引用来源
7. 查看引用的文档片段和相关性分数

### 4. 查看引用来源

AI 回答下方会显示引用来源数量，点击可展开：
- **文档标题**：引用的文档名称
- **页码**：具体页码（如果有）
- **片段**：相关文本片段
- **相关性分数**：匹配度百分比

## 界面说明

### 侧边栏导航

- **Neural Chat** 🤖 - AI 对话界面
- **Knowledge Core** 📚 - 知识库管理
- **Model Nexus** 🧠 - 模型配置（开发中）
- **System Config** ⚙️ - 系统设置（开发中）

### 顶部栏

- **搜索框** - 快速搜索（开发中）
- **通知铃铛** - 系统通知（开发中）
- **用户头像** - 点击查看用户信息

### 底部用户区

- 显示当前用户名和角色
- 点击登出图标退出登录

## 技术细节

### API 端点

前端通过以下端点与后端通信：

```
http://localhost/auth/*      - 认证服务
http://localhost/kb/*        - 知识库服务
http://localhost/chat/*      - 对话服务
```

### 认证机制

- 使用 JWT Token 认证
- Token 存储在 localStorage
- 自动在请求头添加 Authorization
- 401 错误自动跳转登录页

### 状态管理

- 使用 React Context 管理全局状态
- AuthContext 管理用户认证状态
- 本地状态管理页面数据

## 故障排除

### 问题：无法访问 http://localhost

**解决方案：**
```bash
# 检查服务状态
docker-compose ps

# 查看 gateway 日志
docker-compose logs gateway

# 重启 gateway
docker-compose restart gateway
```

### 问题：登录后显示 401 错误

**解决方案：**
```bash
# 检查 auth-service 状态
docker-compose logs auth-service

# 重启认证服务
docker-compose restart auth-service
```

### 问题：文档上传失败

**解决方案：**
```bash
# 检查 kb-service 和 minio
docker-compose logs kb-service
docker-compose logs minio

# 确保 minio 正常运行
docker-compose restart minio kb-service
```

### 问题：AI 对话无响应

**解决方案：**
```bash
# 检查 chat-service 和 model-gateway
docker-compose logs chat-service
docker-compose logs model-gateway

# 确保模型配置正确
# 查看数据库中的 model_configs 表
```

### 问题：前端样式错乱

**解决方案：**
```bash
# 清除缓存并重新构建
cd frontend
rm -rf node_modules dist
npm install
npm run build
```

## 测试脚本

运行集成测试：

```bash
# 给脚本执行权限
chmod +x test_frontend_backend.sh

# 运行测试
./test_frontend_backend.sh
```

测试内容：
- ✓ 服务健康检查
- ✓ 用户注册
- ✓ 用户登录
- ✓ 获取用户信息
- ✓ 文档列表
- ✓ 对话列表

## 开发建议

### 修改前端代码

1. 修改 `frontend/src/` 下的文件
2. Vite 会自动热重载
3. 在浏览器中查看更改

### 添加新功能

1. 在 `src/pages/` 创建新页面组件
2. 在 `src/services/api.ts` 添加 API 调用
3. 在 `Dashboard.tsx` 添加路由
4. 更新侧边栏导航

### 调试技巧

- 使用浏览器开发者工具（F12）
- 查看 Network 标签页的 API 请求
- 查看 Console 标签页的错误信息
- 使用 React DevTools 扩展

## 性能优化

### 生产构建

```bash
cd frontend
npm run build

# 构建产物在 dist/ 目录
# 可以部署到任何静态文件服务器
```

### Docker 生产镜像

```dockerfile
# 多阶段构建
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 下一步

- [ ] 实现模型配置管理界面
- [ ] 添加系统设置页面
- [ ] 实现文档预览功能
- [ ] 添加对话历史搜索
- [ ] 实现多语言支持
- [ ] 添加深色模式切换
- [ ] 优化移动端体验

## 支持

如有问题，请查看：
- 项目文档：`docs/`
- API 文档：`docs/api.md`
- 架构文档：`docs/architecture.md`

## 许可证

MIT License
