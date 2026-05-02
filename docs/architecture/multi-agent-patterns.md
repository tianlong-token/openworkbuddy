# 多智能体编排模式

WorkBuddy 支持四种多智能体编排模式，适用于不同的任务场景。

## 1. Linear（线性模式）

任务按照依赖拓扑排序后串行执行。

```
Task A → Task B → Task C → Task D
```

**使用场景**：有明确先后顺序的任务链，如研究 → 分析 → 写报告 → 审核。

**特点**：
- 最简单，最可靠
- 后续任务可以依赖前面任务的输出
- 执行时间 = 所有任务时间之和

## 2. Fork（分叉模式）

所有根任务（无依赖的任务）并行执行。

```
         ┌── Task A
Root ───┼── Task B
         └── Task C
```

**使用场景**：多个独立的子任务，如同时搜索多个信息源。

**特点**：
- 最大并发度
- 任务之间无依赖
- 执行时间 = 最慢任务的时间

## 3. DAG（有向无环图模式）

任务之间存在依赖关系，依赖就绪后立即触发。

```
Task A ──┐
         ├── Task C ── Task E
Task B ──┤
         └── Task D
```

**使用场景**：复杂依赖关系，如 A 和 B 并行，C 依赖 A，D 依赖 B，E 依赖 C。

**特点**：
- 兼顾并发和依赖
- 自动拓扑排序
- 支持等待依赖完成的异步调度

## 4. Team（团队模式）

定义角色（AgentRole），将任务分配给不同角色的 Agent。

```
Role: Researcher (skills: deep-research, web-scraper)
  └── Task: "搜索关于 X 的最新资料"

Role: Writer (skills: blog-author, novel-writer)
  └── Task: "根据研究结果写文章"

Role: Reviewer (skills: skill-vetter, design-review)
  └── Task: "审核文章质量"
```

**使用场景**：多角色协作的项目，需要明确的职责划分和质量门禁。

**特点**：
- 角色定义清晰
- 支持交接协议（handoff protocol）
- 可配置质量门禁（quality gate）

## 使用示例

```typescript
import { createOrchestrator } from '@workbuddy/runtime';

// Linear mode
const linear = createOrchestrator({ mode: 'linear' });
linear.addTasks([
  { id: 'research', description: 'Research topic X', dependsOn: [], status: 'pending' },
  { id: 'analyze', description: 'Analyze findings', dependsOn: ['research'], status: 'pending' },
  { id: 'report', description: 'Write report', dependsOn: ['analyze'], status: 'pending' },
]);
const results = await linear.execute();

// Fork mode
const fork = createOrchestrator({ mode: 'fork', maxConcurrency: 3 });
fork.addTasks([
  { id: 'search-a', description: 'Search source A', dependsOn: [], status: 'pending' },
  { id: 'search-b', description: 'Search source B', dependsOn: [], status: 'pending' },
  { id: 'search-c', description: 'Search source C', dependsOn: [], status: 'pending' },
]);

// Team mode
const team = createOrchestrator({ mode: 'team' });
team.registerRole({ id: 'researcher', name: 'Researcher', description: 'Expert researcher', skills: ['deep-research', 'web-scraper'] });
team.registerRole({ id: 'writer', name: 'Writer', description: 'Expert writer', skills: ['blog-author'] });
team.addTasks([
  { id: 'research', description: 'Research topic', dependsOn: [], assignedRole: 'researcher', status: 'pending' },
  { id: 'write', description: 'Write article', dependsOn: ['research'], assignedRole: 'writer', status: 'pending' },
]);
```
