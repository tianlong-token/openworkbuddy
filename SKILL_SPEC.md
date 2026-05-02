# WorkBuddy Skill Format (WBSF) Specification

**Version:** 1.0.0  
**Status:** Draft

---

## Overview

WorkBuddy Skill Format (WBSF) 是 WorkBuddy 框架中技能的标准化定义格式。每个技能由一个目录组成，目录名即为技能的 slug 标识。

## Directory Structure

```
skills/<skill-slug>/
├── SKILL.md              # 必需：技能定义（YAML frontmatter + Markdown body）
├── scripts/              # 可选：执行脚本
│   ├── helper.sh
│   └── helper.py
├── references/           # 可选：参考文档
│   ├── api-docs.md
│   └── examples.md
├── assets/               # 可选：静态资源（图片、模板等）
│   └── template.html
└── templates/            # 可选：输出模板
    └── report.md
```

## SKILL.md Format

### YAML Frontmatter

```yaml
---
name: <string>              # 必需：技能唯一标识（kebab-case）
description: <string>       # 必需：英文简短描述（max 300 chars）
description_zh: <string>    # 可选：中文描述
description_en: <string>    # 可选：英文详细描述
version: <string>           # 必需：语义化版本号 (semver)
homepage: <string>          # 可选：项目主页 URL
allowed-tools: <string[]>   # 必需：允许使用的工具列表
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - WebFetch
  - WebSearch
metadata:                   # 可选：扩展元数据
  version: <string>
  tags: <string[]>          # 标签列表
  category: <string>        # 类别
  quality: <string>         # alpha | beta | stable
  requires: <string[]>      # 外部依赖（如 external-api, browser）
---
```

### Markdown Body

技能主体部分包含以下内容（按推荐顺序）：

| 章节 | 必需 | 说明 |
|------|------|------|
| `# Title` | 是 | 技能标题（一句话描述） |
| `## When This Activates` | 是 | 触发条件列表 |
| `## Workflow` | 是 | 工作流程（步骤说明） |
| `## Inputs` | 否 | 输入要求 |
| `## Output Structure` | 否 | 预期输出结构 |
| `## Edge Cases` | 否 | 边界情况处理 |
| `## Examples` | 否 | 使用示例 |
| `## Best Practices` | 否 | 最佳实践 |
| `## Troubleshooting` | 否 | 故障排除 |

### 示例

```yaml
---
name: deep-research
description: "Multi-step research skill that searches, reads, and synthesizes information"
description_zh: "多步研究技能：搜索、阅读、综合信息"
version: 1.0.0
allowed-tools: Read, Write, Bash, WebFetch, WebSearch, Grep
metadata:
  tags: [research, search, analysis]
  category: research
  quality: stable
---

# Deep Research

## When This Activates
- User asks to "research" a topic
- User wants comprehensive information on a subject
- User needs synthesis from multiple sources

## Workflow
1. Parse the research query
2. Generate search queries
3. Execute searches (WebSearch / WebFetch)
4. Read and analyze sources
5. Synthesize findings
6. Produce structured report
```

## Allowed Tools

WorkBuddy 运行时支持以下基础工具：

| 工具 | 说明 |
|------|------|
| `Read` | 读取文件内容 |
| `Write` | 写入文件 |
| `Edit` | 编辑文件（查找替换） |
| `Bash` | 执行 shell 命令 |
| `Glob` | 文件模式匹配搜索 |
| `Grep` | 文件内容搜索 |
| `WebFetch` | 获取 URL 内容 |
| `WebSearch` | 互联网搜索 |
| `Agent` | 子代理调度 |
| `Skill` | 技能间互相调用 |
| `TodoWrite` | 待办管理（磁盘持久化） |
| `Task` | 任务分解（v0.2.0-beta） |

技能只能在 `allowed-tools` 中声明的工具范围内操作。运行时会自动执行权限检查。

## Validation Rules

1. `name` 必须为 kebab-case（小写字母、数字、连字符）
2. `name` 在所有技能中必须唯一
3. `description` 不能超过 300 字符
4. `version` 必须符合 semver 格式
5. `allowed-tools` 不能为空，且只能包含运行时支持的工具
6. `SKILL.md` 文件必须存在
7. YAML frontmatter 必须格式正确（合法的 YAML）

## Quality Levels

| 级别 | 说明 |
|------|------|
| `alpha` | 实验性技能，可能不稳定 |
| `beta` | 基本可用，需要更多测试 |
| `stable` | 经过充分测试，生产可用 |
