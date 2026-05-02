# TodoWrite CLI 任务手册

> 日期：2026-05-02  
> 作者：架构师  
> 执行：组员  
> 预计时间：3-5 小时  
> 原则：我设计，你实现

---

## 目标

新增 `workbuddy todos` CLI 命令，让用户不通过 Agent 也能直接查看和管理 todo 列表。

**为什么做**：目前 todo 只能通过 Agent 的 TodoWrite 工具管理（写入 `.workbuddy/todos/todos.json`）。用户需要 CLI 命令来快速查看、添加、完成、删除 todo，无需启动 LLM。

---

## 数据结构

Todo 存储在 `.workbuddy/todos/todos.json`：

```json
[
  {
    "id": "todo_1714636800000_0",
    "content": "Implement feature X",
    "status": "pending",
    "priority": "high"
  },
  {
    "id": "todo_1714636800000_1",
    "content": "Write tests",
    "status": "in_progress",
    "priority": "medium"
  }
]
```

**Status 枚举**：`pending` | `in_progress` | `completed` | `cancelled`  
**Priority 枚举**：`high` | `medium` | `low`（可选）

**读取方式**（已存在，复用）：
```typescript
// runtime/src/tool-executors.ts 中的 loadTodos() 函数
function loadTodos(): Array<{ id: string; content: string; status: string; priority?: string }> {
  const filePath = join(process.cwd(), '.workbuddy/todos', 'todos.json');
  if (!existsSync(filePath)) return [];
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}
```

---

## 修改文件

**只改一个文件**：`runtime/src/cli.ts`

在 `switch (command)` 中新增一个 `case 'todos':` 分支。

**不修改其他文件。**

---

## 子命令设计

```
workbuddy todos list                      # 列出所有 todo
workbuddy todos list --status=pending     # 按状态过滤
workbuddy todos list --priority=high      # 按优先级过滤
workbuddy todos add "Buy milk"            # 添加新 todo
workbuddy todos add "Buy milk" --priority=high
workbuddy todos complete 1                # 完成第 1 个 todo（按 1-based 索引）
workbuddy todos complete 1 3 5            # 批量完成
workbuddy todos cancel 2                  # 取消第 2 个 todo
workbuddy todos delete 4                  # 删除第 4 个 todo
workbuddy todos clear                     # 清空所有 completed/cancelled
workbuddy todos clear --all               # 清空所有
```

---

## 实现代码

在 `cli.ts` 的 `switch (command)` 中，`case 'sessions':` 之后、`default:` 之前，插入以下代码：

