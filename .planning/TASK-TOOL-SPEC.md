# 技术文档：Task 工具执行器实现（P1-4）

> **版本**: v0.1  
> **日期**: 2026-05-02  
> **目标版本**: v0.2.0-beta  
> **前置条件**: v0.2.0-alpha 已完成，89/89 测试通过

---

## 一、目标

在 `tool-executors.ts` 中实现 `taskExecutor`（Task 工具执行器），补全最后一个占位符工具。

**核心能力**：
- Agent 通过 `Task` 工具发起多步骤任务
- 支持两种模式：**单步委派**（默认）和 **DAG 编排**（多任务依赖）
- 复用已有的 `Orchestrator`（`dag` 模式）和 `AgentLoop`（子任务执行）
- 支持超时、重试、上下文传递

---

## 二、现有代码分析

### 2.1 已有基础设施（✅ 不需要改）

| 组件 | 文件 | 状态 |
|------|------|------|
| Tool Schema | `src/tool-router.ts:88-96` | ✅ 已定义 |
| ToolName 类型 | `src/types.ts:109` | ✅ `'Task'` 已声明 |
| TaskNode / TaskResult | `src/types.ts:51-66` | ✅ 已定义 |
| Orchestrator | `src/orchestrator/orchestrator.ts` | ✅ 完整实现（linear/fork/dag/team） |
| AgentLoop | `src/agent-loop.ts` | ✅ 完整实现 |
| setSkillRuntimeRef | `src/tool-executors.ts:333-337` | ✅ 已有，可复用 |

### 2.2 需要新建/修改

| 组件 | 文件 | 操作 |
|------|------|------|
| taskExecutor | `src/tool-executors.ts` | **新建** |
| taskDagExecutor | `src/tool-executors.ts` | **新建**（内部函数） |
| registerAllTools | `src/tool-executors.ts:471-483` | **修改**（添加 `router.register('Task', ...)`） |
| taskExecutor spec | `src/test/tool-executors.spec.ts` | **新建测试用例** |
| e2e task test | `src/test/e2e.spec.ts` | **新建集成测试** |

---

## 三、Task 工具 Schema（已有，供参考）

```typescript
Task: {
  name: 'Task',
  description: 'Launch a new agent to handle complex, multistep tasks',
  parameters: {
    description: { type: 'string', required: true, description: 'Short task description' },
    prompt:      { type: 'string', required: true, description: 'Detailed task instructions' },
    subagentType:{ type: 'string', required: false, description: 'Type of specialized agent' },
  },
}
```

---

## 四、taskExecutor 实现规格

### 4.1 函数签名

```typescript
export const taskExecutor: ToolExecutor = async (
  args: Record<string, unknown>
): Promise<ToolResult>
```

### 4.2 输入参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `description` | `string` | ✅ | 短描述（用于日志和结果汇总） |
| `prompt` | `string` | ✅ | 详细任务指令 |
| `subagentType` | `string` | ❌ | 子代理类型，默认 `'general'` |
| `timeout` | `number` | ❌ | 超时毫秒数，默认 `60_000` |
| `taskGraph` | `TaskNode[]` | ❌ | **DAG 模式**：任务依赖图。如果提供则走 DAG 编排 |

### 4.3 执行流程

```
┌─────────────────────────────────────────────┐
│ 1. 参数校验                                   │
│    - description 必填                        │
│    - prompt 必填                             │
│    - 如果缺少 AgentLoop → 返回错误             │
├─────────────────────────────────────────────┤
│ 2. 判断模式                                   │
│    - 有 taskGraph → DAG 模式                  │
│    - 无 taskGraph → 单步委派模式               │
├─────────────────────────────────────────────┤
│ 3a. 单步委派模式                              │
│    - 创建新的 AgentLoop 实例                   │
│    - 构建 system prompt                      │
│    - 调用 AgentLoop.run()                    │
│    - 返回结果                                │
├─────────────────────────────────────────────┤
│ 3b. DAG 编排模式                             │
│    - 创建 Orchestrator 实例                   │
│    - 注册所有 TaskNode                       │
│    - 设置 mode='dag'                        │
│    - 调用 Orchestrator.execute()            │
│    - 汇总所有子任务结果                        │
│    - 返回结构化输出                           │
├─────────────────────────────────────────────┤
│ 4. 超时控制                                   │
│    - Promise.race(task, timeout)             │
└─────────────────────────────────────────────┘
```

### 4.4 单步委派模式 — 详细实现

