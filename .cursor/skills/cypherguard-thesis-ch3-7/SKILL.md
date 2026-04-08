---
name: cypherguard-thesis-ch3-7
description: >-
  Drafts thesis chapters 3–7 and diagrams for the CypherGuard AI (毕设) codebase:
  requirements, design, implementation, testing, conclusion. Use when the user
  refines 需求分析/系统设计/系统实现/系统测试/总结与展望, writes 本科论文 middle
  chapters, or asks to continue thesis work chapter-by-chapter against this repo.
---

# CypherGuard AI 论文第3–7章协作 Skill

## 何时启用

用户要**结合本仓库真实实现**打磨第3、4、5、6、7章，或约定**按章逐轮对话**完成时，优先遵循本 Skill。

## 仓库事实速查（撰写时必须对齐）

| 层级 | 路径或组件 |
|------|------------|
| 编排 | `docker-compose.yml`：`postgres`、`redis`、`minio`、`qdrant`、`gateway`、`frontend`、`auth-service`、`kb-service`、`chat-service`、`model-gateway`、`model-config-service`、`worker`（Celery） |
| 库表与约束 | `infra/db/init.sql`（权威 DDL、索引、默认 `modes`、审计表等） |
| ORM | `shared/python/common/models.py`（字段与关系以代码为准；若与 `init.sql` 有出入，论文以**实际运行库**或**二者较新者**为准并脚注说明） |
| 认证 | `services/auth-service/app/main.py`、`shared/python/common/auth.py` |
| 知识库与文档 | `services/kb-service/app/main.py` |
| 对话与 RAG | `services/chat-service/app/main.py` |
| 模型网关 | `services/model-gateway/app/main.py`（及 `main_v2.py` 若在用） |
| 模型配置 | `services/model-config-service/app/main.py` |
| 异步摄取 | `services/worker/app/celery_app.py` 及 worker 内任务模块 |
| 前端页面 | `frontend/src/pages/`：`Login`、`Dashboard`、`KnowledgeBase`、`DocumentDetail`、`Chat`、`Settings`、`FAQManager`、`TagManager`、`UserProfile` |
| API 封装 | `frontend/src/services/api.ts` |
| 审计 | `shared/python/common/audit.py`，表 `audit_logs` |

## 写作硬性规则

1. **禁止空泛段**：每条功能/非功能/安全结论尽量对应**具体机制**（例如：`modes.require_citations`、`ingestion_tasks.task_type`、混合检索 `retrieval_strategy`+`bm25_weight`）。
2. **引用代码或 DDL**：正文描述接口/状态时，用 ```start:end:path``` 或附录贴关键片段；图表符号与模块名与仓库一致（如 `kb-service` 勿写成“知识服务”无英文标识，可中英并列一次）。
3. **制图先于空话**：每一节计划好的图，文中必须有**图题 + 图中符号说明 + 与实现的对照**（一两句即可）。
4. **网安专业**：第3章 3.4、第4章 4.5、第5章安全实现、第6章 6.4 不可省略；内容绑定认证、密钥存储、注入、审计、限流等**本项目已实现或可描述的设计**。
5. **字数**：在建议范围内写满；避免教科书式定义堆砌，优先**本系统实例**。

## 分章任务与交付物

### 第3章 需求分析

**目标**：从“无系统”到“有系统”写清差异；角色、用例、非功能、安全、可行性均**可验证**。

| 小节 | 必写内容 | 制图 |
|------|----------|------|
| 3.1 业务流程 | 文档型 KB 与 FAQ 型 KB 两条主流程；含上传/解析失败分支 | 业务流程图（泳道：用户、前端、gateway、kb-service、worker、minio、postgres、qdrant、chat-service） |
| 3.2 功能需求 | `admin` / `user`；用例覆盖注册登录、知识库 CRUD、文档上传与状态、对话与模式切换、模型配置、FAQ/标签（若实现） | 用例图（按角色各 1 张或合并 1 张分区） |
| 3.3 非功能 | 可用性、可部署性（Docker）、性能期望、可维护性（微服务边界） | 可选：质量属性场景表 |
| 3.4 安全 | 密码哈希、JWT/会话、RBAC、`api_key_encrypted`、SQL 注入与 XSS 面、审计日志 | 可选：威胁列表与对策表 |
| 3.5 可行性 | 技术栈成熟度、与已实现模块对应 | 无强制新图 |

**本轮交付**：完整第3章正文 + 至少 2 张图（流程 + 用例）+ 用例规约表（3～5 个核心用例详述）。

---

### 第4章 系统设计

**目标**：架构、模块、核心链路、数据库、安全设计均可**映射到文件与服务名**。

