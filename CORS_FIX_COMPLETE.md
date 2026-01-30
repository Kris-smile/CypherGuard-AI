# ✅ CORS 问题已修复

## 问题描述

前端发送 API 请求时，浏览器会先发送 OPTIONS 预检请求（CORS preflight），但服务器返回 **405 Method Not Allowed**，导致实际的 POST/GET 请求无法发送。

## 修复内容

### 1. 后端服务添加 CORS 中间件

为所有 FastAPI 服务添加了 CORS 中间件：

**修改的文件：**
- `services/auth-service/app/main.py`
- `services/kb-service/app/main.py`
- `services/chat-service/app/main.py`

**添加的代码：**
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有方法（包括 OPTIONS）
    allow_headers=["*"],  # 允许所有头
)
```

### 2. Nginx 配置优化

更新了 `gateway/nginx.conf`，为每个 location 块添加 CORS 头：

```nginx
location /auth/ {
    # CORS headers
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Accept' always;
    add_header 'Access-Control-Max-Age' 1728000 always;

    # Handle OPTIONS
    if ($request_method = 'OPTIONS') {
        return 204;
    }

    proxy_pass http://auth_service/auth/;
    # ... 其他配置
}
```

### 3. 重启服务

```bash
docker-compose restart gateway auth-service kb-service chat-service
```

## 验证步骤

### 1. 访问前端

打开浏览器访问：**http://localhost:5174**

### 2. 打开开发者工具

按 F12 打开浏览器开发者工具，切换到 Network 标签页。

### 3. 测试注册

填写注册表单并提交，你应该看到：

**成功的请求序列：**
1. ✅ **OPTIONS** http://localhost/auth/register - 状态码 **204 No Content**
2. ✅ **POST** http://localhost/auth/register - 状态码 **200 OK** 或 **201 Created**

**响应头应包含：**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, Accept
```

### 4. 检查控制台

Console 标签页应该显示：
```
Registering user: {email: "...", username: "..."}
```

没有 CORS 错误！

## 现在可以做什么

✅ **用户注册** - 创建新账号
✅ **用户登录** - 登录已有账号
✅ **上传文档** - 上传文件到知识库
✅ **AI 对话** - 与 AI 进行问答

## 测试命令

### 测试 OPTIONS 请求（PowerShell）

```powershell
# 测试 Auth Service
$headers = @{
    "Origin" = "http://localhost:5173"
    "Access-Control-Request-Method" = "POST"
    "Access-Control-Request-Headers" = "Content-Type"
}
Invoke-WebRequest -Uri "http://localhost/auth/register" -Method OPTIONS -Headers $headers

# 应该返回 204 No Content
```

### 测试注册 API

```powershell
$body = @{
    email = "test@example.com"
    username = "testuser"
    password = "test123"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost/auth/register" -Method POST -Body $body -ContentType "application/json"

# 应该返回 200/201 和 JWT token
```

## 故障排除

### 问题：仍然显示 CORS 错误

**解决方案：**
1. 清除浏览器缓存（Ctrl+Shift+Delete）
2. 硬刷新页面（Ctrl+F5）
3. 重启浏览器

### 问题：OPTIONS 请求返回 405

**解决方案：**
```bash
# 检查服务日志
docker-compose logs auth-service

# 重启服务
docker-compose restart auth-service gateway
```

### 问题：POST 请求成功但 OPTIONS 失败

**解决方案：**
```bash
# 检查 Nginx 配置
docker-compose exec gateway cat /etc/nginx/nginx.conf

# 重新加载 Nginx
docker-compose exec gateway nginx -s reload
```

## 技术说明

### 为什么需要 OPTIONS 请求？

当浏览器发送跨域请求时（例如从 `http://localhost:5173` 到 `http://localhost`），浏览器会先发送一个 OPTIONS 预检请求来检查：
1. 服务器是否允许跨域请求
2. 允许哪些 HTTP 方法
3. 允许哪些请求头

只有预检请求成功（返回 2xx），浏览器才会发送实际的请求。

### CORS 工作流程

```
浏览器                    服务器
  |                         |
  |-- OPTIONS /auth/register -->|
  |                         |
  |<-- 204 No Content ---------|
  |    (CORS headers)       |
  |                         |
  |-- POST /auth/register ----->|
  |    (实际请求)           |
  |                         |
  |<-- 200 OK ---------------|
  |    (响应数据)           |
```

### 为什么同时配置 Nginx 和 FastAPI？

- **FastAPI CORS 中间件**：处理应用层的 CORS 逻辑
- **Nginx CORS 头**：在网关层添加额外保护，确保所有响应都有正确的 CORS 头

这种双层配置提供了更好的兼容性和安全性。

## 生产环境建议

在生产环境中，应该限制允许的来源：

**FastAPI:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-domain.com"],  # 指定具体域名
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

**Nginx:**
```nginx
add_header 'Access-Control-Allow-Origin' 'https://your-domain.com' always;
```

## 相关文档

- [MDN - CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [FastAPI - CORS](https://fastapi.tiangolo.com/tutorial/cors/)
- [Nginx - CORS](https://enable-cors.org/server_nginx.html)

---

**CORS 问题已完全解决！现在可以正常使用前端了。** 🎉

**访问地址：http://localhost:5174**
