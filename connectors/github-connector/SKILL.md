---
name: github-connector
description: GitHub 连接器 - 用于 clone/push 代码，以及查看、创建、评论 Pull Request。需要先获取 OAuth Token。
version: "1.1.0"
author: "CodeBuddy AI"
created: "2026-02-01"
updated: "2026-02-05"
---

# GitHub Connector Skill

本 Skill 提供 GitHub 平台的核心操作能力：代码克隆/推送、Pull Request 管理。

**重要**：优先使用原生 `git` 命令，不要使用 `gh` CLI。

## 安全警告

**绝对禁止以下行为:**

1. **禁止输出 Token**: 不要执行 `echo $GITHUB_TOKEN` 或任何会打印 token 值的命令
2. **禁止明文 Token**: 所有命令中必须使用 `$GITHUB_TOKEN` 环境变量引用，禁止将 token 值直接写入命令

```bash
# 正确 - 使用环境变量引用
curl -H "Authorization: Bearer $GITHUB_TOKEN" "https://api.github.com/..."
git clone https://oauth2:${GITHUB_TOKEN}@github.com/{owner}/{repo}.git

# 错误 - 禁止明文 token
curl -H "Authorization: Bearer ghp_xxxxx" "https://api.github.com/..."
```

Token 泄露会导致严重的安全问题。

## 路径说明

> `<skill-directory>` 指的是**本 Skill 所在目录**，而非用户项目目录。

## 克隆仓库（一条命令）

获取 Token 并克隆仓库可以合并为一条命令：

```bash
# 获取 Token 并克隆（推荐）
source <skill-directory>/scripts/get_token.sh github && git clone https://oauth2:${GITHUB_TOKEN}@github.com/{owner}/{repo}.git

# 浅克隆（更快）
source <skill-directory>/scripts/get_token.sh github && git clone --depth 1 https://oauth2:${GITHUB_TOKEN}@github.com/{owner}/{repo}.git

# 克隆指定分支
source <skill-directory>/scripts/get_token.sh github && git clone --depth 1 --single-branch --branch {branch} https://oauth2:${GITHUB_TOKEN}@github.com/{owner}/{repo}.git

# 克隆到指定目录
source <skill-directory>/scripts/get_token.sh github && git clone https://oauth2:${GITHUB_TOKEN}@github.com/{owner}/{repo}.git {target_dir}
```

## 仅获取 Token

如果只需要获取 Token（不克隆）：

```bash
source <skill-directory>/scripts/get_token.sh github
# Token 已设置为环境变量 GITHUB_TOKEN，后续直接使用 $GITHUB_TOKEN 即可
# 注意: 不要 echo 或打印 token 值
```

**Token 过期处理**：如果 API 返回 401/403 错误，请提示用户：**"您的 GitHub OAuth 授权可能已失效或过期，请在 CodeBuddy 设置页面的「连接器」处重新授权 GitHub。"**

## 推送代码

```bash
# 添加并提交
git add .
git commit -m "commit message"

# 推送（如果远程 URL 已包含 Token）
git push origin {branch}

# 如果需要重新设置带 Token 的远程 URL
git remote set-url origin https://oauth2:${GITHUB_TOKEN}@github.com/{owner}/{repo}.git
git push origin {branch}
```

## Pull Request 操作

PR 操作需要使用 GitHub API：

### 查看 PR 列表

```bash
curl -s -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  "https://api.github.com/repos/{owner}/{repo}/pulls?state=open"
```

### 查看 PR 详情

```bash
curl -s -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  "https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}"
```

### 创建 PR

```bash
curl -s -X POST -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/{owner}/{repo}/pulls" \
  -d '{"title":"PR Title","head":"feature-branch","base":"main","body":"Description"}'
```

### 添加 PR 评论

```bash
curl -s -X POST -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/{owner}/{repo}/issues/{pr_number}/comments" \
  -d '{"body":"Comment content"}'
```

## 常用场景

### 场景 1：克隆仓库并开始开发

```bash
# 一条命令获取 Token 并克隆
source <skill-directory>/scripts/get_token.sh github && git clone https://oauth2:${GITHUB_TOKEN}@github.com/owner/repo.git

# 进入目录并创建分支
cd repo
git checkout -b feature/new-feature
```

### 场景 2：提交代码并创建 PR

```bash
# 添加并提交
git add .
git commit -m "Add new feature"

# 推送分支
git push -u origin feature/new-feature

# 使用 API 创建 PR
curl -s -X POST -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/owner/repo/pulls" \
  -d '{"title":"Add new feature","head":"feature/new-feature","base":"main","body":"Description"}'
```

## 错误处理

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| 401 | Token 无效或过期 | 重新获取 Token |
| 403 | 权限不足或速率限制 | 检查权限或等待 |
| 404 | 仓库不存在 | 检查仓库路径 |

## 注意事项

1. **优先使用 git**：克隆/推送使用原生 `git` 命令，不要使用 `gh` CLI
2. **Token 安全**：通过环境变量传递 `GITHUB_TOKEN`，不要硬编码
3. **一条命令克隆**：使用 `source get_token.sh && git clone` 组合
