# CypherGuard AI - 部署检查清单

## 📋 部署前检查

### 环境准备
- [ ] Docker Desktop 已安装并运行
- [ ] 系统内存 >= 8GB
- [ ] 可用磁盘空间 >= 20GB
- [ ] 端口 80, 5173, 5432, 6379, 9000, 6333 未被占用

### 配置文件
- [ ] `.env` 文件已创建（可从 `.env.example` 复制）
- [ ] `frontend/.env` 文件已创建
- [ ] JWT_SECRET 已设置（生产环境必须修改）
- [ ] 数据库密码已设置（生产环境必须修改）
- [ ] MinIO 密钥已设置（生产环境必须修改）

### 代码检查
- [ ] 前端代码编译通过 (`cd frontend && npm run build`)
- [ ] 无 TypeScript 错误
- [ ] 无 ESLint 警告
- [ ] Docker Compose 配置正确

## 🚀 部署步骤

### 1. 克隆代码
```bash
git clone <repository-url>
cd cypherguard-ai
```

### 2. 配置环境变量
```bash
# 复制环境变量模板
cp .env.example .env
cp frontend/.env.example frontend/.env

# 编辑环境变量（生产环境必须修改密钥）
# Windows: notepad .env
# Linux/Mac: nano .env
```

### 3. 启动服务
```bash
# Windows
start_frontend.bat

# Linux/Mac
chmod +x start_frontend.sh
./start_frontend.sh

# 或手动启动
docker-compose up -d
```

### 4. 等待服务就绪
```bash
# 等待 30-60 秒
# 检查服务状态
docker-compose ps

# 所有服务应该显示 "Up" 或 "healthy"
```

### 5. 验证部署
```bash
# 运行集成测试
chmod +x test_frontend_backend.sh
./test_frontend_backend.sh

# 或手动验证
# 访问 http://localhost
# 注册账号并测试功能
```

## ✅ 部署后验证

### 服务健康检查
- [ ] Gateway: `curl http://localhost/healthz`
- [ ] Frontend: 访问 `http://localhost`
- [ ] Auth Service: `curl http://localhost/auth/me` (应返回 401)
- [ ] KB Service: `curl http://localhost/kb/documents` (应返回 401)
- [ ] Chat Service: `curl http://localhost/chat/modes`

### 功能测试
- [ ] 用户注册成功
- [ ] 用户登录成功
- [ ] 文档上传成功
- [ ] 文档状态更新正常
- [ ] AI 对话功能正常
- [ ] 引用显示正常

### 性能检查
- [ ] 首屏加载时间 < 3s
- [ ] API 响应时间 < 2s
- [ ] 文档上传速度正常
- [ ] 对话响应速度正常

### 日志检查
```bash
# 检查是否有错误日志
docker-compose logs --tail=100 | grep -i error
docker-compose logs --tail=100 | grep -i exception
docker-compose logs --tail=100 | grep -i failed
```

## 🔧 常见问题处理

### 问题 1: 端口被占用
```bash
# Windows
netstat -ano | findstr :80
netstat -ano | findstr :5173

# Linux/Mac
lsof -i :80
lsof -i :5173

# 解决方案：
# 1. 停止占用端口的程序
# 2. 或修改 docker-compose.yml 中的端口映射
```

### 问题 2: 服务启动失败
```bash
# 查看失败服务的日志
docker-compose logs <service-name>

# 常见原因：
# - 端口冲突
# - 内存不足
# - 配置错误
# - 依赖服务未就绪

# 解决方案：
docker-compose down
docker-compose up -d
```

### 问题 3: 前端无法访问
```bash
# 检查 gateway 和 frontend 服务
docker-compose logs gateway
docker-compose logs frontend

# 重启服务
docker-compose restart gateway frontend

# 检查 nginx 配置
docker-compose exec gateway cat /etc/nginx/nginx.conf
```

### 问题 4: 数据库连接失败
```bash
# 检查 PostgreSQL 服务
docker-compose logs postgres

# 重启数据库
docker-compose restart postgres

# 等待数据库就绪
docker-compose exec postgres pg_isready -U postgres
```

### 问题 5: MinIO 无法访问
```bash
# 检查 MinIO 服务
docker-compose logs minio

# 重启 MinIO
docker-compose restart minio

# 访问 MinIO 控制台
# http://localhost:9001
# 用户名: minioadmin
# 密码: minioadmin
```

