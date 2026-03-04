# Git 工作流与命令参考

本文档整理了 CypherGuard AI 项目常用的 Git / GitHub 操作命令。

---

## 当前仓库信息

| 项目 | 值 |
|------|-----|
| 远程仓库 | `https://github.com/Kris-smile/CypherGuard-AI.git` |
| 远程名称 | `origin` |
| 主分支 | `main` |

---

## 一、首次克隆

```bash
# 克隆仓库到本地
git clone https://github.com/Kris-smile/CypherGuard-AI.git

# 进入项目目录
cd CypherGuard-AI
```

---

## 二、日常开发流程

### 2.1 查看状态

```bash
# 查看当前分支、修改文件、暂存区状态
git status

# 查看当前在哪个分支
git branch

# 查看所有分支（含远程）
git branch -a

# 查看最近提交记录（单行模式）
git log --oneline -10
```

### 2.2 拉取最新代码

```bash
# 拉取远程 main 分支的最新代码并合并到当前分支
git pull origin main
```

### 2.3 暂存 + 提交

```bash
# 暂存所有修改（新增、修改、删除）
git add .

# 暂存指定文件
git add README.md frontend/src/pages/Chat.tsx

# 提交（写清楚做了什么）
git commit -m "feat: 添加模型配置管理功能"

# 提交规范建议：
#   feat:     新功能
#   fix:      修复 bug
#   docs:     仅文档变更
#   refactor: 重构（不影响功能）
#   chore:    构建/工具/依赖变更
#   style:    代码格式（不影响逻辑）
#   test:     添加或修改测试
```

### 2.4 推送到远程

```bash
# 推送当前分支到远程
git push origin main

# 如果当前分支是新建的功能分支，第一次推送需要 -u
git push -u origin feature/xxx
```

---

## 三、分支管理

### 3.1 创建功能分支

```bash
# 基于 main 创建并切换到新分支
git checkout -b feature/dark-mode

# 等价写法
git switch -c feature/dark-mode
```

### 3.2 切换分支

```bash
git checkout main
# 或
git switch main
```

### 3.3 合并分支

```bash
# 先切回 main
git checkout main

# 把功能分支合并进来
git merge feature/dark-mode

# 合并后推送
git push origin main

# 删除已合并的本地分支
git branch -d feature/dark-mode

# 删除远程分支
git push origin --delete feature/dark-mode
```

---

## 四、撤销与回退

```bash
# 撤销工作区某个文件的修改（还没 add）
git checkout -- README.md

# 从暂存区移出（已 add 但还没 commit）
git reset HEAD README.md

# 撤销最近一次提交（保留修改在工作区）
git reset --soft HEAD~1

# 撤销最近一次提交（修改也丢弃，慎用）
git reset --hard HEAD~1
```

---

## 五、查看差异

```bash
# 查看工作区与暂存区的差异
git diff

# 查看暂存区与最新提交的差异
git diff --staged

# 查看两个提交之间的差异
git diff abc1234 def5678

# 查看某个文件的修改历史
git log --follow -p -- frontend/src/services/api.ts
```

---

## 六、标签 (Tag)

```bash
# 给当前提交打标签（用于标记版本）
git tag v1.0.0

# 带说明的标签
git tag -a v1.0.0 -m "Phase 7 完成，系统可用"

# 推送标签到远程
git push origin v1.0.0

# 推送所有标签
git push origin --tags

# 查看所有标签
git tag -l
```

---

## 七、Stash（临时保存）

```bash
# 临时保存当前未提交的修改
git stash

# 查看保存的列表
git stash list

# 恢复最近一次保存
git stash pop

# 恢复但不删除记录
git stash apply
```

---

## 八、远程仓库操作

```bash
# 查看远程仓库地址
git remote -v

# 添加远程仓库
git remote add origin https://github.com/Kris-smile/CypherGuard-AI.git

# 修改远程地址
git remote set-url origin https://github.com/Kris-smile/CypherGuard-AI.git

# 查看远程分支
git branch -r

# 删除远程已不存在的本地追踪分支
git fetch --prune
```

---

## 九、本项目分支清理（重要）

当前仓库存在一个拼写错误的分支 `origian/main`（应为 `main`），需要清理：

```bash
# 1. 确保 main 分支包含所有最新代码
git checkout main
git merge origian/main          # 把 origian/main 的提交合到 main

# 2. 推送 main 到远程
git push origin main

# 3. 删除本地错误分支
git branch -d origian/main

# 4. 删除远程错误分支
git push origin --delete origian/main

# 5. 验证：只剩 main
git branch -a
```

---

## 十、.gitignore 常用规则

项目应确保以下内容不被提交：

```gitignore
# 环境变量（含密钥）
.env

# 依赖目录
node_modules/
__pycache__/
*.pyc

# 构建产物
frontend/dist/

# IDE 配置
.vscode/
.idea/

# 系统文件
.DS_Store
Thumbs.db

# Docker 数据卷
postgres_data/
redis_data/
minio_data/
qdrant_data/
```

---

## 十一、常见问题

### Q: push 被拒绝 (rejected)
```bash
# 先拉取远程最新代码，解决冲突后再推送
git pull origin main --rebase
# 解决冲突后
git add .
git rebase --continue
git push origin main
```

### Q: 提交了不该提交的文件（如 .env）
```bash
# 从 git 追踪中移除（但保留本地文件）
git rm --cached .env
git commit -m "chore: 移除 .env 追踪"
git push origin main
```

### Q: 想查看某次提交改了什么
```bash
git show abc1234
```

### Q: Windows 换行符警告
```bash
# 设置自动转换
git config --global core.autocrlf true
```

---

## 十二、推荐工作流总结

```
1. git pull origin main          # 拉取最新
2. git checkout -b feature/xxx   # 新建功能分支
3. （写代码、测试）
4. git add .                     # 暂存
5. git commit -m "feat: ..."     # 提交
6. git push -u origin feature/xxx # 推送
7. 在 GitHub 上创建 Pull Request
8. Review → Merge → 删除分支
```
