# 🔧 Network Error 快速修复指南

## 问题原因

前端开发服务器运行在 **http://localhost:5174**，但你可能在尝试访问 **http://localhost**（80 端口），导致前端无法加载。

## ✅ 解决方案

### 方案 1：直接访问前端开发服务器（推荐）

**访问地址：http://localhost:5174**

这是最简单的方法，前端已经在这个端口运行了。

### 方案 2：使用标准端口 5173

如果你想使用标准的 5173 端口，需要先停止占用该端口的进程：

```powershell
# 查找占用 5173 端口的进程
netstat -ano | findstr :5173

# 停止该进程（替换 <PID> 为实际的进程 ID）
taskkill /PID <PID> /F

# 重启前端
cd frontend
npm run dev
```

然后访问：**http://localhost:5173**

### 方案 3：通过 Gateway 访问（需要额外配置）

如果你想通过 http://localhost 访问，需要：

1. 确保前端 Docker 容器正在运行
2. 或者修改 nginx 配置指向本地开发服务器

## 🧪 验证步骤

### 1. 检查前端是否运行

```powershell
# 应该看到 Vite 服务器正在运行
# Local: http://localhost:5174/
```

### 2. 访问前端

在浏览器中打开：**http://localhost:5174**

### 3. 测试注册

1. 填写表单
2. 点击 "Create Account"
3. 应该能看到 API 请求发送到 `http://localhost/auth/register`

### 4. 检查浏览器控制台

打开开发者工具（F12），应该看到：
- Console: `Registering user: {email: "...", username: "..."}`
- Network: 请求发送到 `http://localhost/auth/register`

## 📊 当前服务状态

✅ **后端服务（正常）：**
- Gateway: http://localhost:80 ✓
- Auth Service: 运行中 ✓
- KB Service: 运行中 ✓
- Chat Service: 运行中 ✓

✅ **前端服务（正常）：**
- 开发服务器: http://localhost:5174 ✓

## 🔍 故障排除

### 问题：访问 http://localhost:5174 显示空白页

**解决方案：**
```powershell
cd frontend
npm install
npm run dev
```

### 问题：仍然显示 Network Error

**检查步骤：**

1. **确认后端服务运行：**
```powershell
docker-compose ps
# 所有服务应该显示 "Up" 和 "healthy"
```

2. **测试 API 连接：**
```powershell
curl http://localhost/healthz
# 应该返回 "OK"
```

3. **检查浏览器控制台：**
- 打开 F12
- 查看 Network 标签
- 查看失败的请求详情

4. **检查 CORS：**
- 确认请求头中有 `Access-Control-Allow-Origin`
- 如果没有，重启 gateway：
```powershell
docker-compose restart gateway
```

### 问题：端口 5174 也被占用

**解决方案：**
Vite 会自动尝试下一个可用端口（5175, 5176...），查看终端输出的实际端口号。

## 🎯 推荐的开发流程

### 日常开发

1. **启动后端服务：**
```powershell
docker-compose up -d
```

2. **启动前端开发服务器：**
```powershell
cd frontend
npm run dev
```

3. **访问应用：**
- 前端：http://localhost:5173 或 5174
- API：http://localhost

### 生产部署

1. **构建前端：**
```powershell
cd frontend
npm run build
```

2. **启动所有服务：**
```powershell
docker-compose up -d
```

3. **访问应用：**
- http://localhost

## 📝 环境变量说明

**frontend/.env:**
```env
VITE_API_BASE_URL=http://localhost
```

这个配置告诉前端向 `http://localhost` 发送 API 请求，这是正确的。

## ✨ 快速测试命令

```powershell
# 测试 Gateway
curl http://localhost/healthz

# 测试 Auth API
curl http://localhost/auth/me
# 应该返回 {"detail":"Not authenticated"}

# 测试 Chat API
curl http://localhost/chat/modes
# 应该返回模式列表

# 检查前端
# 在浏览器访问 http://localhost:5174
```

## 🎉 成功标志

当你看到以下内容时，说明一切正常：

1. ✅ 前端页面正常加载（http://localhost:5174）
2. ✅ 可以看到登录/注册表单
3. ✅ 填写表单后点击按钮有响应
4. ✅ 浏览器控制台没有 Network Error
5. ✅ 可以成功注册/登录

---

**现在请访问：http://localhost:5174** 🚀
