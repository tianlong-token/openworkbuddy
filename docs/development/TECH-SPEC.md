# WorkBuddy 技术规格说明书

> 版本: v1.0.0 | 日期: 2026-05-02 | 状态: 执行中

---

## 📊 项目状态矩阵

| 模块 | 文件 | 状态 | 完成度 | 质量 |
|------|------|------|--------|------|
| **Read 执行器** | `tool-executors.ts` | ✅ | 100% | ⭐⭐⭐⭐ |
| **Write 执行器** | `tool-executors.ts` | ✅ | 100% | ⭐⭐⭐⭐ |
| **Edit 执行器** | `tool-executors.ts` | ✅ | 100% | ⭐⭐⭐⭐ |
| **Bash 执行器** | `tool-executors.ts` | ✅ | 100% | ⭐⭐⭐⭐ |
| **Glob 执行器** | `tool-executors.ts` | ✅ | 100% | ⭐⭐⭐ |
| **Grep 执行器** | `tool-executors.ts` | ✅ | 100% | ⭐⭐⭐ |
| **WebFetch 执行器** | `tool-executors.ts` | ✅ | 100% | ⭐⭐⭐ |
| **WebSearch 执行器** | `tool-executors.ts` | ✅ | 100% | ⭐⭐⭐ |
| **LLM Provider** | `llm/llm-provider.ts` | ✅ | 100% | ⭐⭐⭐⭐⭐ |
| **Agent Loop** | `agent-loop.ts` | ✅ | 100% | ⭐⭐⭐⭐⭐ |
| **Runtime 集成** | `index.ts` | ✅ | 100% | ⭐⭐⭐⭐ |
| **CLI 增强** | `cli.ts` | ✅ | 100% | ⭐⭐⭐⭐⭐ |
| **Agent 执行器** | `tool-executors.ts` | ❌ | 0% | - |
| **Skill 执行器** | `tool-executors.ts` | ❌ | 0% | - |
| **TodoWrite 执行器** | `tool-executors.ts` | ❌ | 0% | - |

---

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI Interface (cli.ts)                   │
│  chat | run | list | search | info | config                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   WorkBuddyRuntime (index.ts)               │
│  - initialize() → 加载技能 + LLM                           │
│  - runSkill() → 构建 prompt → AgentLoop.run()              │
│  - getToolRouter() → 返回工具路由器                        │
└───────┬──────────────────────┬──────────────────────────────┘
        │                      │
┌───────▼──────────┐  ┌────────▼──────────────┐
│   AgentLoop      │  │   ToolRouter          │
│  (agent-loop.ts) │  │  (tool-router.ts)     │
│                  │  │                       │
│  - run()         │  │  - execute()          │
│  - continue()    │  │  - register()         │
│  - reset()       │  │  - validateArgs()     │
└───────┬──────────┘  └────────┬──────────────┘
        │                      │
┌───────▼──────────┐  ┌────────▼──────────────┐
│   LLM Provider   │  │   Tool Executors      │
│ (llm-provider.ts)│  │ (tool-executors.ts)   │
│                  │  │                       │
│  - chat()        │  │  Read    │ Write      │
│  - setTools()    │  │  Edit    │ Bash       │
│  - convertTools()│  │  Glob    │ Grep       │
└──────────────────┘  │  WebFetch│ WebSearch  │
                      │  Agent   │ Skill      │ ← 待实现
                      │  TodoWrite            │ ← 待实现
                      └───────────────────────┘
```

---

## 📝 待实现工具接口规范

### 1. Agent 执行器（子 Agent 派发）

```typescript
// 接口定义
export interface AgentExecutorArgs {
  prompt: string;          // 子 Agent 的任务描述
  subagentType?: string;   // Agent 类型（默认：general）
  maxTurns?: number;       // 最大轮数（默认：10）
}

// 实现逻辑
export const agentExecutor: ToolExecutor = async (args): Promise<ToolResult> => {
  // 1. 创建新的 AgentLoop 实例
  // 2. 继承当前运行时配置（LLM、工具等）
  // 3. 执行子任务
  // 4. 返回结果
}
```

### 2. Skill 执行器（技能调用）

```typescript
// 接口定义
export interface SkillExecutorArgs {
  name: string;            // 技能名称
  args?: Record<string, unknown>;  // 技能参数
}