```typescript
    case 'todos': {
      const subCmd = cmdArgs[0] || 'list';
      const subArgs = cmdArgs.slice(1);

      // ===== 解析子命令参数 =====
      interface TodoFlags {
        json: boolean;
        status: string | undefined;
        priority: string | undefined;
        indices: number[];
        message: string | undefined;
        all: boolean;
      }

      function parseTodoFlags(args: string[]): TodoFlags {
        const flags: TodoFlags = { json: false, status: undefined, priority: undefined, indices: [], message: undefined, all: false };
        const indices: number[] = [];
        let message: string | undefined;

        for (const arg of args) {
          if (arg === '--json') flags.json = true;
          else if (arg.startsWith('--status=')) flags.status = arg.split('=')[1];
          else if (arg.startsWith('--priority=')) flags.priority = arg.split('=')[1];
          else if (arg === '--all') flags.all = true;
          else if (/^\d+$/.test(arg)) indices.push(parseInt(arg, 10));
          else message = arg;
        }

        flags.indices = indices;
        flags.message = message;
        return flags;
      }

      // ===== 读取 todos（复用 tool-executors 的逻辑） =====
      const { readFileSync, existsSync, writeFileSync, mkdirSync } = require('fs');
      const { join } = require('path');
      const todoFilePath = join(process.cwd(), '.workbuddy/todos/todos.json');

      function loadTodos(): Array<{ id: string; content: string; status: string; priority?: string }> {
        if (!existsSync(todoFilePath)) return [];
        try {
          return JSON.parse(readFileSync(todoFilePath, 'utf-8'));
        } catch {
          return [];
        }
      }

      function saveTodos(todos: Array<{ id: string; content: string; status: string; priority?: string }>): void {
        const todoDir = join(process.cwd(), '.workbuddy/todos');
        if (!existsSync(todoDir)) mkdirSync(todoDir, { recursive: true });
        writeFileSync(todoFilePath, JSON.stringify(todos, null, 2), 'utf-8');
      }

      // ===== 子命令：list =====
      if (subCmd === 'list') {
        const flags = parseTodoFlags(subArgs);
        let todos = loadTodos();

        if (flags.status) {
          todos = todos.filter(t => t.status === flags.status);
        }
        if (flags.priority) {
          todos = todos.filter(t => t.priority === flags.priority);
        }

        if (flags.json) {
          printJSON(todos);
        } else {
          console.log(`\n${color.bold('Todo List')} (${todos.length}):\n`);
          if (todos.length === 0) {
            console.log(`  ${color.dim('No todos found.')}`);
          } else {
            console.log('| # | Status | Priority | Content |');
            console.log('|---|--------|----------|---------|');
            todos.forEach((t, i) => {
              const statusColor: Record<string, (x: string) => string> = {
                pending: color.dim,
                in_progress: color.yellow,
                completed: color.green,
                cancelled: color.red,
              };
              const c = statusColor[t.status] || ((x: string) => x);
              const priorityStr = t.priority ? t.priority : '-';
              const priorityColor: Record<string, (x: string) => string> = {
                high: color.red,
                medium: color.yellow,
                low: color.dim,
              };
              const pc = priorityColor[t.priority || ''] || ((x: string) => x);
              console.log(
                `| ${i + 1} | ${c(t.status)} | ${pc(priorityStr)} | ${t.content} |`
              );
            });
          }
          console.log(`\n${color.dim('Status: pending | in_progress | completed | cancelled')}`);
          console.log(`${color.dim('Priority: high | medium | low')}`);
        }
        break;
      }

      // ===== 子命令：add =====
      if (subCmd === 'add') {
        const flags = parseTodoFlags(subArgs);
        if (!flags.message) {
          console.error(`${color.red('✗')} Usage: workbuddy todos add <message> [--priority=high|medium|low]`);
          process.exit(1);
        }

        const todos = loadTodos();
        const newTodo = {
          id: `todo_${Date.now()}_${todos.length}`,
          content: flags.message,
          status: 'pending',
          priority: flags.priority || 'medium',
        };
        todos.push(newTodo);
        saveTodos(todos);

        if (flags.json) {
          printJSON({ success: true, todo: newTodo });
        } else {
          console.log(`${color.green('✓')} Added: ${color.bold(newTodo.content)} (${newTodo.priority})`);
        }
        break;
      }

      // ===== 子命令：complete =====
      if (subCmd === 'complete') {
        const flags = parseTodoFlags(subArgs);
        if (flags.indices.length === 0) {
          console.error(`${color.red('✗')} Usage: workbuddy todos complete <index1> [index2] ...`);
          process.exit(1);
        }

        const todos = loadTodos();
        for (const idx of flags.indices) {
          if (idx < 1 || idx > todos.length) {
            console.error(`${color.red('✗')} Invalid index: ${idx} (total: ${todos.length})`);
            process.exit(1);
          }
          todos[idx - 1].status = 'completed';
        }
        saveTodos(todos);

        if (flags.json) {
          printJSON({ success: true, completed: flags.indices });
        } else {
          const items = flags.indices.map(i => `${i}: ${todos[i - 1].content}`).join(', ');
          console.log(`${color.green('✓')} Completed: ${items}`);
        }
        break;
      }

      // ===== 子命令：cancel =====
      if (subCmd === 'cancel') {
        const flags = parseTodoFlags(subArgs);
        if (flags.indices.length === 0) {
          console.error(`${color.red('✗')} Usage: workbuddy todos cancel <index1> [index2] ...`);
          process.exit(1);
        }

        const todos = loadTodos();
        for (const idx of flags.indices) {
          if (idx < 1 || idx > todos.length) {
            console.error(`${color.red('✗')} Invalid index: ${idx} (total: ${todos.length})`);
            process.exit(1);
          }
          todos[idx - 1].status = 'cancelled';
        }
        saveTodos(todos);

        if (flags.json) {
          printJSON({ success: true, cancelled: flags.indices });
        } else {
          const items = flags.indices.map(i => `${i}: ${todos[i - 1].content}`).join(', ');
          console.log(`${color.yellow('↻')} Cancelled: ${items}`);
        }
        break;
      }

      // ===== 子命令：delete =====
      if (subCmd === 'delete') {
        const flags = parseTodoFlags(subArgs);
        if (flags.indices.length === 0) {
          console.error(`${color.red('✗')} Usage: workbuddy todos delete <index1> [index2] ...`);
          process.exit(1);
        }

        let todos = loadTodos();
        const removed: string[] = [];
        // 从大到小删除，避免索引偏移
        const sortedIndices = [...flags.indices].sort((a, b) => b - a);
        for (const idx of sortedIndices) {
          if (idx < 1 || idx > todos.length) {
            console.error(`${color.red('✗')} Invalid index: ${idx} (total: ${todos.length})`);
            process.exit(1);
          }
          removed.push(`${idx}: ${todos[idx - 1].content}`);
          todos.splice(idx - 1, 1);
        }
        saveTodos(todos);

        if (flags.json) {
          printJSON({ success: true, removed: flags.indices });
        } else {
          console.log(`${color.red('✗')} Deleted: ${removed.join(', ')}`);
        }
        break;
      }

      // ===== 子命令：clear =====
      if (subCmd === 'clear') {
        const flags = parseTodoFlags(subArgs);
        let todos = loadTodos();

        if (flags.all) {
          todos = [];
        } else {
          const count = todos.length;
          todos = todos.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
          console.log(`${color.dim(`Cleared ${count - todos.length} finished todos, ${todos.length} remaining`)}`);
        }

        saveTodos(todos);

        if (flags.json) {
          printJSON({ success: true, remaining: todos.length });
        } else {
          console.log(`${color.yellow('↻')} Todo list cleared`);
        }
        break;
      }

      // ===== 未知子命令 =====
      console.error(`${color.red('✗')} Unknown subcommand: ${subCmd}`);
      console.error(`\n${color.bold('Usage:')}
  workbuddy todos list [--status=pending] [--priority=high]
  workbuddy todos add <message> [--priority=high|medium|low]
  workbuddy todos complete <index> [<index> ...]
  workbuddy todos cancel <index> [<index> ...]
  workbuddy todos delete <index> [<index> ...]
  workbuddy todos clear [--all]`);
      process.exit(1);
      break;
    }
```

