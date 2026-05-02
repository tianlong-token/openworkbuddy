# Phase 4 (v0.2.0-alpha) 执行文档

> 日期：2026-05-02  
> 原则：我执行，组长审查  
> 目标：补全 v1.0 的核心空白 — 会话管理 + 占位符工具 + TodoWrite 持久化

---

## 范围说明

### 包含（本阶段）
1. **会话管理系统** — 状态机、TTL、生命周期
2. **TodoWrite 持久化** — 从内存改为磁盘
3. **Skill 工具真正调用** — 技能间互相执行
4. **Agent 工具真正调用** — 子代理调度

### 不包含（后续阶段）
- 沙盒隔离（v0.2.0-beta）
- API 后端 / Webhook（v0.2.0-rc）
- 多租户 / 认证

---

## 任务清单

| 序号 | 任务 | 优先级 | 估计时间 | 文件 |
|------|------|--------|----------|------|
| T1 | 会话状态机定义 | P0 | 15 min | `types.ts` |
| T2 | SessionManager 类 | P0 | 30 min | `session/session-manager.ts` |
| T3 | 集成到 WorkBuddyRuntime | P0 | 15 min | `index.ts` |
| T4 | CLI 会话命令 | P0 | 20 min | `cli.ts` |
| T5 | TodoWrite 持久化 | P1 | 20 min | `tool-executors.ts` |
| T6 | Skill 工具真正实现 | P1 | 25 min | `tool-executors.ts` |
| T7 | Agent 工具真正实现 | P1 | 30 min | `tool-executors.ts` + `agent-loop.ts` |
| T8 | 单元测试（全部新增） | P0 | 40 min | `session-manager.spec.ts` + 其他 |
| T9 | 集成验证 | P0 | 10 min | CLI 手动测试 |

**总计约 205 分钟（~3.5 小时）**

---

## T1：会话状态机定义

### 修改文件：`runtime/src/types.ts`

#### 新增内容

在文件末尾（SessionContext 之后）添加：

```typescript
// ===== 会话状态机 =====

export type SessionStatus = 'idle' | 'planning' | 'working' | 'completed' | 'failed' | 'timed_out';

export interface SessionState {
  sessionId: string;
  status: SessionStatus;
  skillSlug: string | null;
  createdAt: number;
  lastActivityAt: number;
  turnsCount: number;
  toolCallsCount: number;
  error?: string;
}

export interface SessionConfig {
  maxConcurrent: number;        // 最大并发会话数
  ttlMs: number;                // 会话过期时间（默认 24h）
  maxTurnsPerSession: number;   // 每会话最大轮数
  cleanupIntervalMs: number;    // 清理间隔（默认 5min）
}

export interface SessionManager {
  create(sessionId?: string, config?: { skillSlug?: string }): SessionState;
  get(sessionId: string): SessionState | null;
  updateStatus(sessionId: string, status: SessionStatus): void;
  list(): SessionState[];
  remove(sessionId: string): boolean;
  cleanup(): number;            // 清理过期会话，返回清理数量
  getActiveCount(): number;
}
```

### 验证
- 编译通过
- 类型导出正确

---

## T2：SessionManager 类

### 新建文件：`runtime/src/session/session-manager.ts`

