# Phase 7.3 修复状态

## 问题总结

### 1. Nginx 路由问题 ✅ 已修复
**问题：** nginx.conf 中 `/models/` 路由被定义了两次，第一个指向错误的服务
**修复：** 删除重复的路由定义，只保留指向 `model_config_service` 的路由

### 2. Ollama Base URL 问题 ✅ 已修复
**问题：** 默认 Base URL 使用 `http://localhost:11434`，但 Docker 容器内无法访问宿主机的 localhost
**修复：** 改为 `http://host.docker.internal:11434`（Docker Desktop 特殊域名，指向宿主机）

### 3. httpx 依赖缺失 ⚠️ 待解决
**问题：** `services/model-config-service` 需要 httpx 库来测试 Ollama 连接，但容器中未安装
**状态：** 已添加到 requirements.txt，但由于网络问题无法安装
**影响：** 测试连接功能可能无法正常工作（会抛出 ImportError）

### 4. Frontend/Gateway 服务未运行 ⚠️ 待解决
**问题：** frontend 和 gateway 容器未运行
**原因：** 网络问题导致无法构建镜像
**影响：** 无法通过浏览器测试新功能

## 已完成的代码更改

### 1. gateway/nginx.conf
```nginx
# 修复前：重复定义，第一个指向 auth_service
location /models/ {
    proxy_pass http://auth_service/models/;  # 错误！
}
location /models/ {
    proxy_pass http://model_config_service/models/;
}

# 修复后：只保留正确的定义
location /models/ {
    proxy_pass http://model_config_service/models/;  # 正确！
}
```

### 2. frontend/src/pages/Settings.tsx
```typescript
// 修复前
base_url: 'http://localhost:11434'

// 修复后
base_url: 'http://host.docker.internal:11434'
```

### 3. services/model-config-service/requirements.txt
```
# 添加
httpx==0.27.0
```

## 测试状态

### 后端 API 端点
- ✅ 端点已定义：`POST /models/test-ollama-connection`
- ✅ 代码逻辑正确
- ⚠️ httpx 未安装，运行时会报错
- ❌ 无法测试（网络问题）

### 前端 UI
- ✅ 代码已更新
- ✅ Ollama 特殊处理逻辑完整
- ❌ 无法测试（frontend 容器未运行）

## 下一步操作

### 方案 A：等待网络恢复
1. 等待网络连接恢复
2. 安装 httpx：`docker exec cypherguard-model-config pip install httpx==0.27.0`
3. 重启服务：`docker-compose restart model-config-service`
4. 启动 frontend 和 gateway：`docker-compose up -d frontend gateway`
5. 测试功能

### 方案 B：手动安装 httpx（离线）
1. 在本地下载 httpx 及其依赖的 wheel 文件
2. 复制到容器：`docker cp httpx-*.whl cypherguard-model-config:/tmp/`
3. 安装：`docker exec cypherguard-model-config pip install /tmp/httpx-*.whl`
4. 重启服务

### 方案 C：重新构建镜像（需要网络）
1. 等待网络恢复
2. 重新构建：`docker-compose build model-config-service`
3. 重启服务：`docker-compose up -d model-config-service`

## 验证步骤

### 1. 验证 httpx 已安装
```bash
docker exec cypherguard-model-config python3 -c "import httpx; print(httpx.__version__)"
```

### 2. 验证端点可访问
```bash
# 从容器内测试
docker exec cypherguard-model-config python3 -c "
import httpx
r = httpx.post('http://localhost:8000/models/test-ollama-connection', 
               json={'base_url': 'http://host.docker.internal:11434', 'model_type': 'chat'})
print(r.status_code, r.text)
"
```

### 3. 验证前端功能
1. 访问 http://localhost:5173
2. 进入 Settings → 模型管理
3. 点击"添加模型"
4. 选择提供商：Ollama
5. 验证：
   - API Key 字段已隐藏 ✓
   - Base URL 自动填充为 `http://host.docker.internal:11434` ✓
   - 显示"测试连接"按钮 ✓
6. 点击"测试连接"
7. 验证结果显示

## 代码提交状态

- ✅ 所有代码更改已提交到 Git
- ✅ Commit ID: `fd95674`
- ✅ 文档已创建：`PHASE7.3_OLLAMA_IMPROVEMENTS.md`

## 临时解决方案

如果无法安装 httpx，可以修改代码使用标准库：

```python
# 在 services/model-config-service/app/main.py 中
# 将 httpx 替换为 urllib

import urllib.request
import json

@app.post("/models/test-ollama-connection")
async def test_ollama_connection(request: dict):
    """Test Ollama connection and return available models"""
    base_url = request.get("base_url", "http://host.docker.internal:11434")
    model_type = request.get("model_type", "chat")
    
    try:
        # 使用 urllib 替代 httpx
        req = urllib.request.Request(
            f"{base_url}/api/tags",
            headers={'Content-Type': 'application/json'}
        )
        
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            
        # ... 其余逻辑相同
        
    except urllib.error.URLError as e:
        raise HTTPException(
            status_code=503,
            detail=f"无法连接到 Ollama 服务 ({base_url})，请确保 Ollama 正在运行"
        )
```

## 总结

Phase 7.3 的代码更改已完成并提交，主要问题是：
1. ✅ Nginx 路由已修复
2. ✅ Ollama Base URL 已修复
3. ⚠️ httpx 依赖需要安装（网络问题）
4. ⚠️ Frontend/Gateway 需要启动（网络问题）

一旦网络恢复，按照"下一步操作"中的步骤即可完成部署和测试。
