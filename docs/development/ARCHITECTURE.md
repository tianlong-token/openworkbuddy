# WorkBuddy 项目架构总览

> 版本: v0.2.0-alpha | 更新: 2026-05-02

---

## 一、系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Layer                             │
│   cli.ts (list/search/info/run/chat/config/sessions)        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     WorkBuddyRuntime                         │
│                      index.ts                                │
│  ┌──────────┬───────────┬──────────┬───────────┬──────────┐ │
│  │ Config   │ Skills    │ Tools    │ Memory    │ Sessions │ │
│  │ config.ts│loader.ts  │router.ts │manager.ts │manager.ts│ │
│  └──────────┴───────────┴──────────┴───────────┴──────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Agent Loop (agent-loop.ts)                              │ │
│  │  run() → executeLoop() → LLM → Tool → 循环 → 结果       │ │
│  │  异步记忆保存 (saveConversationToMemory)                 │ │
│  │  异步记忆加载 (loadMemoryContext)                       │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ LLM Provider (llm-provider.ts)                          │ │
│  │ OpenAI-compatible → DeepSeek / GPT-4o / etc.            │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Tool Executors (tool-executors.ts)                      │ │
│  │ Read/Write/Edit/Bash/Glob/Grep/WebFetch/WebSearch       │ │
│  │ Agent/Skill/TodoWrite (11 tools total)                  │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Infrastructure                            │
│  .env → config.ts → env vars                                 │
│  .workbuddy/memory/   → FileMemoryStore                      │
│  .workbuddy/sessions/ → SessionManager 持久化                │
│  .workbuddy/todos/    → TodoWrite 持久化                     │
│  skills/              → 148 个预装技能                       │
└─────────────────────────────────────────────────────────────┘
```

## 二、模块职责

### 2.1 CLI (cli.ts)
用户交互入口。解析命令行参数和全局标志 (`--json`, `--session`, `--timeout`)，调用 Runtime 执行。

### 2.2 WorkBuddyRuntime (index.ts)
系统总控。管理所有子模块的生命周期：
- 构造：加载配置 → 初始化工具路由 → 注册 11 个工具 → 创建记忆存储 → 创建会话管理器
- 初始化：加载技能 → 初始化 LLM Provider → 创建 Agent Loop
- 运行：`runSkill()` 执行技能，带超时保护和会话状态跟踪

### 2.3 配置系统 (config.ts)
- 自动加载 `.env` 文件（不覆盖已设置的环境变量）
- 读取 `WORKBUDDY_*` 系列环境变量
- 提供 `loadConfig()` / `mergeConfig()` 接口

### 2.4 技能系统 (skill-loader.ts)
- 加载 `skills/*/SKILL.md` 文件
- 解析 Frontmatter (YAML 头部)
- 支持搜索、验证、元数据读取
- 检测 `scripts/` / `references/` / `assets/` / `templates/` 目录

### 2.5 工具系统 (tool-router.ts + tool-executors.ts)
11 个工具通过 `ToolRouter` 注册和执行：
- **Read**: 安全文件读取（路径穿越保护）
- **Write**: 文件写入
- **Edit**: 文本替换
- **Bash**: Shell 命令执行
- **Glob**: 文件模式匹配
- **Grep**: 正则搜索文件内容
- **WebFetch**: HTTP 内容抓取（HTML 标签剥离）
- **WebSearch**: DuckDuckGo 搜索
- **Agent**: 子代理调度（复用 AgentLoop）
- **Skill**: 技能间互相调用（通过 Runtime.runSkill）
- **TodoWrite**: Todo 列表持久化（写入磁盘 JSON）

### 2.6 LLM 集成 (llm-provider.ts)
- OpenAI-compatible API 调用
- 支持流式响应（可选）
- 支持工具调用 (tool_calls)
- 已验证：DeepSeek Chat

### 2.7 Agent Loop (agent-loop.ts)
- `run()`: 新建对话，可选加载历史记忆
- `continue()`: 延续对话
- `reset()`: 清空历史
- 自动记忆读写（异步不阻塞主流程）
- 错误处理：LLM 异常捕获 + 结构化错误返回

### 2.8 记忆管理 (memory-manager.ts)
- `InMemoryStore`: 进程内存储
- `FileMemoryStore`: 磁盘 JSON 持久化 (`.workbuddy/memory/`)
- 支持按 sessionId 查询和清理
- `_loadRaw()` 保留原始 ID

### 2.9 会话管理 (session/session-manager.ts)
- 状态机：idle → planning → working → completed/failed/timed_out
- 磁盘持久化 (`.workbuddy/sessions/`)
- TTL 过期自动清理（默认 24h）
- 并发数限制（默认 10）
- CLI 命令：`workbuddy sessions`

### 2.10 技能脚本执行器 (skill-script-runner.ts)
- 执行技能 `scripts/` 目录下的 `.js/.ts/.sh/.bat` 脚本
- 使用 `spawn()` 传参数组，消除命令注入风险
- 30s 超时保护

### 2.11 多智能体编排 (orchestrator/orchestrator.ts)
- `runTaskWithTimeout()`: 带超时的任务执行
- Agent Loop 实例化与调度

## 三、数据流

### 3.1 run 命令数据流
```
CLI run <skill> "hello"
  → WorkBuddyRuntime.runSkill(slug, message)
    → SessionManager.updateStatus('working')
    → buildSystemPrompt(skill)
    → AgentLoop.run(systemPrompt, userMessage)
      → [可选] MemoryStore.search() 加载历史
      → LLMProvider.chat()
      → [循环] ToolRouter.execute() 处理工具调用
      → [结束] 返回结果
    → MemoryStore.add() 保存对话
    → SessionManager.updateStatus('completed')
  → CLI 输出结果
```

### 3.2 Memory 对接数据流
```
run() 开始时
  → loadMemoryContext(systemPrompt)
    → MemoryStore.search(systemPrompt.substring(0,60), { limit: 3 })
    → 找到 → 注入 extra system message 到 messages[]
    → 未找到 → 静默跳过 (不阻塞)

executeLoop() 完成后
  → saveConversationToMemory(result)
    → 提取 messages[] 中的 user+assistant 对话
    → MemoryStore.add({ type: 'conversation', content, metadata })
    → 失败 → 静默跳过 (不阻塞)
```

## 四、目录结构

```
workbuddy/
├── runtime/src/           # 核心源码
│   ├── index.ts           # WorkBuddyRuntime
│   ├── cli.ts             # 命令行接口
│   ├── config.ts          # 配置加载
│   ├── types.ts           # 类型定义
│   ├── agent-loop.ts      # Agent 循环
│   ├── skill-loader.ts    # 技能加载器
│   ├── skill-script-runner.ts  # 脚本执行器
│   ├── tool-router.ts     # 工具路由
│   ├── tool-executors.ts  # 11 个工具执行器
│   ├── llm/llm-provider.ts     # LLM 集成
│   ├── memory/memory-manager.ts    # 记忆管理
│   ├── session/session-manager.ts  # 会话管理
│   ├── orchestrator/orchestrator.ts    # 多智能体编排
│   └── test/              # 68 个单元测试
├── skills/                # 148 个预装技能
├── docs/development/      # 15 篇开发文档
├── .gitignore
├── LICENSE                # MIT
├── .env.example           # 环境变量模板
├── start.bat              # Windows 启动
├── start.sh               # Linux/Mac 启动
└── scripts/               # 工具脚本
    └── cleanup-skill-prompts.js
```

## 五、关键设计决策

1. **零外部依赖**: 除 `express` 和 `ws`（proxy-box 沙盒）外，核心运行时无 npm 依赖
2. **文件覆盖控制**: 每个模块由固定的成员负责，避免冲突
3. **异步记忆操作**: 记忆读写不阻塞主 Agent 循环
4. **内置超时保护**: CLI `--timeout` + `runSkill()` Promise.race 双重保障
5. **安全优先**: 路径穿越防护、命令注入修复、参数验证

---

*本文档由执行者编写，供开发者了解系统全貌。*
