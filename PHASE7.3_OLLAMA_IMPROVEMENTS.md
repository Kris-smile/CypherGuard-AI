# Phase 7.3: Ollama 集成改进

## 概述
改进了 Ollama 本地模型的配置体验，添加了连通性测试和自动模型检测功能。

## 实施日期
2026-01-30

## 改进内容

### 1. 前端改进 (`frontend/src/pages/Settings.tsx`)

#### 1.1 智能表单显示
- **Ollama 提供商特殊处理**
  - 选择 Ollama 时自动隐藏 API Key 输入框
  - 自动填充默认 Base URL: `http://localhost:11434`
  - Base URL 字段变为必填项

#### 1.2 连通性测试功能
- **测试连接按钮**
  - 位于 Base URL 输入框旁边
  - 点击后测试 Ollama 服务连通性
  - 显示加载状态（"测试中..."）
  - 显示测试结果（成功/失败）

- **测试结果显示**
  - 成功：绿色提示框，显示发现的模型数量和名称
  - 失败：红色提示框，显示错误信息
  - 自动检测可用模型列表

#### 1.3 自动模型检测
- **模型下拉列表**
  - 测试连接成功后，模型名称字段变为下拉选择
  - 自动填充检测到的本地模型
  - 根据模型类型过滤（Embedding/Chat）
  - 自动选择第一个模型（如果未选择）

- **智能过滤**
  - Embedding 模型：包含 "embed" 关键词的模型
  - Chat 模型：不包含 "embed" 关键词的模型
  - Rerank 模型：Ollama 不支持，返回空列表

#### 1.4 用户提示优化
- **Ollama 专属提示**
  - 绿色提示框（区别于其他提供商的蓝色）
  - 提示内容：
    - Ollama 是本地运行的模型，无需 API Key
    - 确保 Ollama 服务正在运行
    - 点击"测试连接"自动检测可用模型
    - Embedding 模型通常包含 "embed" 关键词

- **模型名称字段提示**
  - 未测试连接时：显示黄色提示"点击'测试连接'自动检测可用模型"
  - 测试成功后：显示下拉列表供选择

### 2. 后端改进 (`services/model-config-service/app/main.py`)

#### 2.1 新增 API 端点

**POST /models/test-ollama-connection**

测试 Ollama 连接并返回可用模型列表。

**请求参数：**
```json
{
  "base_url": "http://localhost:11434",
  "model_type": "chat"  // 或 "embedding" 或 "rerank"
}
```

**成功响应：**
```json
{
  "success": true,
  "message": "成功连接到 Ollama，发现 3 个chat模型",
  "models": [
    {
      "name": "llama3.2:latest",
      "size": 2000000000,
      "modified_at": "2026-01-30T10:00:00Z"
    },
    {
      "name": "qwen2.5:latest",
      "size": 1500000000,
      "modified_at": "2026-01-30T09:00:00Z"
    }
  ],
  "base_url": "http://localhost:11434"
}
```

**错误响应：**
```json
{
  "detail": "无法连接到 Ollama 服务 (http://localhost:11434)，请确保 Ollama 正在运行"
}
```

#### 2.2 错误处理

- **ConnectError (503)**
  - 无法连接到 Ollama 服务
  - 提示用户检查 Ollama 是否运行

- **TimeoutException (504)**
  - 连接超时
  - 提示用户检查网络或服务状态

- **其他错误 (500)**
  - 通用错误处理
  - 返回详细错误信息

#### 2.3 模型过滤逻辑

```python
# Embedding 模型：名称包含 "embed"
if model_type == "embedding":
    if "embed" in model_name.lower():
        filtered_models.append(model)

# Chat 模型：名称不包含 "embed"
elif model_type == "chat":
    if "embed" not in model_name.lower():
        filtered_models.append(model)

# Rerank 模型：Ollama 不支持，返回空
elif model_type == "rerank":
    pass
```

### 3. API 服务改进 (`frontend/src/services/api.ts`)

#### 3.1 新增方法

```typescript
testOllamaConnection: async (baseUrl: string, modelType: string): Promise<{
  success: boolean;
  message: string;
  models: Array<{ name: string; size: number; modified_at: string }>;
  base_url: string;
}> => {
  const response = await apiClient.post('/models/test-ollama-connection', {
    base_url: baseUrl,
    model_type: modelType,
  });
  return response.data;
}
```

### 4. 依赖更新

#### 4.1 后端依赖
- 添加 `httpx==0.27.0` 到 `services/model-config-service/requirements.txt`
- 用于异步 HTTP 请求（测试 Ollama 连接）

## 使用流程

### 用户操作流程

1. **打开 Settings 页面**
   - 点击左侧导航栏的"系统设置"
   - 选择"模型管理"标签

2. **添加 Ollama 模型**
   - 点击"添加模型"按钮
   - 填写配置名称（如"Llama 3.2 本地"）
   - 选择模型类型（Embedding 或 Chat）
   - 选择提供商：**Ollama**

3. **配置 Base URL**
   - 自动填充 `http://localhost:11434`
   - 如果 Ollama 运行在其他地址，修改此字段

4. **测试连接**
   - 点击"测试连接"按钮
   - 等待测试结果
   - 成功：显示发现的模型列表
   - 失败：显示错误信息