## 🔒 生产环境配置

### 必须修改的配置

1. **JWT Secret**
```env
JWT_SECRET=<生成一个强随机字符串>
```

2. **数据库密码**
```env
POSTGRES_PASSWORD=<强密码>
```

3. **MinIO 密钥**
```env
MINIO_ROOT_USER=<自定义用户名>
MINIO_ROOT_PASSWORD=<强密码>
```

4. **CORS 配置**
```nginx
# gateway/nginx.conf
# 修改为实际的前端域名
add_header 'Access-Control-Allow-Origin' 'https://your-domain.com' always;
```

### 推荐的安全配置

1. **启用 HTTPS**
   - 配置 SSL 证书
   - 强制 HTTPS 重定向
   - 启用 HSTS

2. **数据库安全**
   - 不暴露数据库端口到公网
   - 使用强密码
   - 定期备份

3. **API 限流**
   - 配置 Nginx 限流
   - 设置请求频率限制
   - 防止 DDoS 攻击

4. **日志管理**
   - 配置日志轮转
   - 敏感信息脱敏
   - 集中日志收集

## 📊 监控和维护

### 日常监控
```bash
# 检查服务状态
docker-compose ps

# 查看资源使用
docker stats

# 查看日志
docker-compose logs -f --tail=100
```

### 定期维护
- [ ] 每周检查日志
- [ ] 每月备份数据库
- [ ] 每月更新依赖
- [ ] 每季度安全审计

### 备份策略
```bash
# 备份数据库
docker-compose exec postgres pg_dump -U postgres cypherguard > backup.sql

# 备份 MinIO 数据
docker-compose exec minio mc mirror /data /backup

# 备份 Qdrant 数据
docker cp cypherguard-qdrant:/qdrant/storage ./qdrant-backup
```

### 恢复策略
```bash
# 恢复数据库
docker-compose exec -T postgres psql -U postgres cypherguard < backup.sql

# 恢复 MinIO 数据
docker-compose exec minio mc mirror /backup /data

# 恢复 Qdrant 数据
docker cp ./qdrant-backup cypherguard-qdrant:/qdrant/storage
docker-compose restart qdrant
```

## 🔄 更新和升级

### 更新代码
```bash
# 拉取最新代码
git pull origin main

# 重新构建镜像
docker-compose build

# 重启服务
docker-compose down
docker-compose up -d
```

### 数据库迁移
```bash
# 备份数据库
docker-compose exec postgres pg_dump -U postgres cypherguard > backup.sql

# 运行迁移脚本
docker-compose exec postgres psql -U postgres cypherguard < migration.sql

# 验证迁移
docker-compose exec postgres psql -U postgres cypherguard -c "\dt"
```

## 📈 性能优化

### 前端优化
- [ ] 启用 Gzip 压缩
- [ ] 配置 CDN
- [ ] 启用浏览器缓存
- [ ] 图片懒加载

### 后端优化
- [ ] 配置数据库连接池
- [ ] 启用 Redis 缓存
- [ ] 优化 SQL 查询
- [ ] 配置 Celery 并发数

### 基础设施优化
- [ ] 增加服务器资源
- [ ] 配置负载均衡
- [ ] 启用 CDN
- [ ] 优化网络配置

## 🎯 部署清单总结

### 开发环境
- [x] Docker Compose 一键启动
- [x] 热重载支持
- [x] 详细日志输出
- [x] 开发工具集成

### 测试环境
- [ ] 独立的测试数据库
- [ ] 自动化测试脚本
- [ ] 性能测试工具
- [ ] 日志收集系统

### 生产环境
- [ ] HTTPS 配置
- [ ] 强密码和密钥
- [ ] 数据备份策略
- [ ] 监控和告警
- [ ] 负载均衡
- [ ] CDN 配置
- [ ] 日志管理
- [ ] 安全审计

## 📞 支持和帮助

### 获取帮助
- 📖 查看文档: `docs/`
- 🐛 报告问题: GitHub Issues
- 💬 社区讨论: Discussions
- 📧 邮件支持: support@cypherguard.ai

### 紧急联系
- 🚨 生产环境问题: emergency@cypherguard.ai
- 📞 技术支持热线: +86-xxx-xxxx-xxxx

---

**部署成功后，请访问 http://localhost 开始使用！** 🎉