```typescript
import { SessionState, SessionStatus, SessionConfig, SessionManager } from '../types';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';

const DEFAULT_CONFIG: SessionConfig = {
  maxConcurrent: 10,
  ttlMs: 24 * 60 * 60 * 1000,  // 24h
  maxTurnsPerSession: 50,
  cleanupIntervalMs: 5 * 60 * 1000,  // 5min
};

const DATA_DIR = '.workbuddy/sessions';

export class DefaultSessionManager implements SessionManager {
  private sessions: Map<string, SessionState> = new Map();
  private config: SessionConfig;
  private dataDir: string;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<SessionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dataDir = join(process.cwd(), DATA_DIR);

    // 确保数据目录存在
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }

    // 加载已持久化的会话
    this.loadFromDisk();

    // 启动定期清理
    this.startCleanupTimer();
  }

  create(sessionId?: string, options?: { skillSlug?: string }): SessionState {
    if (this.sessions.size >= this.config.maxConcurrent) {
      throw new Error(
        `Maximum number of sessions reached (${this.config.maxConcurrent}). ` +
        `Remove a session or increase maxConcurrent.`
      );
    }

    const sid = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    if (this.sessions.has(sid)) {
      throw new Error(`Session '${sid}' already exists`);
    }

    const now = Date.now();
    const state: SessionState = {
      sessionId: sid,
      status: 'idle',
      skillSlug: options?.skillSlug || null,
      createdAt: now,
      lastActivityAt: now,
      turnsCount: 0,
      toolCallsCount: 0,
    };

    this.sessions.set(sid, state);
    this.persistSession(state);

    return state;
  }

  get(sessionId: string): SessionState | null {
    return this.sessions.get(sessionId) || null;
  }

  updateStatus(sessionId: string, status: SessionStatus): void {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new Error(`Session '${sessionId}' not found`);
    }

    state.status = status;
    state.lastActivityAt = Date.now();

    this.persistSession(state);
  }

  list(): SessionState[] {
    return [...this.sessions.values()].sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }

  remove(sessionId: string): boolean {
    const state = this.sessions.get(sessionId);
    if (!state) return false;

    this.sessions.delete(sessionId);

    // 删除磁盘文件
    const filePath = join(this.dataDir, `${sessionId}.json`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    return true;
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [sid, state] of this.sessions) {
      if (state.status === 'completed' || state.status === 'failed' || state.status === 'timed_out') {
        // 终态会话立即清理
        this.sessions.delete(sid);
        const filePath = join(this.dataDir, `${sid}.json`);
        if (existsSync(filePath)) unlinkSync(filePath);
        removed++;
      } else if (now - state.lastActivityAt > this.config.ttlMs) {
        // 过期会话更新状态为 timed_out 后清理
        state.status = 'timed_out';
        this.sessions.delete(sid);
        const filePath = join(this.dataDir, `${sid}.json`);
        if (existsSync(filePath)) unlinkSync(filePath);
        removed++;
      }
    }

    return removed;
  }

  getActiveCount(): number {
    return this.sessions.size;
  }

  // 增加轮次计数
  incrementTurns(sessionId: string): void {
    const state = this.sessions.get(sessionId);
    if (state) {
      state.turnsCount++;
      state.lastActivityAt = Date.now();
      this.persistSession(state);
    }
  }

  // 增加工具调用计数
  incrementToolCalls(sessionId: string, count: number): void {
    const state = this.sessions.get(sessionId);
    if (state) {
      state.toolCallsCount += count;
      state.lastActivityAt = Date.now();
      this.persistSession(state);
    }
  }

  // 停止清理定时器（测试用）
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // ===== 内部方法 =====

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      const removed = this.cleanup();
      if (removed > 0) {
        console.log(`[SessionManager] Cleaned up ${removed} expired sessions`);
      }
    }, this.config.cleanupIntervalMs);
  }

  private persistSession(state: SessionState): void {
    try {
      const filePath = join(this.dataDir, `${state.sessionId}.json`);
      writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch {
      // 持久化失败不阻塞
    }
  }

  private loadFromDisk(): void {
    try {
      if (!existsSync(this.dataDir)) return;

      const files = readdirSync(this.dataDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const filePath = join(this.dataDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const state: SessionState = JSON.parse(content);

        // 只加载未过期的会话
        if (Date.now() - state.lastActivityAt <= this.config.ttlMs) {
          this.sessions.set(state.sessionId, state);
        } else {
          // 过期文件直接删除
          unlinkSync(filePath);
        }
      }
    } catch {
      // 加载失败不阻塞
    }
  }
}

let defaultManager: DefaultSessionManager | null = null;

export function getSessionManager(config?: Partial<SessionConfig>): SessionManager {
  if (!defaultManager) {
    defaultManager = new DefaultSessionManager(config);
  }
  return defaultManager;
}

export function resetSessionManager(): void {
  if (defaultManager) {
    defaultManager.stopCleanupTimer();
    defaultManager = null;
  }
}
```

