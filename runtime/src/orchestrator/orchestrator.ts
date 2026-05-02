import { OrchestrationMode, AgentRole, TaskNode, TaskResult, OrchestratorConfig } from '../types';

const DEFAULT_CONFIG: OrchestratorConfig = {
  mode: 'linear',
  maxConcurrency: 4,
  timeoutMs: 60_000,
  retryCount: 0,
};

export class Orchestrator {
  private config: OrchestratorConfig;
  private roles: Map<string, AgentRole> = new Map();
  private taskGraph: Map<string, TaskNode> = new Map();
  private results: Map<string, TaskResult> = new Map();
  private runtime: any = null;

  constructor(config?: Partial<OrchestratorConfig>, runtime?: any) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (runtime) this.runtime = runtime;
  }

  setRuntime(runtime: any): void {
    this.runtime = runtime;
  }

  registerRole(role: AgentRole): void {
    this.roles.set(role.id, role);
  }

  addTask(task: TaskNode): void {
    this.taskGraph.set(task.id, task);
  }

  addTasks(tasks: TaskNode[]): void {
    for (const task of tasks) {
      this.addTask(task);
    }
  }

  async execute(): Promise<Map<string, TaskResult>> {
    switch (this.config.mode) {
      case 'linear':
        return this.executeLinear();
      case 'fork':
        return this.executeFork();
      case 'dag':
        return this.executeDag();
      case 'team':
        return this.executeTeam();
      default:
        throw new Error(`Unknown orchestration mode: ${this.config.mode}`);
    }
  }

  private async executeLinear(): Promise<Map<string, TaskResult>> {
    const ordered = this.topologicalSort();
    const results = new Map<string, TaskResult>();

    for (const taskId of ordered) {
      const task = this.taskGraph.get(taskId);
      if (!task) continue;

      task.status = 'running';
      const startTime = Date.now();

      try {
        const output = await this.runTaskWithTimeout(task);
        results.set(taskId, {
          taskId,
          status: 'completed',
          output,
          duration: Date.now() - startTime,
        });
        task.status = 'completed';
      } catch (e) {
        results.set(taskId, {
          taskId,
          status: 'failed',
          output: '',
          error: (e as Error).message,
          duration: Date.now() - startTime,
        });
        task.status = 'failed';
      }
    }

    return results;
  }

  private async executeFork(): Promise<Map<string, TaskResult>> {
    const roots = this.getRootTasks();
    const results = new Map<string, TaskResult>();

    const promises = roots.map(async (taskId) => {
      const task = this.taskGraph.get(taskId);
      if (!task) return;

      task.status = 'running';
      const startTime = Date.now();

      try {
        const output = await this.runTaskWithTimeout(task);
        results.set(taskId, {
          taskId,
          status: 'completed',
          output,
          duration: Date.now() - startTime,
        });
        task.status = 'completed';
      } catch (e) {
        results.set(taskId, {
          taskId,
          status: 'failed',
          output: '',
          error: (e as Error).message,
          duration: Date.now() - startTime,
        });
        task.status = 'failed';
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  private async executeDag(): Promise<Map<string, TaskResult>> {
    const results = new Map<string, TaskResult>();
    const completed = new Set<string>();
    const ordered = this.topologicalSort();

    for (const taskId of ordered) {
      const task = this.taskGraph.get(taskId);
      if (!task) continue;

      await this.waitForDependencies(task, completed);

      task.status = 'running';
      const startTime = Date.now();

      try {
        const output = await this.runTaskWithTimeout(task, results);
        results.set(taskId, {
          taskId,
          status: 'completed',
          output,
          duration: Date.now() - startTime,
        });
        task.status = 'completed';
        completed.add(taskId);
      } catch (e) {
        results.set(taskId, {
          taskId,
          status: 'failed',
          output: '',
          error: (e as Error).message,
          duration: Date.now() - startTime,
        });
        task.status = 'failed';
        completed.add(taskId);
      }
    }

    return results;
  }

  private async executeTeam(): Promise<Map<string, TaskResult>> {
    const results = new Map<string, TaskResult>();
    const ordered = this.topologicalSort();

    for (const taskId of ordered) {
      const task = this.taskGraph.get(taskId);
      if (!task) continue;

      await this.waitForDependencies(task, new Set());

      const role = task.assignedRole ? this.roles.get(task.assignedRole) : null;
      if (role) {
        console.log(`[Team] Assigning "${task.description}" to role "${role.name}" (skills: ${role.skills.join(', ')})`);
      }

      task.status = 'running';
      const startTime = Date.now();

      try {
        const output = await this.runTaskWithTimeout(task, results);
        results.set(taskId, {
          taskId,
          status: 'completed',
          output,
          duration: Date.now() - startTime,
        });
        task.status = 'completed';
      } catch (e) {
        results.set(taskId, {
          taskId,
          status: 'failed',
          output: '',
          error: (e as Error).message,
          duration: Date.now() - startTime,
        });
        task.status = 'failed';
      }
    }

    return results;
  }

  private getRootTasks(): string[] {
    const allIds = new Set(this.taskGraph.keys());
    const dependentIds = new Set<string>();
    for (const task of this.taskGraph.values()) {
      for (const dep of task.dependsOn) {
        dependentIds.add(dep);
      }
    }
    return [...allIds].filter(id => !dependentIds.has(id));
  }

  private topologicalSort(): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const task = this.taskGraph.get(id);
      if (!task) return;

      for (const dep of task.dependsOn) {
        visit(dep);
      }

      result.push(id);
    };

    for (const id of this.taskGraph.keys()) {
      visit(id);
    }

    return result;
  }

  private async waitForDependencies(task: TaskNode, completed: Set<string>): Promise<void> {
    const checkInterval = 100;
    while (task.dependsOn.some(dep => !completed.has(dep))) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }

  private async runTaskWithTimeout(task: TaskNode, _previousResults?: Map<string, TaskResult>): Promise<string> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Task '${task.id}' timed out after ${this.config.timeoutMs}ms`)), this.config.timeoutMs);
    });

    const taskFn = async (): Promise<string> => {
      // 如果有 runtime 且 AgentLoop 可用，真正调用 LLM 执行
      if (this.runtime && this.runtime.getAgentLoop) {
        const agentLoop = this.runtime.getAgentLoop();
        if (agentLoop) {
          const role = task.assignedRole ? this.roles.get(task.assignedRole) : null;
          const roleContext = role
            ? `You are playing the role of "${role.name}" — ${role.description}.`
            : 'You are a specialized agent.';

          const systemPrompt = `${roleContext} Your task: ${task.description}. Be concise and focused.`;

          agentLoop.reset();
          const result = await agentLoop.run(systemPrompt, task.description);

          if (!result.success) {
            throw new Error(result.error || 'Task execution failed');
          }
          return result.output;
        }
      }

      // Fallback: 无 LLM 时返回描述（向后兼容测试）
      return `[${task.id}] ${task.description}`;
    };

    return Promise.race([taskFn(), timeout]);
  }

  getResults(): Map<string, TaskResult> {
    return new Map(this.results);
  }

  getTaskStatus(taskId: string): string {
    return this.taskGraph.get(taskId)?.status || 'unknown';
  }

  getRoles(): AgentRole[] {
    return [...this.roles.values()];
  }

  setMode(mode: OrchestrationMode): void {
    this.config.mode = mode;
  }

  setConcurrency(max: number): void {
    this.config.maxConcurrency = max;
  }

  setTimeout(ms: number): void {
    this.config.timeoutMs = ms;
  }
}

export function createOrchestrator(config?: Partial<OrchestratorConfig>, runtime?: any): Orchestrator {
  return new Orchestrator(config, runtime);
}
