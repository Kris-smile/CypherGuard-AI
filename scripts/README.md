# 验证脚本使用指南

本目录包含用于系统验证、测试和维护的实用脚本。

## 📋 脚本列表

### 1. 快速验证向导（推荐）

**Windows PowerShell:**
```powershell
.\scripts\verify.ps1
```

这是一个交互式向导，提供以下功能：
- 快速健康检查
- 验证图片持久化
- 生成测试文档
- 批量上传文档
- 查看服务日志
- 重启服务
- 数据库管理

---

### 2. 系统健康检查

**功能**: 检查所有服务和基础设施的运行状态

```bash
python scripts/health_check.py
```

**检查项目**:
- PostgreSQL、Redis、Qdrant、MinIO 连接
- 所有微服务健康状态
- 用户认证功能
- 模型配置状态

**输出示例**:
```
✅ PostgreSQL          正常
✅ Redis               正常
✅ Qdrant              正常 (2 个集合)
✅ MinIO               正常
✅ Gateway             正常
✅ Frontend            正常
...
```

---

### 3. 图片持久化测试

**功能**: 验证 M13 模块（对话图片持久化）是否正常工作

```bash
python scripts/test_image_persistence.py
```

**可选参数**:
```bash
# 自定义 API 地址
python scripts/test_image_persistence.py --base-url http://localhost

# 自定义用户名密码
python scripts/test_image_persistence.py --username admin@cypherguard.local --password admin123

# 仅检查数据库
python scripts/test_image_persistence.py --db-only
```

**测试流程**:
1. 登录系统
2. 创建对话
3. 发送带图片的消息
4. 重新加载消息（模拟刷新页面）
5. 验证图片是否仍然存在
6. 检查数据库 `images_json` 字段

---

### 4. 生成测试文档

**功能**: 生成包含网络安全内容的测试文档，用于性能测试

```bash
# 生成 10 个文档（默认）
python scripts/generate_test_docs.py

# 生成 100 个文档
python scripts/generate_test_docs.py --count 100

# 指定输出目录
python scripts/generate_test_docs.py --count 50 --output my_test_data
```

**生成的文档包含**:
- 网络安全主题（SQL注入、XSS、CSRF等）
- CVE 编号
- IP 地址
- 域名
- 代码示例
- 防御措施

---

### 5. 批量上传文档

**功能**: 批量上传文档到知识库，可选自动触发学习

```bash
# 基本用法（需要知识库 ID）
python scripts/bulk_upload.py --dir test_data --kb-id <your_kb_id>

# 自动触发学习
python scripts/bulk_upload.py --dir test_data --kb-id <your_kb_id> --auto-learn

# 自定义 API 地址和用户
python scripts/bulk_upload.py \
  --dir test_data \
  --kb-id <your_kb_id> \
  --base-url http://localhost \
  --username admin@cypherguard.local \
  --password admin123 \
  --auto-learn
```

**如何获取知识库 ID**:
1. 登录系统
2. 进入 Knowledge Core 页面
3. 创建或选择一个知识库
4. 从 URL 或浏览器开发者工具中获取 ID

---

## 🚀 快速开始

### 第一次验证（推荐流程）

1. **启动系统**
   ```powershell
   docker compose up -d
   ```

2. **运行健康检查**
   ```powershell
   python scripts/health_check.py
   ```

3. **验证图片持久化**
   ```powershell
   python scripts/test_image_persistence.py
   ```

4. **生成测试数据**
   ```powershell
   python scripts/generate_test_docs.py --count 20
   ```

5. **上传测试文档**
   ```powershell
   # 先在浏览器中创建知识库，获取 ID
   python scripts/bulk_upload.py --dir test_data --kb-id <your_kb_id> --auto-learn
   ```

---

## 📊 性能测试

### 大规模文档测试

```bash
# 1. 生成 100 个测试文档
python scripts/generate_test_docs.py --count 100

# 2. 批量上传并自动学习
python scripts/bulk_upload.py --dir test_data --kb-id <your_kb_id> --auto-learn

# 3. 监控 Worker 处理进度
docker compose logs -f worker

# 4. 监控系统资源
docker stats
```

### 并发对话测试

使用 Locust 进行压力测试（需要先安装）:

```bash
# 安装 Locust
pip install locust

# 创建压测脚本（参考 docs/verification-guide.md）
# 运行压测
locust -f scripts/load_test.py --host=http://localhost
```

---

## 🔧 故障排查

### 脚本执行失败

**问题**: `ModuleNotFoundError: No module named 'requests'`

**解决**:
```bash
pip install requests psycopg2-binary redis
```

---

### 健康检查失败

**问题**: 某个服务显示 ❌ 连接失败

**解决**:
```bash
# 1. 检查容器状态
docker compose ps

# 2. 查看服务日志
docker compose logs -f <service-name>

# 3. 重启服务
docker compose restart <service-name>
```

---

### 图片持久化测试失败

**问题**: `❌ images_json 列不存在`

**解决**:
```bash
# 运行数据库迁移
docker exec -it cypherguard-postgres psql -U postgres -d cypherguard -c "ALTER TABLE messages ADD COLUMN IF NOT EXISTS images_json JSONB;"
```

---

### 批量上传失败

**问题**: `❌ 登录失败: 401`

**解决**:
1. 确认用户名密码正确
2. 检查 auth-service 是否正常运行
3. 使用 `--username` 和 `--password` 参数指定正确的凭据

---

## 📚 更多信息

- 完整验证指南: [docs/verification-guide.md](../docs/verification-guide.md)
- API 文档: [docs/api.md](../docs/api.md)
- 项目架构: [docs/architecture.md](../docs/architecture.md)

---

## 💡 提示

1. **首次运行**: 先执行健康检查，确保所有服务正常
2. **性能测试**: 从小规模开始（10-20个文档），逐步增加
3. **日志查看**: 遇到问题时，优先查看服务日志
4. **数据备份**: 性能测试前建议备份数据库

---

**祝验证顺利！** 🎉
