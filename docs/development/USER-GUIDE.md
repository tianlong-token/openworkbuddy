# WorkBuddy 用户使用手册

> 版本: v0.2.0-alpha | 更新: 2026-05-02

---

## 一、简介

WorkBuddy 是一个开源的 AI 助手框架，预装 148 个专业技能，支持文件操作、代码执行、网络搜索等能力。

### 核心能力
- 💬 **AI 对话** — 基于 DeepSeek/OpenAI 的智能对话
- 🛠 **工具调用** — 读文件、写代码、搜网页、跑命令
- 🧠 **多轮记忆** — 自动保存对话历史，跨会话恢复
- 🔄 **多技能协作** — 技能间互相调用，子代理调度
- 📋 **会话管理** — 多会话并发，超时自动清理

---

## 二、快速使用

### 前置条件
1. 已成功安装（参照 Deploy 文档）
2. 已配置 LLM API Key

### 查看可用技能
```bash
node runtime/dist/cli.js list
```

你会看到 148 个技能列表：

```
WorkBuddy Skills (148):

| # | Slug | Name | Description | Version |
|---|------|------|-------------|---------|
| 1 | admapix | admapix | Advanced ad intelligence... | 1.0.0 |
| 2 | arxiv-reader | arxiv-reader | ... | 1.0.0 |
... more skills ...
```

### 运行一个技能
```bash
node runtime/dist/cli.js run deep-research "帮我研究一下 TypeScript 的装饰器"
```

### 搜索技能
```bash
node runtime/dist/cli.js search research
```

### 查看技能详情
```bash
node runtime/dist/cli.js info deep-research
```

### 多轮对话模式
```bash
node runtime/dist/cli.js chat deep-research
```

进入对话模式后：
```
You: 帮我写一个 TypeScript 装饰器
Agent: (LLM 回复)
You: 加上参数验证
Agent: (LLM 回复，记得上下文)
You: /exit  (退出)
You: /clear (清空历史)
```

---

## 三、命令参考

### `list` — 列出所有技能
```bash
workbuddy list
workbuddy --json list          # JSON 格式输出
```

### `search <query>` — 搜索技能
```bash
workbuddy search research
workbuddy --json search "data analysis"
```

### `info <skill>` — 查看技能详情
```bash
workbuddy info deep-research
workbuddy --json info arxiv-reader
```

### `run <skill> [message]` — 执行技能
```bash
workbuddy run arxiv-reader "最新的 LLM 论文有哪些"
workbuddy run --timeout=30000 deep-research "长时间任务"
```

### `chat <skill>` — 多轮对话
```bash
workbuddy chat deep-research
workbuddy chat --session=my-session-1 deep-research  # 指定会话 ID
```

### `config` — 查看配置
```bash
workbuddy config
workbuddy --json config
```

### `sessions` — 查看活跃会话
```bash
workbuddy sessions
workbuddy --json sessions
```

### 全局标志
| 标志 | 说明 |
|------|------|
| `--json` | JSON 格式输出（机器可读） |
| `--session=<id>` | 指定会话 ID |
| `--timeout=<ms>` | 超时时间（毫秒） |

---

## 四、常用技能推荐

| 技能 | 用途 | 示例 |
|------|------|------|
| `deep-research` | 深度研究任何主题 | `run deep-research "量子计算进展"` |
| `arxiv-reader` | 学术论文分析 | `run arxiv-reader "最新 AI 论文"` |
| `web-search` | 网络搜索 | `run web-search "今天的新闻"` |
| `code-review` | 代码审查 | `run code-review`（对话中贴代码） |
| `write-blog` | 博客写作 | `run write-blog "写一篇关于 AI 的文章"` |
| `data-analysis` | 数据分析 | `run data-analysis`（上传 CSV） |
| `translator` | 翻译 | `run translator "将这段翻译成英文"` |
| `interview-prep` | 面试准备 | `run interview-prep "系统设计面试"` |

---

## 五、数据文件

WorkBuddy 在 `.workbuddy/` 目录下持久化数据：

```
.workbuddy/
├── memory/        ← 对话记忆
├── sessions/      ← 会话状态
└── todos/         ← 待办事项
```

删除 `.workbuddy/` 会清空所有数据，不影响程序运行。

---

## 六、故障排除

### "LLM not configured"
解决方案：
1. 检查 `.env` 文件是否存在
2. 确认 `WORKBUDDY_LLM_API_KEY` 已填写正确的 Key
3. 用 `node runtime/dist/cli.js config` 查看当前配置

### "Skill 'xxx' not found"
解决方案：
1. 用 `list` 命令查看所有可用技能
2. 检查技能名拼写是否正确

### 运行超时
解决方案：
- 加 `--timeout=60000` 延长超时
- 或在 `.env` 中设 `WORKBUDDY_TIMEOUT=60000`

### 中文乱码
解决方案：
- Windows 终端：运行 `chcp 65001` 切换到 UTF-8
- 或用 Windows Terminal 代替 CMD

---

## 七、技巧

1. **配置文件优先**：把常用配置写进 `.env`，不用每次手设环境变量
2. **JSON 输出**：配合 `jq` 解析：`node runtime/dist/cli.js --json list | jq '.[].slug'`
3. **会话管理**：用 `--session` 标签隔离不同任务
4. **超时保护**：长时间任务手动设 `--timeout`
5. **多轮对话**：先用 `chat` 模式试，确认效果再正式跑

---

*本文档由执行者编写，供最终用户参考。*