| 小节 | 必写内容 | 制图 |
|------|----------|------|
| 4.1 总体架构 | `gateway` 反向代理、各微服务、基础设施；同步/异步边界 | 部署架构图（与 `docker-compose.yml` 一致） |
| 4.2 功能模块 | 按服务划分 + 前端模块 | 模块层次图 |
| 4.3 核心模块 | 至少：**文档摄取与索引**（Celery 任务类型与状态）、**检索与问答**（vector/bm25/hybrid、top_k/top_n、引用）、**模型网关**（provider、并发/限流字段） | 摄取**时序图**、问答**时序图**各 1 |
| 4.4 数据库 | E-R：`users`、`knowledge_bases`、`documents`、`chunks`、`ingestion_tasks`、`model_configs`、`modes`、`conversations`、`messages`、`faq_entries`、`entities`、`audit_logs` 等 | E-R 图 + 逻辑表说明表（主键、外键、枚举 CHECK） |
| 4.5 安全设计 | 与 3.4 对应的设计层表述（密钥、传输、权限、日志） | 可选：安全机制与组件映射表 |

**本轮交付**：第4章正文 + 部署图 + 2 张时序图 + E-R + 核心表字段说明表。

---

### 第5章 系统实现

**目标**：**一功能一节**：说明 + 操作步骤 + **截图位（图注写清页面路径）** + 关键实现（代码或算法步骤）。

建议小节映射（可按实际微调）：

- 5.1 认证与用户角色（`auth-service` + `AuthContext` / `ProtectedRoute`）
- 5.2 知识库与文档管理（`KnowledgeBase`、`DocumentDetail`、`kb-service`）
- 5.3 异步摄取与向量索引（`worker`、`ingestion_tasks`、`qdrant` 集合命名若代码中有）
- 5.4 对话、检索模式与引用展示（`Chat`、`AnswerReferences`、`chat-service`）
- 5.5 模型配置与网关（`Settings`、`model-config-service`、`model-gateway`）
- 5.6 安全实现（网安必须）：密码、Token、密钥不落前端、CORS、参数化查询、审计调用点

**本轮交付**：第5章正文 + 每节 1～2 张截图占位说明 + 少量 ```代码引用```。

---

### 第6章 系统测试

**目标**：环境可复现；功能用例表可执行；性能与安全测试**有指标、有步骤**。

| 小节 | 必写内容 | 制图/表 |
|------|----------|---------|
| 6.1 环境 | 硬件、OS、Docker 版本、浏览器、`.env` 中**非敏感**项说明 | 环境表 |
| 6.2 功能测试 | 按模块：登录、知识库、上传、索引成功/失败、对话与引用、模型切换、管理员操作 | 测试用例表（编号、步骤、预期、实际、通过/失败） |
| 6.3 性能测试 | 例如：单次问答延迟、并发数、索引吞吐；工具可为 curl/浏览器计时/简单脚本 | 结果表或简单柱状图 |
| 6.4 安全测试 | 未授权访问、弱口令策略说明、注入探测（预期失败）、敏感接口 | 安全测试表 |

**本轮交付**：第6章正文 + 至少 1 张功能用例总表 + 安全测试小节。

---

### 第7章 总结与展望

**目标**：每条总结对应第4–6章已实现能力；不足与展望**具体**（如：重排序策略、OCR、细粒度 RBAC、合规）。

**本轮交付**：第7章正文（无需新图，可选展望路线图）。

## 推荐交互方式（与用户约定）

1. **一次只攻坚一章**：用户消息写 `@cypherguard-thesis-ch3-7 第X章`，助手本回合只完成该章正文 + 该章所列图表（Mermaid 或制图说明）。
2. **用户补充**：截图、实测数据、学校格式（图题编号规则）在对应章开写前贴出。
3. **修订轮**：用户标「修订 3.2」则只改该节并重画相关图。

## 制图工具建议

- **Mermaid**：快速出流程/时序/ER（见 [reference.md](reference.md)）。
- **定稿**：draw.io / Visio 按学校模板重绘，与 Mermaid 拓扑一致。

## 章节完成自检清单（复制到对话跟踪）

```
[ ] 第3章：流程图、用例图、≥3 用例规约表、安全需求可对应实现
[ ] 第4章：部署图、摄取/问答时序图、E-R、≥8 张核心表说明
[ ] 第5章：≥5 小节实现+截图说明、5.6 安全、关键代码引用
[ ] 第6章：环境表、功能用例表、性能数字、6.4 安全测试
[ ] 第7章：总结与展望与上文一致、无新概念堆砌
```

## 延伸阅读

- Mermaid 模板与 ER 注意事项：[reference.md](reference.md)
