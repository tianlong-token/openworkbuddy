# WorkBuddy

**Open-source AI Assistant Framework**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/Node.js-%3E%3D18-green)](https://nodejs.org)
[![CI](https://github.com/your-org/workbuddy/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)
[![Skills: 147](https://img.shields.io/badge/Skills-147-blue)](skills/)
[![Tests: 89](https://img.shields.io/badge/Tests-89%2F89%20passing-brightgreen)](runtime/src/test/)

---

## 简介

WorkBuddy 是一个开源的 AI 助手框架，内置 **147+ 技能**、**Agent Loop**、**12 工具执行器**、**会话管理**和**持久化记忆**。完全独立、无厂商锁定、OpenAI-compatible API 接口。

当前版本：**v0.2.0-alpha** | 许可证：**MIT**

---

## 快速开始

### 安装

```bash
git clone https://github.com/your-org/workbuddy.git
cd workbuddy
npm install
npm run build
```

### 配置

```bash
cp .env.example .env
# 编辑 .env，填入你的 LLM API Key（DeepSeek / OpenAI / 本地 Ollama）
```

### 运行

```bash
# Windows
start.bat

# macOS / Linux
chmod +x start.sh && ./start.sh

# 或直接使用 CLI
node runtime/dist/cli.js list
node runtime/dist/cli.js chat deep-research
node runtime/dist/cli.js run askuserquestion "你好，请介绍一下自己"
```

---

## 核心功能

### 🧠 147+ 预装技能

覆盖编程、写作、研究、数据分析、翻译、代码审查等领域。所有技能基于 `SKILL.md` 规范，可自由扩展。

### 🔧 12 个工具执行器

| 工具 | 功能 |
|------|------|
| `Read` | 读取文件/目录，路径穿越保护 |
| `Write` | 文件写入 |
| `Edit` | 精确文本替换 |
| `Bash` | Shell 命令执行，超时保护 |
| `Glob` | 文件模式匹配 |
| `Grep` | 正则内容搜索 |
| `WebFetch` | HTTP 网页抓取 |
| `WebSearch` | DuckDuckGo 搜索 |
| `Agent` | 子代理调度（复用 AgentLoop） |
| `Skill` | 技能间互相调用 |
| `TodoWrite` | 待办管理（磁盘持久化） |
| `Task` | 任务分解（占位符，v0.2.0-beta） |

### 💬 CLI 命令

| 命令 | 说明 |
|------|------|
| `workbuddy list` | 列出所有 147 个技能 |
| `workbuddy search <query>` | 搜索技能（支持中英文） |
| `workbuddy info <slug>` | 查看技能详情 |
| `workbuddy run <slug> [msg]` | 运行单个技能 |
| `workbuddy chat <slug>` | 交互式多轮对话 |
| `workbuddy sessions` | 查看活跃会话 |
| `workbuddy config` | 显示当前配置 |
| `workbuddy todos` | 管理待办列表（6 个子命令） |

**全局标志**：`--json`（JSON 输出）、`--session=<id>`（指定会话）、`--timeout=<ms>`（超时设置）

### 📋 Todos 子命令

```
workbuddy todos list [--status=pending] [--priority=high]
workbuddy todos add "xxx" [--priority=high|medium|low]
workbuddy todos complete 1 2 3
workbuddy todos cancel 2
workbuddy todos delete 4
workbuddy todos clear [--all]
```

### 🔐 会话管理

- 状态机：`idle` → `working` → `completed`
- TTL 过期自动清理（默认 24h）
- 并发限制（默认 10）
- 磁盘持久化：`.workbuddy/sessions/`

### 🧩 记忆系统

- `InMemoryStore`：进程内存储
- `FileMemoryStore`：磁盘 JSON 持久化
- 按 session 查询、按类型过滤
- Agent Loop 自动写入对话记录

### 🔌 LLM 集成

支持任何 OpenAI-compatible API：
- **DeepSeek**：`deepseek-chat` / `deepseek-v4-flash`
- **OpenAI**：`gpt-4o` / `gpt-3.5-turbo`
- **本地**：Ollama / vLLM / LM Studio

---

## 项目结构

```
workbuddy/
├── runtime/                 # 运行时引擎（TypeScript）
│   ├── src/
│   │   ├── cli.ts           # CLI 入口
│   │   ├── index.ts         # WorkBuddyRuntime 类
│   │   ├── config.ts        # 配置系统（含 .env 自动加载）
│   │   ├── types.ts         # 类型定义
│   │   ├── tool-router.ts   # 工具路由
│   │   ├── tool-executors.ts# 12 个工具执行器
│   │   ├── agent-loop.ts    # Agent 循环
│   │   ├── llm/             # LLM 提供商
│   │   ├── memory/          # 记忆管理
│   │   ├── session/         # 会话管理
│   │   ├── orchestrator/    # 多智能体编排
│   │   └── test/            # 89 个单元测试
│   └── package.json
├── skills/                  # 147 个预装技能
├── proxy-box/               # 沙盒隔离（规划中）
├── agent-sdk/               # 外部 Agent SDK（规划中）
├── connectors/              # 第三方连接器（规划中）
├── scripts/                 # 工具脚本
├── docs/                    # 开发文档
├── .github/workflows/       # CI 配置
├── .env.example             # 环境变量模板
├── start.bat / start.sh     # 一键启动
├── LICENSE                  # MIT 许可证
└── README.md
```

---

## 测试

```bash
# 运行全部测试（必须顺序执行）
cd runtime && npx vitest run --sequence.concurrent=false

# 预期结果：89/89 tests passing（7 个测试文件）
```

| 测试模块 | 数量 |
|----------|------|
| tool-executors | 21 |
| e2e | 21 |
| agent-loop | 13 |
| session-manager | 12 |
| llm-provider | 9 |
| memory-manager | 7 |
| skill-script-runner | 6 |

---

## 路线图

| 版本 | 状态 | 关键功能 |
|------|------|----------|
| v0.1.0 | ✅ 已发布 | 11 工具 + Agent Loop + Memory + CLI |
| v0.2.0-alpha | ✅ 已发布 | Session 管理 + TodoWrite + Skill/Agent 工具 + E2E 测试 |
| v0.2.0-beta | 🔄 规划中 | 沙盒隔离 + Task 工具实现 + TodoWrite CLI |
| v0.2.0-rc | 📋 规划中 | REST API + WebSocket + Webhook |
| v1.0.0 | 🎯 目标 | 生产就绪 + 文档完善 |

---

## 贡献

欢迎贡献代码、技能或文档！详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

### 报告问题

在 [GitHub Issues](https://github.com/your-org/workbuddy/issues) 中报告，包含：
- 问题描述
- 复现步骤
- 预期 vs 实际行为
- 环境信息（Node.js 版本、操作系统）

---

## License

[MIT](LICENSE) — Copyright (c) 2026 WorkBuddy Contributors
