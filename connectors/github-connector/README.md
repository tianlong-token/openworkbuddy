# GitHub Connector Skill

用于连接 GitHub 的 CodeBuddy Skill，支持代码克隆/推送和 Pull Request 管理。

## 快速开始

```bash
# 获取 Token 并克隆仓库（一条命令）
source <skill-directory>/scripts/get_token.sh github && git clone https://oauth2:${GITHUB_TOKEN}@github.com/{owner}/{repo}.git
```

## 目录结构

```
github-connector/
├── SKILL.md              # Skill 定义
├── README.md             # 本文件
└── scripts/
    └── get_token.sh      # Token 获取脚本
```

## 支持的操作

| 功能 | 命令 |
|------|------|
| 克隆仓库 | `git clone https://oauth2:${GITHUB_TOKEN}@github.com/owner/repo.git` |
| 推送代码 | `git push origin branch` |
| 查看 PR | GitHub API |
| 创建 PR | GitHub API |

## 注意事项

1. **优先使用 git**：克隆/推送使用原生 `git` 命令
2. **Token 安全**：通过环境变量传递，不要硬编码
3. **一条命令**：使用 `source get_token.sh && git clone` 组合

---
**版本**: 1.1 | **更新**: 2026-02-05