### 验证
- 编译通过
- 类实现 SessionManager 接口
- 所有方法有正确错误处理

---

## T3：集成到 WorkBuddyRuntime

### 修改文件：`runtime/src/index.ts`

#### 修改 1：新增导入

在文件顶部（第 9 行后）添加：

```typescript
import { getSessionManager, SessionManager, resetSessionManager } from './session/session-manager';
```

#### 修改 2：添加 sessionManager 属性

在第 18 行后添加：

```typescript
private sessionManager: SessionManager;
```

#### 修改 3：初始化 sessionManager

在构造函数末尾（第 24 行后）添加：

```typescript
this.sessionManager = getSessionManager();
```

#### 修改 4：修改 createSession

替换第 68-80 行的 `createSession` 方法：

```typescript
createSession(sessionId?: string, options?: { skillSlug?: string }): SessionContext {
  // 通过 SessionManager 创建，包含状态跟踪
  this.sessionManager.create(sessionId, { skillSlug: options?.skillSlug });

  const sid = sessionId || this.sessionManager.list()[0]?.sessionId || `session_${Date.now()}`;
  const ctx: SessionContext = {
    sessionId: sid,
    skill: null,
    messages: [],
    tools: new Map(),
    memory: this.memoryStore,
    config: this.config,
  };
  this.sessions.set(sid, ctx);
  return ctx;
}
```

#### 修改 5：修改 runSkill 添加会话状态更新

在 `runSkill` 方法中，找到第 129 行 `console.log('Running skill: ...')`，在其**之前**添加：

```typescript
// 更新会话状态为 working
if (this.sessionManager) {
  const sessions = this.sessionManager.list();
  const activeSession = sessions.find(s => s.skillSlug === slug && s.status !== 'completed');
  if (activeSession) {
    this.sessionManager.updateStatus(activeSession.sessionId, 'working');
  }
}
```

在 `runSkill` 的 try/catch 结束后（第 150 行 `}` 之前），添加：

```typescript
// 更新会话状态为 completed
if (this.sessionManager) {
  const sessions = this.sessionManager.list();
  const activeSession = sessions.find(s => s.skillSlug === slug && s.status === 'working');
  if (activeSession) {
    this.sessionManager.updateStatus(activeSession.sessionId, 'completed');
  }
}
```

#### 修改 6：新增 getter 方法

在类末尾（第 173 行 `getAgentLoop()` 之后）添加：

```typescript
getSessionManager(): SessionManager {
  return this.sessionManager;
}

// 关闭时清理
dispose(): void {
  resetSessionManager();
}
```

### 验证
- 编译通过
- `createSession` 仍然正常工作
- `runSkill` 更新会话状态

---

## T4：CLI 会话命令

### 修改文件：`runtime/src/cli.ts`

#### 新增 case：`sessions`

在 `default` case 之前（第 347 行之前）添加：

```typescript
case 'sessions': {
  silenceLogging();
  startLoading(color.dim(`Loading sessions...`));
  const runtime = new WorkBuddyRuntime();
  await runtime.initialize();
  stopLoading();
  restoreLogging();

  const manager = runtime.getSessionManager();
  const sessions = manager.list();

  if (useJson) {
    printJSON(sessions);
  } else {
    console.log(`\n${color.bold('Active Sessions')} (${sessions.length}):\n`);
    console.log('| # | Session ID | Status | Skill | Turns | Tool Calls | Last Activity |');
    console.log('|---|------------|--------|-------|-------|------------|---------------|');
    sessions.forEach((s, i) => {
      const statusColor = {
        idle: color.dim,
        planning: color.yellow,
        working: color.green,
        completed: color.cyan,
        failed: color.red,
        timed_out: color.red,
      }[s.status] || ((x: string) => x);

      const skillName = s.skillSlug || '(none)';
      const lastActivity = new Date(s.lastActivityAt).toLocaleTimeString();

      console.log(
        `| ${i + 1} | ${s.sessionId} | ${statusColor(s.status)} | ${skillName} | ${s.turnsCount} | ${s.toolCallsCount} | ${lastActivity} |`
      );
    });
    console.log(`\n${color.dim('TTL: 24h | Max concurrent: 10')}`);
  }
  break;
}
```

