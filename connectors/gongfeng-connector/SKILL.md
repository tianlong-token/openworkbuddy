---
name: gongfeng-connector
description: 工蜂连接器 - 用于 clone/push 代码，以及查看、创建、评论 Pull Request。
version: "2.3.0"
author: "CodeBuddy AI"
created: "2026-02-01"
updated: "2026-02-05"
---

# 工蜂 Connector

克隆/推送代码、创建和管理 Pull Request。

## 安全警告

**绝对禁止以下行为:**

1. **禁止输出 Token**: 不要执行 `echo $GONGFENG_TOKEN` 或任何会打印 token 值的命令
2. **禁止明文 Token**: 所有命令中必须使用 `$GONGFENG_TOKEN` 环境变量引用，禁止将 token 值直接写入命令

```bash
# 正确 - 使用环境变量引用
curl -H "Authorization: Bearer $GONGFENG_TOKEN" "https://git.woa.com/api/v3/..."
git clone https://oauth2:${GONGFENG_TOKEN}@git.woa.com/{group}/{project}.git

# 错误 - 禁止明文 token
curl -H "Authorization: Bearer abc123xxx" "https://git.woa.com/api/v3/..."
```

Token 泄露会导致严重的安全问题。

## 路径说明

> `<skill-directory>` 指的是**本 Skill 所在目录**，而非用户项目目录。

## 克隆仓库（一条命令）

```bash
# 获取 Token 并克隆
source <skill-directory>/scripts/get_token.sh gongfeng && git clone https://oauth2:${GONGFENG_TOKEN}@git.woa.com/{group}/{project}.git

# 浅克隆（更快）
source <skill-directory>/scripts/get_token.sh gongfeng && git clone --depth 1 https://oauth2:${GONGFENG_TOKEN}@git.woa.com/{group}/{project}.git

# 克隆指定分支
source <skill-directory>/scripts/get_token.sh gongfeng && git clone --depth 1 --single-branch --branch {branch} https://oauth2:${GONGFENG_TOKEN}@git.woa.com/{group}/{project}.git
```

## 仅获取 Token

```bash
source <skill-directory>/scripts/get_token.sh gongfeng
# Token 已设置为环境变量 GONGFENG_TOKEN，后续直接使用 $GONGFENG_TOKEN 即可
# 注意: 不要 echo 或打印 token 值
```

**Token 过期**：如果 API 返回 401/403 错误，请提示用户：**"您的工蜂 OAuth 授权可能已失效或过期，请在 CodeBuddy 设置页面的「连接器」处重新授权工蜂。"**

## 基础信息

- **Git URL**: `https://git.woa.com`
- **API URL**: `https://git.woa.com/api/v3`
- **认证**: `Authorization: Bearer <token>`

---

## 推送代码

```bash
# 添加并提交
git add .
git commit -m "commit message"

# 推送
git push origin {branch}

# 如需重设远程 URL
git remote set-url origin https://oauth2:${GONGFENG_TOKEN}@git.woa.com/{group}/{project}.git
```

---

## Pull Request 操作

### 获取 PR 列表

```bash
curl -H "Authorization: Bearer $GONGFENG_TOKEN" \
  "https://git.woa.com/api/v3/projects/{project_id}/merge_requests?state=opened"
```

### 获取 PR 详情

```bash
curl -H "Authorization: Bearer $GONGFENG_TOKEN" \
  "https://git.woa.com/api/v3/projects/{project_id}/merge_requests/{mr_iid}"
```

### 创建 PR

```bash
curl -X POST -H "Authorization: Bearer $GONGFENG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source_branch":"feature","target_branch":"main","title":"PR标题"}' \
  "https://git.woa.com/api/v3/projects/{project_id}/merge_requests"
```

### 添加 PR 评论

```bash
curl -X POST -H "Authorization: Bearer $GONGFENG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"评论内容"}' \
  "https://git.woa.com/api/v3/projects/{project_id}/merge_requests/{mr_iid}/notes"
```

### 合并 PR

```bash
curl -X PUT -H "Authorization: Bearer $GONGFENG_TOKEN" \
  -d '{"should_remove_source_branch":true}' \
  "https://git.woa.com/api/v3/projects/{project_id}/merge_requests/{mr_iid}/merge"
```

---

## 完整工作流

```bash
# 1. 获取 Token 并克隆
source <skill-directory>/scripts/get_token.sh gongfeng && git clone https://oauth2:${GONGFENG_TOKEN}@git.woa.com/{group}/{project}.git
cd {project}

# 2. 创建分支并开发
git checkout -b feature-branch
# ... 修改代码 ...
git add . && git commit -m "Add feature"
git push -u origin feature-branch

# 3. 创建 PR
curl -X POST -H "Authorization: Bearer $GONGFENG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source_branch":"feature-branch","target_branch":"main","title":"Add feature"}' \
  "https://git.woa.com/api/v3/projects/{project_id}/merge_requests"
```

---

## 常用 API

| 操作 | API |
|------|-----|
| PR 列表 | `GET /projects/{id}/merge_requests` |
| PR 详情 | `GET /projects/{id}/merge_requests/{iid}` |
| 创建 PR | `POST /projects/{id}/merge_requests` |
| PR 评论 | `POST /projects/{id}/merge_requests/{iid}/notes` |
| 合并 PR | `PUT /projects/{id}/merge_requests/{iid}/merge` |
| PR 变更 | `GET /projects/{id}/merge_requests/{iid}/changes` |
| 创建分支 | `POST /projects/{id}/repository/branches` |

## 注意事项

1. **优先使用 git**：克隆/推送使用原生 `git` 命令
2. **Token 安全**：通过环境变量传递，不要硬编码
3. **一条命令克隆**：使用 `source get_token.sh && git clone` 组合
