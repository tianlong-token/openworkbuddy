# WorkBuddy 架构设计

## 系统概览

WorkBuddy 是一个模块化的 AI 助手框架，由以下核心组件组成：

```
┌─────────────────────────────────────────────────────┐
│                    CLI Interface                     │
│              workbuddy run|list|search               │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  Runtime Engine                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐ │
│  │SkillLoader │  │ToolRouter  │  │MemoryManager   │ │
│  └─────┬──────┘  └─────┬──────┘  └───────┬────────┘ │
│        │               │                 │           │
│  ┌─────▼───────────────▼─────────────────▼────────┐ │
│  │              SessionContext                     │ │
│  └────────────────────────┬───────────────────────┘ │
│                           │                          │
│  ┌────────────────────────▼───────────────────────┐ │
│  │              Orchestrator                       │ │
│  │  (Fork / Linear / DAG / Team)                   │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                    Proxy Box                         │
│           Express + WebSocket + MCP SDK              │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  External Tools                      │
│    Read  Write  Edit  Bash  Glob  Grep  WebFetch    │
└─────────────────────────────────────────────────────┘
```

## 核心模块

### 1. SkillLoader (`skill-loader.ts`)

**职责**：加载、解析、验证技能定义

- 解析 SKILL.md 的 YAML frontmatter
- 验证技能格式（name、description、version、allowed-tools）
- 支持技能搜索（slug、name、description、tags、category）
- 批量加载并报告校验错误

### 2. ToolRouter (`tool-router.ts`)

**职责**：工具路由、权限检查、参数验证

- 维护 12 个基础工具的 Schema 定义
- 根据技能声明的 `allowed-tools` 过滤可用工具
- 执行前参数验证（必填字段、类型检查）
- 支持自定义工具执行器注册

### 3. MemoryManager (`memory-manager.ts`)

**职责**：会话记忆管理

- `InMemoryStore`：内存存储（适合测试和短期会话）
- `FileMemoryStore`：文件持久化存储（跨会话保留）
- 支持按类型搜索（fact、conversation、preference、decision）
- 支持按日期范围过滤

### 4. Orchestrator (`orchestrator.ts`)

**职责**：多智能体任务编排

支持四种编排模式：

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| **Linear** | 按依赖拓扑顺序串行执行 | 有明确先后依赖的任务链 |
| **Fork** | 根任务并行执行，无依赖关系 | 独立的子任务 |
| **DAG** | 有向无环图，依赖就绪后触发 | 复杂依赖关系 |
| **Team** | 按角色分配任务，支持交接协议 | 多角色协作 |

### 5. Proxy Box (`proxy-box/`)

**职责**：沙盒代理服务，隔离工具执行

- Express HTTP 服务
- WebSocket 实时通信
- MCP SDK 集成
- 多会话管理（bound-session、dynamic-session、idle-gate）

## 数据流

```
用户请求
  │
  ▼
CLI 解析命令 (run/list/search/info)
  │
  ▼
Runtime 加载技能 (SkillLoader)
  │
  ▼
验证工具权限 (ToolRouter)
  │
  ▼
创建会话上下文 (SessionContext)
  │
  ▼
执行任务编排 (Orchestrator)
  │
  ▼
工具调用 → Proxy Box → 外部工具
  │
  ▼
结果缓存到 Memory
  │
  ▼
返回输出给用户
```

## 配置管理

通过环境变量或代码配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `WORKBUDDY_SKILLS_DIR` | 技能目录路径 | 自动探测 |
| `WORKBUDDY_MEMORY_STORE` | 存储类型 | `memory` |
| `WORKBUDDY_MEMORY_API_URL` | 远程记忆 API | 无 |
| `WORKBUDDY_LOG_LEVEL` | 日志级别 | `info` |
| `WORKBUDDY_ALLOWED_TOOLS` | 允许的工具列表 | 全部 12 个 |