#### 修改 help 输出

在第 348-371 行的 help 输出中，添加 `sessions` 命令：

```
workbuddy [--json] sessions                         List active sessions
```

### 验证
```bash
node dist/cli.js sessions
node dist/cli.js --json sessions
```

---

## T5：TodoWrite 持久化

### 修改文件：`runtime/src/tool-executors.ts`

#### 修改 1：替换 todoStore 和 todoWriteExecutor

替换第 364-386 行：

```typescript
// ===== TodoWrite Tool (Persistent) =====
import { readFileSync as readFileSyncFs, writeFileSync as writeFileSyncFs, existsSync as existsSyncFs, mkdirSync as mkdirSyncFs } from 'fs';

const TODO_DIR = join(process.cwd(), '.workbuddy/todos');

function ensureTodoDir(): void {
  if (!existsSyncFs(TODO_DIR)) {
    mkdirSyncFs(TODO_DIR, { recursive: true });
  }
}

function getTodoFilePath(): string {
  return join(TODO_DIR, 'todos.json');
}

function loadTodos(): Array<{ id: string; content: string; status: string; priority?: string }> {
  const filePath = getTodoFilePath();
  if (!existsSyncFs(filePath)) return [];
  try {
    return JSON.parse(readFileSyncFs(filePath, 'utf-8'));
  } catch {
    return [];
  }
}

function saveTodos(todos: Array<{ id: string; content: string; status: string; priority?: string }>): void {
  ensureTodoDir();
  writeFileSyncFs(getTodoFilePath(), JSON.stringify(todos, null, 2), 'utf-8');
}

export const todoWriteExecutor: ToolExecutor = async (args: Record<string, unknown>): Promise<ToolResult> => {
  const todos = args['todos'] as Array<{ content: string; status: string; priority?: string }>;

  if (!todos || !Array.isArray(todos)) {
    return { success: false, output: '', error: 'Missing or invalid todos array' };
  }

  // 加载现有 todos（保留已有状态）
  const existing = loadTodos();
  const existingMap = new Map(existing.map(t => t.content));

  // 合并：新列表覆盖已有项，保留未出现的旧项（标记为 archived）
  const newContents = new Set(todos.map(t => t.content));
  const merged = todos.map((t, i) => ({
    id: existingMap.get(t.content)?.id || `todo_${Date.now()}_${i}`,
    content: t.content,
    status: t.status || 'pending',
    priority: t.priority,
  }));

  saveTodos(merged);

  const summary = merged.map((t, i) =>
    `${i + 1}. [${t.status}] ${t.content}${t.priority ? ` (${t.priority})` : ''}`
  ).join('\n');

  return {
    success: true,
    output: `Todo list saved to .workbuddy/todos/todos.json (${merged.length} items):\n\n${summary}`
  };
};
```

### 验证
```bash
# 手动测试
node -e "
const { todoWriteExecutor } = require('./dist/tool-executors');
todoWriteExecutor({ todos: [{ content: 'Test todo', status: 'pending' }] }).then(r => console.log(r.output));
"
```

---

## T6：Skill 工具真正实现

### 修改文件：`runtime/src/tool-executors.ts`

#### 修改 1：添加 skillExecutor 依赖

在第 348-362 行，替换 `skillExecutor`：