5. **选择模型**
   - 从下拉列表中选择模型
   - 或手动输入模型名称

6. **保存配置**
   - 调整并发数和速率限制（可选）
   - 点击"保存配置"

### 技术流程

```
用户点击"测试连接"
    ↓
前端调用 settingsAPI.testOllamaConnection()
    ↓
发送 POST /models/test-ollama-connection
    ↓
后端调用 Ollama API: GET /api/tags
    ↓
获取所有模型列表
    ↓
根据 model_type 过滤模型
    ↓
返回过滤后的模型列表
    ↓
前端更新 availableModels 状态
    ↓
模型名称字段变为下拉选择
    ↓
用户选择模型并保存
```

## 测试

### 测试脚本
- `test_ollama_integration.sh` - 测试 Ollama 集成功能

### 测试场景

#### 场景 1：Ollama 正在运行
```bash
# 启动 Ollama
ollama serve

# 拉取模型
ollama pull llama3.2
ollama pull nomic-embed-text

# 测试连接
# 应该成功并返回模型列表
```

#### 场景 2：Ollama 未运行
```bash
# 测试连接
# 应该返回 503 错误：无法连接到 Ollama 服务
```

#### 场景 3：无效的 Base URL
```bash
# 使用错误的 URL 测试
# 应该返回 503 错误：无法连接到 Ollama 服务
```

#### 场景 4：模型类型过滤
```bash
# 测试 Embedding 模型
# 应该只返回包含 "embed" 的模型

# 测试 Chat 模型
# 应该只返回不包含 "embed" 的模型
```

## UI 截图说明

### 1. 选择 Ollama 提供商
- API Key 字段自动隐藏
- Base URL 字段显示默认值
- 显示"测试连接"按钮

### 2. 测试连接中
- 按钮显示"测试中..."
- 加载动画

### 3. 测试成功
- 绿色提示框
- 显示发现的模型数量
- 模型名称变为下拉选择

### 4. 测试失败
- 红色提示框
- 显示错误信息
- 模型名称保持文本输入

## 支持的 Ollama 模型

### Embedding 模型
- `nomic-embed-text` - 768 维，英文
- `mxbai-embed-large` - 1024 维，多语言
- 其他包含 "embed" 的模型

### Chat 模型
- `llama3.2` - 3B, 1B 参数
- `qwen2.5` - 0.5B-72B 参数
- `mistral` - 7B 参数
- `gemma2` - 2B-27B 参数
- 其他不包含 "embed" 的模型

## 已知限制

1. **Rerank 模型**
   - Ollama 不支持 Rerank 模型
   - 选择 Rerank 类型时，测试连接会返回空列表

2. **模型名称格式**
   - Ollama 模型名称通常包含标签（如 `llama3.2:latest`）
   - 需要完整名称才能使用

3. **网络连接**
   - 需要能够访问 Ollama 服务地址
   - 默认 `localhost:11434` 仅适用于本地部署

## 下一步改进

### Phase 7.4 计划
1. **模型信息展示**
   - 显示模型大小
   - 显示模型修改时间
   - 显示模型参数数量

2. **模型测试功能**
   - 测试 Embedding 生成
   - 测试 Chat 完成
   - 显示测试结果和延迟

3. **批量操作**
   - 批量导入 Ollama 模型
   - 一键添加所有检测到的模型

4. **模型管理**
   - 从 UI 拉取新模型
   - 删除不需要的模型
   - 更新模型版本

## 文件变更

### 修改的文件
- `frontend/src/pages/Settings.tsx` - 添加 Ollama 特殊处理
- `frontend/src/services/api.ts` - 添加测试连接 API
- `services/model-config-service/app/main.py` - 添加测试端点
- `services/model-config-service/requirements.txt` - 添加 httpx

### 新增的文件
- `test_ollama_integration.sh` - 测试脚本
- `PHASE7.3_OLLAMA_IMPROVEMENTS.md` - 本文档

## 部署说明

### 1. 更新后端服务
```bash
# 复制更新的代码
docker cp services/model-config-service/app/main.py cypherguard-model-config:/app/app/main.py

# 安装 httpx（如果网络可用）
docker exec cypherguard-model-config pip install httpx==0.27.0

# 重启服务
docker-compose restart model-config-service
```

### 2. 更新前端
```bash
# 前端代码会自动热重载（开发模式）
# 或重启前端容器
docker-compose restart frontend
```

### 3. 验证部署
```bash
# 测试后端 API
bash test_ollama_integration.sh

# 访问前端
# http://localhost -> Settings -> 模型管理 -> 添加模型 -> 选择 Ollama
```

## 总结

Phase 7.3 成功改进了 Ollama 本地模型的配置体验：

✅ **用户体验改进**
- 选择 Ollama 时自动隐藏不需要的字段
- 一键测试连接和检测模型
- 下拉选择模型，避免手动输入错误

✅ **技术实现**
- 新增 Ollama 连接测试 API
- 智能模型过滤逻辑
- 完善的错误处理

✅ **文档和测试**
- 完整的测试脚本
- 详细的使用说明
- 清晰的技术文档

系统现在对 Ollama 本地模型提供了更好的支持，用户可以轻松配置和使用本地 AI 模型！
