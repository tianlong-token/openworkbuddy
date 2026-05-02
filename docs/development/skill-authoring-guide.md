# 技能作者指南

## 创建新技能

### 1. 创建目录

```bash
mkdir -p skills/my-awesome-skill
```

### 2. 创建 SKILL.md

```yaml
---
name: my-awesome-skill
description: "Brief English description of what this skill does"
description_zh: "中文描述"
version: 1.0.0
allowed-tools: Read, Write, Bash, Glob, Grep
metadata:
  tags: [category, topic]
  category: category-name
  quality: alpha
---

# My Awesome Skill

## When This Activates
- User asks to do X
- User mentions keyword Y

## Workflow
1. Step one
2. Step two
3. Step three

## Inputs
- **Parameter 1**: Description
- **Parameter 2**: Description

## Output Structure
- Expected output format

## Edge Cases
- What to handle specially

## Examples
- Example usage
```

### 3. 验证

```bash
npm run validate-skills
```

### 4. 重新生成索引

```bash
npm run generate-index
```

## Frontmatter 字段说明

| 字段 | 必需 | 类型 | 说明 |
|------|------|------|------|
| `name` | 是 | string | 技能唯一标识，必须与目录名一致 |
| `description` | 是 | string | 英文描述，不超过 300 字符 |
| `description_zh` | 否 | string | 中文描述 |
| `version` | 是 | string | 语义化版本号 (1.0.0) |
| `allowed-tools` | 是 | string | 逗号分隔的工具列表 |
| `metadata.tags` | 否 | string[] | 标签列表 |
| `metadata.category` | 否 | string | 分类 |
| `metadata.quality` | 否 | string | 质量等级：alpha/beta/stable |
| `metadata.requires` | 否 | string[] | 外部依赖 |

## Body 章节说明

| 章节 | 必需 | 说明 |
|------|------|------|
| `# Title` | 是 | 技能标题 |
| `## When This Activates` | 是 | 触发条件列表 |
| `## Workflow` | 是 | 工作流程步骤 |
| `## Inputs` | 否 | 输入参数说明 |
| `## Output Structure` | 否 | 输出格式说明 |
| `## Edge Cases` | 否 | 边界情况处理 |
| `## Examples` | 否 | 使用示例 |
| `## Best Practices` | 否 | 最佳实践 |
| `## Troubleshooting` | 否 | 故障排除 |

## 可选子目录

```
skills/my-awesome-skill/
├── SKILL.md              # 必需
├── scripts/              # 可选：Python/Shell 脚本
│   └── helper.py
├── references/           # 可选：参考文档
│   └── api-docs.md
├── assets/               # 可选：静态资源
│   └── template.html
└── templates/            # 可选：输出模板
    └── report.md
```

## 工具列表

运行时支持以下工具：

| 工具 | 说明 |
|------|------|
| `Read` | 读取文件 |
| `Write` | 写入文件 |
| `Edit` | 编辑文件（查找替换） |
| `Bash` | 执行 shell 命令 |
| `Glob` | 文件模式匹配搜索 |
| `Grep` | 文件内容正则搜索 |
| `WebFetch` | 获取 URL 内容 |
| `WebSearch` | 互联网搜索 |
| `Agent` | 生成子智能体 |
| `TodoWrite` | 管理任务列表 |
| `Task` | 启动复杂任务 |
| `Skill` | 加载技能 |

## 最佳实践

1. **描述简洁明了**：description 不超过 300 字符，让用户快速理解技能用途
2. **触发条件具体**：When This Activates 列出用户可能说的话，提高匹配率
3. **工作流程清晰**：Workflow 按步骤编号，每一步都是可执行的动作
4. **最小权限**：只声明需要的工具，不要声明 Read+Write+Bash 如果只需要 Read
5. **质量标注**：新技能标记为 `quality: alpha`，经过测试后升级为 `beta` 或 `stable`
