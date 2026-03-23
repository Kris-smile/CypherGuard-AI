# CypherGuard AI 验证与测试脚本

## 概述

| 脚本 | 用途 | 依赖 |
|------|------|------|
| `verify_m13_m16.py` | **M13 图片持久化** + **M16 Vision 格式** 立即验证 | 服务已启动、默认用户存在 |
| `e2e_all_modules.py` | **18 个模块** 端到端测试 | 服务已启动、默认用户与模型 |
| `load_test.py` | **性能压测**：大规模文档上传 + 并发对话 | 服务已启动 |
| `security_audit.py` | **安全审计**：API Key 加密、CORS、敏感默认值 | 仅代码/配置，无需启动服务 |
| `deploy_check.py` | **生产环境配置检查**：JWT/API Key/DB/MinIO 等 | 仅读 `.env`，无需启动服务 |

---

## 1. M13/M16 立即验证

```bash
# 在项目根目录执行
python scripts/verify_m13_m16.py --base-url http://localhost

# 仅验证 M13（图片持久化）
python scripts/verify_m13_m16.py --skip-m16
```

- **M13**：发送带图消息 → 重载消息列表 → 检查 `images_json` 存在且非空。
- **M16**：发送带图消息并请求回复，验证 Vision 格式链路（2xx 即通过）。

---

## 2. 18 模块端到端测试

```bash
python scripts/e2e_all_modules.py --base-url http://localhost

# 仅跑指定模块
python scripts/e2e_all_modules.py --modules M1,M2,M13,M16
```

模块与检查要点：

- **M1** 文档解析：KB 服务正常
- **M2** 混合检索：创建对话并发送消息
- **M3** 流式 SSE：调用 stream 端点
- **M4** 多轮上下文：同一对话多发几条消息
- **M5** FAQ：FAQ API
- **M6** Web 搜索：模式配置
- **M7** 摘要与标签：文档/标签 API
- **M8** Chunk：文档 chunks API
- **M9** Agent：Agent 消息端点
- **M10** 前端/网关：网关健康
- **M11** 安全：Refresh Token 存在
- **M12** 网安实体：KB 正常
- **M13** 图片持久化：调用 `verify_m13_m16.py --skip-m16`
- **M14** 模型选择：Chat 模型列表
- **M15/M17/M18**：占位/跳过

---

## 3. 性能压测

```bash
# 默认：10 文档上传 + 5 并发对话、每对话 2 条消息
python scripts/load_test.py

# 自定义
python scripts/load_test.py --docs 20 --concurrent-convs 10 --messages-per-conv 3

# 仅上传
python scripts/load_test.py --upload-only

# 仅并发对话
python scripts/load_test.py --chat-only
```

---

## 4. 安全审计

```bash
python scripts/security_audit.py
```

检查项：

- API Key：Fernet 加密、model-gateway/model-config 解密使用
- CORS：各服务 `allow_origins`，生产建议限制域名
- 敏感默认值：JWT_SECRET、API_KEY_ENCRYPTION_SECRET
- Nginx 安全头、SSRF/URL 拉取配置

---

## 5. 部署准备检查

```bash
python scripts/deploy_check.py
```

检查 `.env` 中：

- `JWT_SECRET` 非默认
- `API_KEY_ENCRYPTION_SECRET` 非默认
- `POSTGRES_PASSWORD` 非默认
- `REDIS_URL` 已配置（生产建议非 localhost）
- MinIO 凭证非默认

---

## 建议执行顺序

1. **不依赖服务**：`security_audit.py`、`deploy_check.py`
2. **启动服务后**：`verify_m13_m16.py` → `e2e_all_modules.py` → `load_test.py`

运行 E2E 前请确保：

- `docker compose up` 或等效方式已启动所有服务
- 已存在默认用户（如 `admin@cypherguard.local` / `admin123`）
- 已配置至少一个 Chat 模型（否则部分模块可能超时或跳过）