// 实现逻辑
export const skillExecutor: ToolExecutor = async (args): Promise<ToolResult> => {
  // 1. 通过 skill-loader 加载技能
  // 2. 解析 SKILL.md 获取工作流
  // 3. 执行技能（复用 AgentLoop）
  // 4. 返回结果
}
```

### 3. TodoWrite 执行器（任务列表管理）

```typescript
// 接口定义
export interface TodoWriteArgs {
  todos: Array<{
    content: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    priority?: 'low' | 'medium' | 'high';
  }>;
}

// 实现逻辑
export const todoWriteExecutor: ToolExecutor = async (args): Promise<ToolResult> => {
  // 1. 解析 todos 数组
  // 2. 存储到内存/文件
  // 3. 返回当前任务列表
}
```

---

## 👥 两人协作分工

### 👔 我（架构师）- 主导

| 任务 | 输出物 | 时间 | 状态 |
|------|--------|------|------|
| **1. 接口规范设计** | 本文档 | 已完成 | ✅ |
| **2. 代码审查** | 审查报告 | 30 分钟 | 🔄 |
| **3. 原版源码分析** | 分析报告 | 2 小时 | 🔄 |
| **4. 测试方案设计** | 测试用例文档 | 1 小时 | ⏳ |
| **5. 文档规范制定** | 编码规范文档 | 1 小时 | ⏳ |
| **6. 最终集成测试** | 测试报告 | 1 小时 | ⏳ |

### 👨‍💻 同事（执行者）- 配合

| 任务 | 输出物 | 时间 | 依赖 | 状态 |
|------|--------|------|------|------|
| **1. Agent 执行器** | `agentExecutor` 函数 | 2 小时 | 接口规范 | ⏳ |
| **2. Skill 执行器** | `skillExecutor` 函数 | 1.5 小时 | 接口规范 | ⏳ |
| **3. TodoWrite 执行器** | `todoWriteExecutor` 函数 | 30 分钟 | 接口规范 | ⏳ |
| **4. Windows 兼容改造** | 原生实现替换 | 2 小时 | - | ⏳ |
| **5. 单元测试** | `*.spec.ts` 文件 | 3 小时 | 所有执行器 | ⏳ |

---

## 🔄 协作流程

```
[我] 设计接口规范
        │
        ▼
[同事] 实现工具执行器
        │
        ▼
[我] 代码审查
        │
    ┌───┴───┐
    │ 通过？ │
    └───┬───┘
        │
    ┌───▼───┐
    │  是   │ → [同事] 编写单元测试
    └───────┘
        │
    ┌───▼───┐
    │  否   │ → [我] 提供修改意见
    └───┬───┘
        │
        ▼
[同事] 修复问题
        │
        ▼
[我] 再次审查
        │
        ▼
[我] 集成测试
        │
        ▼
[我] 编写技术文档
```

---

## ✅ 代码审查清单

### 功能性
- [ ] 工具执行器正确处理所有参数
- [ ] 错误处理完整（缺少参数、文件不存在、超时等）
- [ ] 返回值格式符合 `ToolResult` 接口

### 质量
- [ ] TypeScript 类型安全（无 `any` 滥用）
- [ ] 代码风格一致（命名、缩进、注释）
- [ ] 无硬编码路径/URL
- [ ] 有适当的日志输出

### 兼容性
- [ ] Windows/Linux/macOS 三平台可用
- [ ] 不依赖特定 shell 命令
- [ ] 使用 Node.js 原生 API 优先

### 安全
- [ ] 无命令注入漏洞（Bash 参数需转义）
- [ ] 文件路径验证（防止目录遍历）
- [ ] 超时控制（防止无限等待）

---

## 📅 时间规划

| 阶段 | 时间 | 里程碑 |
|------|------|--------|
| **Phase 1: 设计** | 现在 | 接口规范完成（本文档） |
| **Phase 2: 实现** | +4 小时 | 3 个工具执行器完成 |
| **Phase 3: 审查** | +1 小时 | 代码审查通过 |
| **Phase 4: 测试** | +3 小时 | 单元测试通过 |
| **Phase 5: 集成** | +2 小时 | 全量测试通过 |
| **Phase 6: 文档** | +2 小时 | 技术文档完成 |

**总计：约 12 小时完成全部工作**

---

## 📚 输出文档清单

| 文档 | 负责人 | 内容 |
|------|--------|------|
| **TECH-SPEC.md** | 我 | 技术规格说明书（本文档） |
| **API-REFERENCE.md** | 我 | API 参考文档 |
| **CODE-REVIEW.md** | 我 | 代码审查报告 |
| **TEST-REPORT.md** | 我 | 测试报告 |
| **IMPLEMENTATION.md** | 同事 | 实现说明 |
| **CHANGELOG.md** | 我 | 变更日志 |