---

## 同时更新帮助信息

在 `default:` case 的 help 输出中，添加 `todos` 命令：

**找到**：
```
  workbuddy [--json] sessions                               List active sessions
```

**改为**：
```
  workbuddy [--json] sessions                               List active sessions
  workbuddy todos list [--status=x] [--priority=x]          List todos
  workbuddy todos add <msg> [--priority=x]                  Add a todo
  workbuddy todos complete <idx> [<idx> ...]                Mark todos complete
  workbuddy todos cancel <idx> [<idx> ...]                  Cancel todos
  workbuddy todos delete <idx> [<idx> ...]                  Delete todos
  workbuddy todos clear [--all]                             Clear finished todos
```

---

## 测试验证

### 手动测试脚本

完成后运行以下命令验证：

```bash
# 1. 编译
npm run build

# 2. 添加 todos
node runtime/dist/cli.js todos add "Implement feature X" --priority=high
node runtime/dist/cli.js todos add "Write tests" --priority=medium
node runtime/dist/cli.js todos add "Update docs" --priority=low

# 3. 列出所有
node runtime/dist/cli.js todos list

# 4. 按状态过滤
node runtime/dist/cli.js todos list --status=pending

# 5. 按优先级过滤
node runtime/dist/cli.js todos list --priority=high

# 6. 完成第 2 个
node runtime/dist/cli.js todos complete 2

# 7. 查看完成后的列表
node runtime/dist/cli.js todos list

# 8. 批量完成
node runtime/dist/cli.js todos complete 1 3

# 9. 取消一个
node runtime/dist/cli.js todos cancel 3

# 10. 删除一个
node runtime/dist/cli.js todos delete 3

# 11. 清空已完成的
node runtime/dist/cli.js todos clear

# 12. 清空全部
node runtime/dist/cli.js todos clear --all

# 13. JSON 输出
node runtime/dist/cli.js todos list --json

# 14. 查看帮助
node runtime/dist/cli.js
```

### 预期输出示例

```
$ node runtime/dist/cli.js todos list

Todo List (3):

| # | Status | Priority | Content |
|---|--------|----------|---------|
| 1 | in_progress | high | Implement feature X |
| 2 | pending | medium | Write tests |
| 3 | pending | low | Update docs |

Status: pending | in_progress | completed | cancelled
Priority: high | medium | low
```

---

## 文件变更汇总

| 文件 | 操作 | 说明 |
|------|------|------|
| `runtime/src/cli.ts` | 修改 | 新增 `case 'todos':` 分支 + 更新 help |

**只改这一个文件。**

---

## 完成后汇报

```
## 汇报 - 2026-05-02

### 完成
- TodoWrite CLI：6 个子命令（list/add/complete/cancel/delete/clear）
- 支持 --status/--priority 过滤、--json 输出、批量操作

### 验证
- 编译: ✅ npm run build 零错误
- 手动: ✅ 所有子命令工作正常
- 数据: ✅ .workbuddy/todos/todos.json 正确读写
```

---

*本文档由架构师编写，提交给组员执行。执行完成后由架构师审查确认。*
