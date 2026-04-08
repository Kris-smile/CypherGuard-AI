# 第3–7章制图与 Mermaid 模板

## 通用约定

- 图中服务名与 `docker-compose.yml` 的 `services` 键一致（如 `kb-service`）。
- 数据库写 `PostgreSQL`，向量库写 `Qdrant`，对象存储写 `MinIO`，队列写 `Redis + Celery worker`。
- 用户角色仅 `admin`、`user`（与 `users.role` CHECK 一致）。

## 3.1 业务流程图（Mermaid flowchart 示例骨架）

```mermaid
flowchart TB
  subgraph User["用户浏览器"]
    U[操作]
  end
  subgraph GW["gateway"]
    G[Nginx 路由]
  end
  U --> G
```

按真实流程补全：`frontend` → `gateway` → `auth-service` / `kb-service` / `chat-service`；异步分支到 `worker` → `minio` / `postgres` / `qdrant`。

## 3.2 用例图

Word 中常用 **UML 用例图**；Mermaid 的 `graph` 可简化为「角色—用例」二分图：

```mermaid
flowchart LR
  actor_user((user))
  actor_admin((admin))
  UC_login[登录注册]
  UC_kb[管理知识库与文档]
  UC_chat[对话与引用]
  UC_model[模型配置]
  actor_user --- UC_login
  actor_user --- UC_kb
  actor_user --- UC_chat
  actor_admin --- UC_model
```

具体用例名与页面/接口对齐（来自 `frontend/src/pages` 与 `api.ts`）。

## 4.1 部署架构图

```mermaid
flowchart TB
  Client[浏览器] --> Gateway[gateway :80]
  Gateway --> FE[frontend]
  Gateway --> AUTH[auth-service]
  Gateway --> KB[kb-service]
  Gateway --> CHAT[chat-service]
  Gateway --> MG[model-gateway]
  Gateway --> MC[model-config-service]
  KB --> PG[(postgres)]
  CHAT --> PG
  AUTH --> PG
  MC --> PG
  KB --> MINIO[(minio)]
  KB --> REDIS[(redis)]
  CHAT --> REDIS
  WORKER[worker] --> REDIS
  WORKER --> PG
  WORKER --> MINIO
  WORKER --> QD[(qdrant)]
  CHAT --> QD
```

端口以论文中**实际映射**为准（如 Postgres `5433:5432`）。

## 4.3 时序图模板

### 文档摄取（逻辑）

```mermaid
sequenceDiagram
  participant U as 用户
  participant FE as 前端
  participant KB as kb-service
  participant R as Redis/Celery
  participant W as worker
  participant M as MinIO
  participant P as PostgreSQL
  participant Q as Qdrant
  U->>FE: 上传文档
  FE->>KB: API
  KB->>P: 元数据/任务
  KB->>M: 对象存储
  KB->>R: 投递任务
  W->>R: 领取任务
  W->>M: 取文件
  W->>P: 更新 chunks/tasks
  W->>Q: 写入向量
```

### 问答与引用（逻辑）

```mermaid
sequenceDiagram
  participant U as 用户
  participant FE as 前端
  participant CH as chat-service
  participant Q as Qdrant
  participant MG as model-gateway
  U->>FE: 提问
  FE->>CH: 会话 API
  CH->>Q: 检索 Top-K
  CH->>MG: LLM 生成
  MG-->>CH: 回复
  CH-->>FE: 内容+citations_json
```

细节需对照 `services/chat-service/app/main.py` 中实际调用顺序（是否 rerank、是否 hybrid）。

## 4.4 E-R 图注意

- `documents.knowledge_base_id` 与 `knowledge_bases` 多对一；`chunks` 与 `documents` 多对一。
- `conversations` 依赖 `modes`；`messages` 依赖 `conversations`。
- `ingestion_tasks` 与 `documents` 多对一。
- `faq_entries` 可选挂 `knowledge_bases`。
- `entities` 关联 `documents` / `chunks`（网络安全实体抽取扩展）。

ER 图在 Mermaid 中可用 `erDiagram`（字段多时可只画实体与关系，字段放表 4.4.2）。

## 6 章测试表（Markdown 粘贴 Word 前可用）

| 用例编号 | 模块 | 前置条件 | 步骤 | 预期结果 | 实际结果 | 结论 |
|----------|------|----------|------|----------|----------|------|
| TC-001 | 认证 | … | … | … | … | 通过 |

## 安全测试示例行（勿照抄，按实测填）

| 编号 | 项 | 方法 | 预期 |
|------|-----|------|------|
| SEC-001 | 未带 Token 访问受保护 API | curl 无 Authorization | 401 |
| SEC-002 | SQL 注入 | 在搜索/登录框输入典型 payload | 拒绝或转义，无报错泄露 |