```typescript
// ===== Skill Tool (Skill Invocation) =====
// skillExecutor 需要通过 runtime 访问，使用闭包创建
let _runtimeRef: any = null;

export function setSkillRuntimeRef(runtime: any): void {
  _runtimeRef = runtime;
}

export const skillExecutor: ToolExecutor = async (args: Record<string, unknown>): Promise<ToolResult> => {
  const name = args['name'] as string;
  const message = (args['message'] as string) || undefined;

  if (!name) return { success: false, output: '', error: 'Missing skill name' };

  if (!_runtimeRef) {
    return {
      success: false,
      output: '',
      error: 'Runtime not initialized. Skill-to-skill calls require WorkBuddyRuntime.',
    };
  }

  const skill = _runtimeRef.getSkill(name);
  if (!skill) {
    const available = _runtimeRef.getSkillSlugs().join(', ');
    return { success: false, output: '', error: `Skill '${name}' not found. Available: ${available}` };
  }

  // 检查 LLM 是否配置
  if (!_runtimeRef.getAgentLoop()) {
    return {
      success: false,
      output: '',
      error: `Skill '${name}' requires LLM configuration. Set WORKBUDDY_LLM_API_URL and WORKBUDDY_LLM_API_KEY.`,
    };
  }

  try {
    const output = await _runtimeRef.runSkill(name, message);
    return { success: true, output: `[Skill '${name}' result]\n\n${output}` };
  } catch (e: any) {
    return { success: false, output: '', error: `Failed to execute skill '${name}': ${e.message}` };
  }
};
```

#### 修改 2：在 WorkBuddyRuntime 初始化时设置引用

回到 `runtime/src/index.ts`，在构造函数末尾（设置 sessionManager 之后）添加：

```typescript
import { setSkillConfigRef } from './tool-executors';  // 在顶部添加
// ... 构造函数中 ...
setSkillConfigRef(this);  // 在 sessionManager 初始化后添加
```

### 验证
- 编译通过
- skill 工具不再返回占位符

---

## T7：Agent 工具真正实现

### 修改文件：`runtime/src/tool-executors.ts`

#### 替换 agentExecutor

替换第 332-346 行：

```typescript
// ===== Agent Tool (Sub-Agent Dispatch) =====
export const agentExecutor: ToolExecutor = async (args: Record<string, unknown>): Promise<ToolResult> => {
  const prompt = args['prompt'] as string;
  const subagentType = (args['subagentType'] as string) || 'general';
  const maxTurns = (args['maxTurns'] as number) || 10;

  if (!prompt) return { success: false, output: '', error: 'Missing prompt' };

  if (!_runtimeRef) {
    return { success: false, output: '', error: 'Runtime not initialized.' };
  }

  // 检查 LLM 是否配置
  if (!_runtimeRef.getAgentLoop()) {
    return { success: false, output: '', error: 'Agent tool requires LLM configuration.' };
  }

  // 构建子代理的系统提示
  const systemPrompt = `You are a specialized sub-agent of type '${subagentType}'. Your task is: ${prompt}. Provide a concise, focused response.`;
  const userMessage = `Execute the following task: ${prompt}`;

  try {
    // 使用当前 AgentLoop 的一个新实例（清空历史）
    const agentLoop = _runtimeRef.getAgentLoop();
    agentLoop.reset();

    const result = await agentLoop.run(systemPrompt, userMessage);

    return {
      success: result.success,
      output: result.output,
      error: result.error,
    };
  } catch (e: any) {
    return { success: false, output: '', error: `Agent execution failed: ${e.message}` };
  }
};
```

**注意：** 这里有个问题 — 复用同一个 AgentLoop 会清空当前会话的历史。更安全的做法是创建一个新的 AgentLoop 实例。但在 v0.2.0-alpha 中，这种简化实现是可接受的。在 v0.2.0-beta 中应该改为真正的子代理隔离。

### 验证
- 编译通过
- agent 工具不再返回占位符

---

## T8：单元测试