```typescript
// 伪代码，供实现参考
export const taskExecutor: ToolExecutor = async (args) => {
  const description = args['description'] as string;
  const prompt = args['prompt'] as string;
  const subagentType = (args['subagentType'] as string) || 'general';
  const timeoutMs = (args['timeout'] as number) || 60_000;
  const taskGraph = args['taskGraph'] as TaskNode[] | undefined;

  if (!description) return { success: false, output: '', error: 'Missing description' };
  if (!prompt) return { success: false, output: '', error: 'Missing prompt' };
  if (!_runtimeRef || !_runtimeRef.getAgentLoop()) {
    return { success: false, output: '', error: 'Task tool requires LLM configuration.' };
  }

  // ── DAG 模式 ──
  if (taskGraph && taskGraph.length > 0) {
    return executeTaskDag(taskGraph, timeoutMs);
  }

  // ── 单步委派模式 ──
  const systemPrompt = `You are a specialized ${subagentType} sub-agent. ${description}. Follow the instructions below carefully.`;

  const result = await withTimeout(
    _runtimeRef.getAgentLoop().run(systemPrompt, prompt),
    timeoutMs
  );

  return {
    success: result.success,
    output: result.output,
    error: result.error,
  };
};
```

### 4.5 DAG 编排模式 — 详细实现

```typescript
// 伪代码，供实现参考
async function executeTaskDag(
  taskGraph: TaskNode[],
  timeoutMs: number
): Promise<ToolResult> {
  const orch = createOrchestrator({
    mode: 'dag',
    maxConcurrency: 4,
    timeoutMs: Math.min(timeoutMs, 120_000),
    retryCount: 0,
  }, _runtimeRef);

  orch.addTasks(taskGraph);
  const results = await orch.execute();

  // 汇总输出
  const lines: string[] = [];
  let allSuccess = true;

  for (const [taskId, result] of results) {
    const statusIcon = result.status === 'completed' ? '✅' : '❌';
    lines.push(`${statusIcon} [${taskId}] ${result.status} (${result.duration}ms)`);
    if (result.status === 'failed') {
      allSuccess = false;
      lines.push(`   Error: ${result.error}`);
    }
    lines.push(`   Output: ${result.output.substring(0, 200)}`);
    lines.push('---');
  }

  const summary = lines.join('\n');
  const completedCount = [...results.values()].filter(r => r.status === 'completed').length;

  return {
    success: allSuccess,
    output: `Task DAG completed: ${completedCount}/${results.size} tasks succeeded\n\n${summary}`,
  };
}
```

### 4.6 Orchestrator 的 runTaskWithTimeout 改进

当前 `Orchestrator.runTaskWithTimeout()` 只是返回描述字符串。需要修改为：

```typescript
// 在 orchestrator.ts 的 runTaskWithTimeout 中：
private async runTaskWithTimeout(task: TaskNode, _previousResults?: Map<string, TaskResult>): Promise<string> {
  // 构建子代理的 system prompt
  const role = task.assignedRole ? this.roles.get(task.assignedRole) : null;
  const roleContext = role
    ? `You are playing the role of "${role.name}" — ${role.description}.`
    : `You are a specialized agent.`;

  const systemPrompt = `${roleContext} Your task: ${task.description}`;

  if (this.runtime && this.runtime.getAgentLoop()) {
    const agentLoop = this.runtime.getAgentLoop();
    agentLoop.reset(); // 每次子任务用新的对话
    const result = await agentLoop.run(systemPrompt, task.description);

    if (!result.success) {
      throw new Error(result.error || 'Task execution failed');
    }
    return result.output;
  }

  // Fallback: 无 LLM 时返回描述（向后兼容测试）
  return `[${task.id}] ${task.description}`;
}
```

---

## 五、registerAllTools 修改

```typescript
// 在 src/tool-executors.ts 的 registerAllTools 中添加：
export function registerAllTools(router: ToolRouterClass): void {
  router.register('Read', readExecutor);
  router.register('Write', writeExecutor);
  router.register('Edit', editExecutor);
  router.register('Bash', bashExecutor);
  router.register('Glob', globExecutor);
  router.register('Grep', grepExecutor);
  router.register('WebFetch', webFetchExecutor);
  router.register('WebSearch', webSearchExecutor);
  router.register('Agent', agentExecutor);
  router.register('Skill', skillExecutor);
  router.register('TodoWrite', todoWriteExecutor);
  router.register('Task', taskExecutor);  // ← 新增
}
```

---

## 六、测试规格

### 6.1 单元测试（`tool-executors.spec.ts`）

