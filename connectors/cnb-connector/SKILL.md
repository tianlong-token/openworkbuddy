---
name: cnb-connector
description: CNB 连接器 - 用于 clone/push 代码，以及查看、创建、评论 Pull Request 和 Issues。仅用于 cnb.woa.com 域名。
version: "2.0.0"
author: "CodeBuddy AI"
created: "2026-02-01"
updated: "2026-02-05"
license: MIT
---

# CNB Connector

克隆/推送代码、管理 Pull Request 和 Issues。**仅用于 cnb.woa.com 域名**。

## 安全警告

**绝对禁止以下行为:**

1. **禁止输出 Token**: 不要执行 `echo $CNB_TOKEN` 或任何会打印 token 值的命令
2. **禁止明文 Token**: 所有命令中必须使用 `$CNB_TOKEN` 环境变量引用，禁止将 token 值直接写入命令

```bash
# 正确 - 使用环境变量引用
git clone https://oauth2:${CNB_TOKEN}@cnb.woa.com/{owner}/{repo}.git

# 错误 - 禁止明文 token
git clone https://oauth2:abc123xxx@cnb.woa.com/{owner}/{repo}.git
```

Token 泄露会导致严重的安全问题。

## 路径说明

> `<skill-directory>` 指的是**本 Skill 所在目录**，而非用户项目目录。

## 克隆仓库（一条命令）

```bash
# 获取 Token 并克隆
source <skill-directory>/scripts/get_token.sh cnb && git clone https://oauth2:${CNB_TOKEN}@cnb.woa.com/{owner}/{repo}.git

# 浅克隆
source <skill-directory>/scripts/get_token.sh cnb && git clone --depth 1 https://oauth2:${CNB_TOKEN}@cnb.woa.com/{owner}/{repo}.git

# 克隆指定分支
source <skill-directory>/scripts/get_token.sh cnb && git clone --depth 1 --single-branch --branch {branch} https://oauth2:${CNB_TOKEN}@cnb.woa.com/{owner}/{repo}.git
```

## 仅获取 Token

```bash
source <skill-directory>/scripts/get_token.sh cnb
# Token 已设置为环境变量 CNB_TOKEN，后续直接使用 $CNB_TOKEN 即可
# 注意: 不要 echo 或打印 token 值
```

**Token 过期**：如果 API 返回 401/403 错误，请提示用户：**"您的 CNB OAuth 授权可能已失效或过期，请在 CodeBuddy 设置页面的「连接器」处重新授权 CNB。"**

## 使用场景

- cnb.woa.com 域名下的仓库操作
- 用户提到 "CNB"、"cnb.woa.com" 等关键词

**注意**：此 connector 专用于 cnb.woa.com，不适用于 GitHub、GitLab 等。

---

## 推送代码

```bash
git add .
git commit -m "commit message"
git push origin {branch}

# 如需重设远程 URL
git remote set-url origin https://oauth2:${CNB_TOKEN}@cnb.woa.com/{owner}/{repo}.git
```

---

## Issues 操作（使用 cnb.js）

### 安装依赖（首次）

```bash
cd <skill-directory>/scripts && npm install
```

### 查询 Issues

```bash
# 查询 open issues
<skill-directory>/scripts/cnb.js issues --repo {owner}/{repo} --state open

# 查询指定 issue
<skill-directory>/scripts/cnb.js issues --repo {owner}/{repo} --number 123

# 按标签和优先级筛选
<skill-directory>/scripts/cnb.js issues --repo {owner}/{repo} --labels bug --priority P0
```

### 更新 Issue

```bash
# 关闭 issue
<skill-directory>/scripts/cnb.js update-issue --repo {owner}/{repo} --number 123 --state closed --state-reason completed

# 修改优先级
<skill-directory>/scripts/cnb.js update-issue --repo {owner}/{repo} --number 123 --priority P0
```

---

## Pull Request 操作

### 查询 PR

```bash
# 所有 PR
<skill-directory>/scripts/cnb.js prs --repo {owner}/{repo} --state all

# 指定 PR
<skill-directory>/scripts/cnb.js prs --repo {owner}/{repo} --number 456

# 按审核人筛选
<skill-directory>/scripts/cnb.js prs --repo {owner}/{repo} --reviewers 张三
```

### 创建 PR

```bash
<skill-directory>/scripts/cnb.js create-pr --repo {owner}/{repo} \
  --title "PR标题" --head feature-branch --base main --body "描述"
```

### 评论 PR

```bash
<skill-directory>/scripts/cnb.js comment-pr --repo {owner}/{repo} --number 123 --body "LGTM!"
```

---

## 完整工作流

```bash
# 1. 获取 Token 并克隆
source <skill-directory>/scripts/get_token.sh cnb && git clone https://oauth2:${CNB_TOKEN}@cnb.woa.com/{owner}/{repo}.git
cd {repo}

# 2. 创建分支并开发
git checkout -b feature-branch
# ... 修改代码 ...
git add . && git commit -m "Add feature"
git push -u origin feature-branch

# 3. 创建 PR
<skill-directory>/scripts/cnb.js create-pr --repo {owner}/{repo} \
  --title "Add feature" --head feature-branch --base main
```

---

## cnb.js 命令速查

| 命令 | 说明 |
|------|------|
| `issues --repo x --state open` | 查询 open issues |
| `issues --repo x --number N` | 查询指定 issue |
| `prs --repo x --state all` | 查询所有 PR |
| `prs --repo x --number N` | 查询指定 PR |
| `create-pr --repo x --title T --head H --base B` | 创建 PR |
| `comment-pr --repo x --number N --body B` | 评论 PR |
| `update-issue --repo x --number N --state S` | 更新 issue |

**重要**：使用 cnb.js 时**必须用 `--repo` 参数**指定仓库。

## 注意事项

1. **优先使用 git**：克隆/推送使用原生 `git` 命令
2. **Token 安全**：通过环境变量传递，不要硬编码
3. **一条命令克隆**：使用 `source get_token.sh && git clone` 组合
4. **cnb.js 需要 --repo**：必须显式指定仓库