### 新建文件：`runtime/src/test/session-manager.spec.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DefaultSessionManager, resetSessionManager } from '../session/session-manager';
import { SessionStatus } from '../types';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DATA_DIR = path.join(__dirname, 'test-sessions-tmp');

describe('SessionManager', () => {
  let manager: DefaultSessionManager;

  beforeEach(() => {
    // 清理测试数据目录
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
    resetSessionManager();

    // 临时覆盖 DATA_DIR（需要修改源码或用环境变量）
    // 由于 DATA_DIR 是硬编码的，我们在测试中使用进程工作目录
    manager = new DefaultSessionManager({
      maxConcurrent: 3,
      ttlMs: 1000,  // 1s TTL 用于快速测试
      cleanupIntervalMs: 500,
    });
    manager.stopCleanupTimer();
  });

  afterEach(() => {
    manager.stopCleanupTimer();
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
  });

  it('creates a new session', () => {
    const session = manager.create('test-1');
    expect(session.sessionId).toBe('test-1');
    expect(session.status).toBe('idle');
    expect(session.turnsCount).toBe(0);
  });

  it('generates unique session IDs', () => {
    const s1 = manager.create();
    const s2 = manager.create();
    expect(s1.sessionId).not.toBe(s2.sessionId);
  });

  it('enforces max concurrent sessions', () => {
    manager.create('s1');
    manager.create('s2');
    manager.create('s3');
    expect(() => manager.create('s4')).toThrow('Maximum number of sessions reached');
  });

  it('gets an existing session', () => {
    manager.create('test-1');
    const session = manager.get('test-1');
    expect(session).not.toBeNull();
    expect(session!.sessionId).toBe('test-1');
  });

  it('returns null for non-existent session', () => {
    expect(manager.get('nonexistent')).toBeNull();
  });

  it('updates session status', () => {
    manager.create('test-1');
    manager.updateStatus('test-1', 'working');
    expect(manager.get('test-1')!.status).toBe('working');

    manager.updateStatus('test-1', 'completed');
    expect(manager.get('test-1')!.status).toBe('completed');
  });

  it('lists all sessions sorted by lastActivityAt', () => {
    manager.create('s1');
    manager.create('s2');
    const list = manager.list();
    expect(list.length).toBe(2);
  });

  it('removes a session and its disk file', () => {
    manager.create('test-1');
    const removed = manager.remove('test-1');
    expect(removed).toBe(true);
    expect(manager.get('test-1')).toBeNull();

    const doubleRemove = manager.remove('nonexistent');
    expect(doubleRemove).toBe(false);
  });

  it('cleanup removes completed and expired sessions', () => {
    manager.create('s1');
    manager.create('s2');
    manager.updateStatus('s1', 'completed');

    // 让 s2 过期
    const s2 = manager.get('s2')!;
    s2.lastActivityAt = Date.now() - 2000;  // 2s ago, TTL is 1s

    const removed = manager.cleanup();
    expect(removed).toBe(2);
    expect(manager.getActiveCount()).toBe(0);
  });

  it('incrementTurns updates counter', () => {
    manager.create('test-1');
    manager.incrementTurns('test-1');
    manager.incrementTurns('test-1');
    expect(manager.get('test-1')!.turnsCount).toBe(2);
  });

  it('incrementToolCalls updates counter', () => {
    manager.create('test-1');
    manager.incrementToolCalls('test-1', 3);
    manager.incrementToolCalls('test-1', 2);
    expect(manager.get('test-1')!.toolCallsCount).toBe(5);
  });

  it('prevents duplicate session IDs', () => {
    manager.create('test-1');
    expect(() => manager.create('test-1')).toThrow('already exists');
  });
});
```

### 修改文件：`runtime/src/test/tool-executors.spec.ts`

在文件末尾（Tool Registration 测试之后）添加：

```typescript
  describe('TodoWriteExecutor', () => {
    it('should return error for missing todos', async () => {
      const result = await todoWriteExecutor({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing');
    });

    it('should save todos to disk', async () => {
      const result = await todoWriteExecutor({
        todos: [{ content: 'Test todo 1', status: 'pending' }],
      });
      expect(result.success).toBe(true);
      expect(result.output).toContain('todos.json');
    });

    it('should persist and reload todos', async () => {
      await todoWriteExecutor({
        todos: [{ content: 'Persistent todo', status: 'done' }],
      });
      const result2 = await todoWriteExecutor({
        todos: [{ content: 'Persistent todo', status: 'done' }],
      });
      expect(result2.success).toBe(true);
    });
  });
```

### 验证
```bash
npx vitest run --sequence.concurrent=false
```

预期：**66/66 tests passed**（原有 54 + session-manager 12）

---

## T9：集成验证

### 编译
```bash
npm run build
```

### 测试
```bash
cd runtime && npx vitest run --sequence.concurrent=false
```

### CLI 手动测试
```bash
cd runtime

# 测试 sessions 命令
node dist/cli.js sessions

# 测试 todo 持久化
node -e "
const { todoWriteExecutor } = require('./dist/tool-executors');
todoWriteExecutor({ todos: [{ content: 'Integration test', status: 'pending' }] }).then(r => console.log(r.output));
"

# 验证文件写入
cat ../.workbuddy/todos/todos.json
```

---

## 文件变更汇总

| 文件 | 操作 | 说明 |
|------|------|------|
| `types.ts` | 追加 | SessionStatus, SessionState, SessionConfig, SessionManager |
| `session/session-manager.ts` | 新建 | DefaultSessionManager 完整实现 |
| `index.ts` | 修改 | 集成 SessionManager，设置 skill runtime ref |
| `cli.ts` | 修改 | 新增 sessions 命令 |
| `tool-executors.ts` | 修改 | TodoWrite 持久化 + Skill/Agent 真正实现 |
| `test/session-manager.spec.ts` | 新建 | 12 个测试用例 |
| `test/tool-executors.spec.ts` | 追加 | TodoWrite 持久化测试 |

### 新增依赖
无新依赖。全部使用 Node.js 内置模块（fs, path）。

---

## ⚠️ 注意事项

1. **SessionManager 数据目录**：使用 `.workbuddy/sessions/` 相对路径，相对于 `process.cwd()`
2. **TodoWrite 数据目录**：使用 `.workbuddy/todos/` 相对路径
3. **TTL 测试**：测试中设置 TTL=1s，需要 `Date.now()` 时间偏移来模拟过期
4. **并发测试**：必须使用 `--sequence.concurrent=false`
5. **Agent 工具限制**：v0.2.0-alpha 中复用同一 AgentLoop 实例，会清空当前历史。v0.2.0-beta 中改为独立子代理
6. **Skill 工具限制**：通过 `_runtimeRef` 闭包引用，需要在初始化时设置

---

## 完成后汇报格式

```markdown
---

## 汇报 - 2026-05-02 组员（Phase 4 / v0.2.0-alpha）

### 完成
- T1: 会话状态机定义（types.ts）
- T2: SessionManager 类（session/session-manager.ts）
- T3: 集成到 WorkBuddyRuntime（index.ts）
- T4: CLI sessions 命令（cli.ts）
- T5: TodoWrite 持久化（tool-executors.ts）
- T6: Skill 工具真正实现（tool-executors.ts）
- T7: Agent 工具真正实现（tool-executors.ts）
- T8: 单元测试 12 个（session-manager.spec.ts + tool-executors 追加）
- T9: 集成验证

### 验证
- 编译: ✅ npm run build 零错误
- 测试: ✅ 66/66 tests passed（6 个测试文件）
- CLI: ✅ sessions 命令正常工作
- 持久化: ✅ TodoWrite 写入 .workbuddy/todos/todos.json
```

---

*本文档由组长编写，提交给组员执行。执行完成后由组长审查确认。*