```typescript
describe('TaskExecutor', () => {
  it('should return error for missing description', async () => {
    const result = await taskExecutor({ prompt: 'test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing');
  });

  it('should return error for missing prompt', async () => {
    const result = await taskExecutor({ description: 'test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing');
  });

  it('should return error when LLM not configured', async () => {
    // 需要 mock _runtimeRef 为 null
    const savedRef = getRuntimeRef(); // 需要暴露一个 getter
    clearRuntimeRef();
    try {
      const result = await taskExecutor({
        description: 'Test task',
        prompt: 'Do something',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM configuration');
    } finally {
      restoreRuntimeRef(savedRef); // 恢复
    }
  });

  it('should accept valid arguments without error', async () => {
    // 当 LLM 已配置时，不报参数错误
    const result = await taskExecutor({
      description: 'Test task',
      prompt: 'Do something simple',
      subagentType: 'general',
    });
    // 可能成功也可能失败（取决于 LLM），但不应该是参数校验错误
    expect(result.error).not.toContain('Missing');
  });
});
```

### 6.2 集成测试（`e2e.spec.ts`）

```typescript
describe('Task Tool E2E', () => {
  it('should execute a simple task via Task tool', async () => {
    const router = runtime.getToolRouter();
    const result = await router.execute('Task', {
      description: 'Write a short poem',
      prompt: 'Write a 4-line poem about coding.',
    });

    // Task 需要 LLM，当前 .env 已配置
    expect(result.success).toBe(true);
    expect(result.output.length).toBeGreaterThan(0);
  });

  it('should execute DAG tasks', async () => {
    const router = runtime.getToolRouter();
    const result = await router.execute('Task', {
      description: 'Multi-step analysis',
      prompt: 'Execute the following tasks.',
      taskGraph: [
        {
          id: 'task_1',
          description: 'List the files in the current directory',
          dependsOn: [],
          status: 'pending',
        },
        {
          id: 'task_2',
          description: 'Summarize what you found',
          dependsOn: ['task_1'],
          status: 'pending',
        },
      ],
    });

    expect(result.output).toContain('task_1');
    expect(result.output).toContain('task_2');
  });
});
```

### 6.3 验收标准

| # | 标准 | 验证方式 |
|---|------|---------|
| T1 | `taskExecutor` 函数存在且导出 | `npm run build` 无错误 |
| T2 | `Task` 在 `registerAllTools` 中注册 | E2E 测试中 `router.getAllSchemas()` 返回 12 个 |
| T3 | 缺少 `description` 时返回错误 | 单元测试 |
| T4 | 缺少 `prompt` 时返回错误 | 单元测试 |
| T5 | 无 LLM 配置时返回友好错误 | 单元测试 |
| T6 | 单步委派模式可执行任务 | E2E 测试 |
| T7 | DAG 模式可执行依赖任务 | E2E 测试 |
| T8 | 超时控制生效 | 单元测试（设置 1ms 超时） |
| T9 | 所有 89 个现有测试仍然通过 | `npx vitest run --sequence.concurrent=false` |

---

## 七、涉及文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `runtime/src/tool-executors.ts` | 修改 | 添加 `taskExecutor` + `executeTaskDag` + 注册 |
| `runtime/src/orchestrator/orchestrator.ts` | 修改 | 改进 `runTaskWithTimeout` 使用 AgentLoop |
| `runtime/src/test/tool-executors.spec.ts` | 修改 | 添加 Task 单元测试（4 个） |
| `runtime/src/test/e2e.spec.ts` | 修改 | 添加 Task E2E 测试（2 个） |
| `ROADMAP.md` | 修改 | 标记 P1-4 为已完成 |

---

## 八、实现顺序建议

```
1. 修改 orchestrator.ts 的 runTaskWithTimeout (让 Orchestrator 真正调用 AgentLoop)
2. 实现 taskExecutor 单步委派模式
3. 实现 executeTaskDag 函数
4. 在 registerAllTools 中注册 Task
5. 添加单元测试
6. 添加 E2E 测试
7. npm run build → 确认无编译错误
8. vitest run → 确认 89+ 测试全部通过
9. 更新 ROADMAP.md
```

---

## 九、注意事项

1. **复用 `_runtimeRef`**: 与 `agentExecutor`、`skillExecutor` 一样，Task 需要通过 `setSkillRuntimeRef()` 获取运行时引用
2. **AgentLoop.reset()**: 每次子任务调用前必须 `reset()`，防止对话上下文污染
3. **超时传递**: DAG 模式下，单个子任务的超时 = `Orchestrator.config.timeoutMs`，总超时由各任务累计
4. **错误隔离**: DAG 中某个任务失败不应阻塞其他无依赖任务的执行（Orchestrator 已用 `Promise.allSettled` 处理）
5. **不要修改 ToolName 联合类型**: `'Task'` 已在 `types.ts` 中声明，不需要改
6. **不要修改 TOOL_SCHEMAS**: Task schema 已在 `tool-router.ts` 中定义，不需要改

---

## 十、预期测试通过数

- 新增单元测试: **4 个**
- 新增 E2E 测试: **2 个**
- 预期总测试数: **95 个** (89 + 4 + 2)
