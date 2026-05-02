# ROADMAP — 给其他编程助手的任务清单

> 项目路径：`C:/Users/every/Desktop/workbuddy开源复刻版`
> 构建命令：`npm run build`（必须在项目根目录执行）
> 测试命令：`cd runtime && npx vitest run --sequence.concurrent=false`
> 当前版本：**v0.2.0-alpha** | 测试：**89/89 passing**

---

## 优先级总览

```
P0  — 必须完成，否则无法端到端运行
P1  — 重要，核心功能缺失
P2  — 优化，体验提升
```

---

## P0 — 已完成 ✅

### ~~P0-1：配置并测试 LLM 连接~~ ✅ 已完成

DeepSeek v4-flash 已配置，`.env` 自动加载已实现。

### ~~P0-2：修复 Orchestrator 的 `runTaskWithTimeout`~~ ✅ 已完成

`runTaskWithTimeout` 已实现超时任务执行。

### ~~P0-3：修复 `chat` 命令的多轮对话~~ ✅ 已完成

`chat` 命令支持多轮对话，`/exit` 和 `/clear` 正常工作。

---

## P1 — 已完成 ✅

### ~~P1-1：实现 WebSearch 工具执行器~~ ✅ 已完成

DuckDuckGo HTML 接口已实现。

### ~~P1-2：对接 MemoryStore 到 AgentLoop~~ ✅ 已完成

Agent Loop 自动写入对话记录到 MemoryStore。

### ~~P1-3：修复 `FileMemoryStore.loadFromDisk()` 的 Bug~~ ✅ 已完成

`_loadRaw()` 方法保留原始 ID，`FileMemoryStore` 正确加载。

---

## P1 — 待完成（v0.2.0-beta）

### P1-4：实现 Task 工具

**目标**：补全最后一个占位符工具，支持任务分解 + DAG 执行。

**涉及文件**：`runtime/src/tool-executors.ts`（Task executor）、`runtime/src/types.ts`

**预计时间**：15-20h

---

### P1-5：TodoWrite CLI

**目标**：新增 `workbuddy todos` 命令，6 个子命令（list/add/complete/cancel/delete/clear）。

**状态**：✅ 已完成（v0.2.0-alpha）

---

## P2 — 优化和新功能

### P2-1：实现 `proxy-box` 沙盒

**目标**：让工具执行在隔离环境中运行，而非本地直接执行。

**架构**：
```
runtime (工具调用请求) → HTTP → proxy-box (隔离执行) → 返回结果
```

**涉及文件**：`proxy-box/src/index.js`（重写）、`runtime/src/tool-executors.ts`（可选通过 proxy-box 执行）

---

### P2-2：实现 `agent-sdk/lib`

**目标**：提供 TypeScript SDK，让外部 Agent 能接入 WorkBuddy。

**涉及文件**：`agent-sdk/lib/*.ts`（新建）

---

### P2-3：补全 `connectors/` 第三方连接器

**目标**：实现腾讯乐享、QQ 邮箱、TAPD、腾讯文档、微云的连接器。

**涉及文件**：`connectors/<platform>/`（新建）

---

### ~~P2-4：优化 CLI 体验~~ ✅ 已完成

`--json` 输出已全部支持，`--session` 和 `--timeout` 全局标志已实现，`sessions` 和 `todos` 命令已添加。

---

## 给其他编程助手的建议

1. **每次修改后运行 `npm run build`**，确保 TypeScript 无错误
2. **先读 `STATUS.md`**，了解哪些是好桩、哪些是真的
3. **不要相信 README.md 里的功能列表**——有些是计划，不是已实现
4. **遇到疑问先读代码**，代码比文档更可靠
5. **完成一个任务后，更新 `STATUS.md`**，让其他人知道进度

---

## 快速参考

| 命令 | 用途 |
|------|------|
| `npm run build` | 构建整个项目 |
| `node runtime/dist/cli.js list` | 列出所有技能 |
| `node runtime/dist/cli.js search "xxx"` | 搜索技能 |
| `node runtime/dist/cli.js info <slug>` | 查看技能详情 |
| `node runtime/dist/cli.js config` | 查看当前配置 |
| `node runtime/dist/cli.js run <slug> "消息"` | 运行技能 |
| `node runtime/dist/cli.js sessions` | 查看活跃会话 |
| `node runtime/dist/cli.js todos list` | 查看待办列表 |
| `cd runtime && npx vitest run --sequence.concurrent=false` | 运行测试 |

---

*本文档由 AI 助手编写，供所有参与 WorkBuddy 开源复刻的编程助手参考。*
