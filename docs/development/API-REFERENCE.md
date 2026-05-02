# API Reference — WorkBuddy Runtime v0.1.0

> Last updated: 2026-05-02

---

## Table of Contents

1. [WorkBuddyRuntime](#workbuddyruntime)
2. [Tool Executors](#tool-executors)
3. [LLM Provider](#llm-provider)
4. [Agent Loop](#agent-loop)
5. [Memory Store](#memory-store)
6. [Orchestrator](#orchestrator)
7. [Skill Loader](#skill-loader)
8. [Configuration](#configuration)
9. [Session Manager](#session-manager)
10. [Skill Script Runner](#skill-script-runner)
11. [CLI Commands](#cli-commands)
12. [Type Definitions](#type-definitions)

---

## WorkBuddyRuntime

Main entry point. Manages skills, tools, memory, sessions, LLM and agent loop.

```typescript
import { WorkBuddyRuntime } from '@workbuddy/runtime';

const runtime = new WorkBuddyRuntime({
  skillsDir: '/path/to/skills',
  memoryStore: 'memory',
  logLevel: 'info',
});

await runtime.initialize();
const result = await runtime.runSkill('deep-research', '用一句话介绍你的能力');
```

### Constructor

| Parameter | Type | Required | Default |
|-----------|------|----------|---------|
| `config` | `Partial<RuntimeConfig>` | No | From environment variables |

### Methods

| Method | Return | Description |
|--------|--------|-------------|
| `initialize()` | `Promise<void>` | Load skills from `skillsDir`, initialize LLM provider |
| `createSession(sessionId?)` | `SessionContext` | Create a new session context |
| `getSession(sessionId)` | `SessionContext \| undefined` | Get existing session |
| `getSkill(slug)` | `Skill \| undefined` | Get a loaded skill by slug |
| `listAllSkills()` | `Skill[]` | Get all loaded skills |
| `searchSkills(query)` | `Skill[]` | Search skills by query string |
| `getSkillSlugs()` | `string[]` | Get all skill slugs |
| `getToolRouter()` | `ToolRouter` | Get the tool router instance |
| `getMemoryStore()` | `MemoryStore` | Get the memory store instance |
| `createOrchestrator()` | `Orchestrator` | Create an orchestrator with runtime context |
| `runSkill(slug, userMessage?)` | `Promise<string>` | Execute a skill with optional user message |
| `getConfig()` | `RuntimeConfig` | Get current runtime configuration |
| `getAgentLoop()` | `AgentLoop \| null` | Get the agent loop instance |
| `getSessionManager()` | `SessionManager` | Get the session manager instance |
| `dispose()` | `void` | Clean up session manager resources |

---

## Tool Executors

### Read

Read a file or directory from the filesystem.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | `string` | Yes | Absolute or relative path to the file or directory |
| `limit` | `number` | No | Maximum number of lines to read (default: 2000) |
| `offset` | `number` | No | Line number to start from, 1-indexed (default: 1) |

**Security**: Paths are resolved against `process.cwd()` and validated to prevent directory traversal.

**Returns**: File content as string, or directory listing if path is a directory.

### Write

Write content to a file. Creates parent directories if they don't exist.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | `string` | Yes | Absolute or relative path to the file |
| `content` | `string` | Yes | Content to write |

**Security**: Paths are validated to prevent directory traversal.

**Returns**: Success message with character count and resolved path.

### Edit

Perform exact string replacement in a file.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | `string` | Yes | Absolute or relative path to the file |
| `oldString` | `string` | Yes | Text to find and replace |
| `newString` | `string` | Yes | Replacement text |
| `replaceAll` | `boolean` | No | Replace all occurrences (default: false) |

**Note**: If `oldString` appears multiple times and `replaceAll` is false, returns an error.

**Returns**: Success message with occurrence count.

### Bash

Execute a shell command.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `command` | `string` | Yes | The command to execute |
| `timeout` | `number` | No | Timeout in milliseconds (default: 120000) |
| `workdir` | `string` | No | Working directory for the command |

**Returns**: stdout + stderr + exit code. Success depends on exit code.

### Glob

Find files matching a glob pattern.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pattern` | `string` | Yes | Glob pattern (e.g., `**/*.ts`) |
| `path` | `string` | No | Directory to search in (default: `.`) |

**Returns**: Newline-separated list of matching file paths.

### Grep

Search file contents using regex.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pattern` | `string` | Yes | Regex pattern to search for |
| `path` | `string` | No | Directory to search in (default: `.`) |
| `include` | `string` | No | File pattern to include (default: `*`) |

**Returns**: Matching lines in `file:line:content` format.

### WebFetch

Fetch content from a URL. Strips HTML tags automatically.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | `string` | Yes | URL to fetch |
| `format` | `string` | No | Response format: `markdown`, `text`, or `html` |

**Returns**: Text content (max 10000 chars).

### WebSearch

Search the web using DuckDuckGo HTML.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | `string` | Yes | Search query |
| `numResults` | `number` | No | Number of results to return (default: 5) |

**Returns**: Results in `title - URL` format.

### Agent

Spawn a sub-agent to handle a task.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | `string` | Yes | Task description for the sub-agent |
| `subagentType` | `string` | No | Type of specialized agent (default: `general`) |
| `maxTurns` | `number` | No | Maximum conversation turns (default: 10) |

**Note**: Currently returns a structured placeholder. Full agent spawning requires session management integration.

### TodoWrite

Create and manage a structured task list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `todos` | `Array<{content, status, priority?}>` | Yes | Array of todo items |

**Returns**: Formatted todo list summary.

### Skill

Invoke a skill by name. Executes the skill via `WorkBuddyRuntime.runSkill()`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Name of the skill to execute |
| `message` | `string` | No | Message to pass to the skill |

**Note**: Requires `WorkBuddyRuntime` with LLM configured. Uses `_runtimeRef` closure.

**Returns**: Skill execution output wrapped in `[Skill 'name' result]` header.

---

### Agent

Dispatch a sub-agent to handle a task. Uses the current `AgentLoop` instance.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | `string` | Yes | Task description for the sub-agent |
| `subagentType` | `string` | No | Agent type identifier (default: 'general') |
| `maxTurns` | `number` | No | Maximum turns for the agent (default: 10) |

**Note**: v0.2.0-alpha reuses the same AgentLoop instance (history is reset for each dispatch). v0.2.0-beta will use isolated sub-agents.

**Returns**: Sub-agent execution result (success, output, error).

---

### TodoWrite

Save a todo list to persistent disk storage.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `todos` | `Array<{content, status, priority?}>` | Yes | Array of todo items |

**File**: `.workbuddy/todos/todos.json` — persists across sessions.

**Returns**: Summary of saved items with file path.

OpenAI-compatible LLM API wrapper with function calling support.

```typescript
import { createLLMProvider } from '@workbuddy/runtime';

const llm = createLLMProvider({
  apiUrl: 'https://api.deepseek.com/v1/chat/completions',
  apiKey: 'sk-...',
  model: 'deepseek-chat',
  maxTokens: 4096,
  temperature: 0.1,
}, TOOL_SCHEMAS);

const response = await llm.chat([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello!' }
]);
```

### createLLMProvider(options, toolsSchema?)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options.apiUrl` | `string` | Yes | LLM API endpoint URL |
| `options.apiKey` | `string` | Yes | API authentication key |
| `options.model` | `string` | No | Model name (default: `gpt-4o`) |
| `options.maxTokens` | `number` | No | Maximum tokens (default: 4096) |
| `options.temperature` | `number` | No | Sampling temperature (default: 0.1) |
| `toolsSchema` | `Record<string, ToolSchema>` | No | Tool schemas for function calling |

### Methods

| Method | Return | Description |
|--------|--------|-------------|
| `chat(messages, tools?)` | `Promise<LLMResponse>` | Send messages to LLM, returns content or tool_calls |
| `setToolsSchema(tools)` | `void` | Update tool schemas for function calling |

### LLMResponse

```typescript
interface LLMResponse {
  content?: string;
  tool_calls?: ToolCall[];
}
```

---

## Agent Loop

Multi-turn conversation loop with automatic tool calling.

```typescript
import { createAgentLoop } from '@workbuddy/runtime';

const agentLoop = createAgentLoop(runtime, llmProvider, {
  maxTurns: 20,
  maxTokens: 4096,
  temperature: 0.1,
  tools: TOOL_SCHEMAS,
});

const result = await agentLoop.run(
  'You are a helpful assistant.',
  'What can you do?'
);
```

### createAgentLoop(runtime, llmProvider, config?)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `runtime` | `WorkBuddyRuntime` | Yes | Runtime instance |
| `llmProvider` | `LLMProvider` | Yes | LLM provider instance |
| `config.maxTurns` | `number` | No | Maximum conversation turns (default: 20) |
| `config.maxTokens` | `number` | No | Maximum tokens per response (default: 4096) |
| `config.temperature` | `number` | No | Sampling temperature (default: 0.1) |
| `config.tools` | `Record<string, ToolSchema>` | No | Tool schemas |

### Methods

| Method | Return | Description |
|--------|--------|-------------|
| `run(systemPrompt, userMessage)` | `Promise<AgentLoopResult>` | Start a new conversation |
| `continue(userMessage)` | `Promise<AgentLoopResult>` | Continue existing conversation |
| `reset()` | `void` | Clear conversation history |
| `getMessages()` | `LLMMessage[]` | Get current message history |
| `loadMemoryContext(systemPrompt)` | `Promise<void>` | Load related memory and inject into conversation |
| `saveConversationToMemory(result)` | `Promise<void>` | Save conversation to memory after loop completes |

### Memory Integration (Auto-loaded)

The AgentLoop automatically integrates with the Memory Store:

1. **On `run()` start**: Calls `loadMemoryContext()` to search for related memory entries and inject them before the user message
2. **On `executeLoop()` completion**: Calls `saveConversationToMemory()` to persist the conversation history asynchronously

Memory loading failures do not block the main flow (graceful degradation).

### AgentLoopResult

```typescript
interface AgentLoopResult {
  success: boolean;
  output: string;
  toolCallsCount: number;
  turnsUsed: number;
  error?: string;
}
```

---

## Memory Store

Persistent memory for conversation history and facts.

```typescript
import { createMemoryStore } from '@workbuddy/runtime';

const memory = createMemoryStore('file', '.workbuddy/memory');

await memory.add({
  sessionId: 'session_123',
  type: 'fact',
  content: 'User prefers TypeScript over JavaScript',
  metadata: { source: 'conversation' },
});

const results = await memory.search('TypeScript', { limit: 5 });
```

### createMemoryStore(type, dataDir?)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | `'memory' \| 'file' \| 'api'` | Yes | Store type |
| `dataDir` | `string` | No | Directory for file-based storage |

### MemoryStore Interface

| Method | Return | Description |
|--------|--------|-------------|
| `add(entry)` | `Promise<string>` | Add a memory entry, returns ID |
| `search(query, options?)` | `Promise<MemoryEntry[]>` | Search entries by content |
| `getSessionHistory(sessionId)` | `Promise<MemoryEntry[]>` | Get all entries for a session |
| `clear(sessionId?)` | `Promise<void>` | Clear all entries, or for a specific session |

### InMemoryStore

In-memory implementation. Fast, no persistence.

**Internal Methods**:
- `_loadRaw(entry)` — Directly push a MemoryEntry without generating a new ID. Used by FileMemoryStore during disk loading to preserve original IDs.

### FileMemoryStore

File-based implementation. Persists to disk as JSON files.

**Bug Fixes** (v0.1.0+):
- `loadFromDisk()` now uses `_loadRaw()` instead of `add()` to preserve original IDs
- `clear()` now synchronously deletes disk files in addition to clearing memory
- `clear(sessionId)` selectively deletes only files matching the specified session

**Disk Storage Format**:
Each memory entry is stored as a separate JSON file named `{entry.id}.json` in the `dataDir`.

---

## Orchestrator

Task orchestration with multiple execution modes.

```typescript
import { createOrchestrator } from '@workbuddy/runtime';

const orch = createOrchestrator({
  mode: 'dag',
  maxConcurrency: 4,
  timeoutMs: 60000,
}, runtime);

orch.addTask({ id: 'task1', description: 'Research topic', dependsOn: [], skillSlug: 'deep-research' });
orch.addTask({ id: 'task2', description: 'Write report', dependsOn: ['task1'], skillSlug: 'blog-author' });

const results = await orch.execute();
```

### createOrchestrator(config?, runtime?)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `config.mode` | `OrchestrationMode` | No | Execution mode (default: `linear`) |
| `config.maxConcurrency` | `number` | No | Max parallel tasks (default: 4) |
| `config.timeoutMs` | `number` | No | Task timeout (default: 60000) |
| `config.retryCount` | `number` | No | Retry count (default: 0) |
| `runtime` | `WorkBuddyRuntime` | No | Runtime instance for skill execution |

### Orchestration Modes

| Mode | Description |
|------|-------------|
| `linear` | Execute tasks sequentially in dependency order |
| `fork` | Execute all root tasks in parallel |
| `dag` | Execute tasks respecting dependencies, wait for each dependency |
| `team` | Execute tasks with role-based assignment |

### Methods

| Method | Return | Description |
|--------|--------|-------------|
| `registerRole(role)` | `void` | Register an agent role |
| `addTask(task)` | `void` | Add a task node |
| `addTasks(tasks)` | `void` | Add multiple task nodes |
| `execute()` | `Promise<Map<string, TaskResult>>` | Execute all tasks |
| `getResults()` | `Map<string, TaskResult>` | Get execution results |
| `getTaskStatus(taskId)` | `string` | Get task status |
| `getRoles()` | `AgentRole[]` | Get registered roles |
| `setMode(mode)` | `void` | Change orchestration mode |
| `setConcurrency(max)` | `void` | Set max concurrency |
| `setTimeout(ms)` | `void` | Set task timeout |

---

## Skill Loader

Load and parse skills from the filesystem.

```typescript
import { loadSkill, listSkills, loadAllSkills, searchSkills, parseFrontmatter, validateSkill } from '@workbuddy/runtime';

const skill = loadSkill('/path/to/skills/deep-research');
const skills = listSkills('/path/to/skills');
const results = searchSkills(skills, 'research');
```

### Functions

| Function | Return | Description |
|----------|--------|-------------|
| `loadSkill(directory)` | `Skill` | Load a single skill from directory |
| `listSkills(skillsDir)` | `SkillIndexEntry[]` | List all skills with metadata |
| `loadAllSkills(skillsDir)` | `Skill[]` | Load all skills from directory |
| `searchSkills(skills, query)` | `Skill[]` | Search skills by query |
| `parseFrontmatter(content)` | `SkillFrontmatter` | Parse YAML frontmatter |
| `validateSkill(skill)` | `string[]` | Validate skill, returns warning list |

---

## Configuration

### RuntimeConfig

| Field | Type | Default | Environment Variable |
|-------|------|---------|---------------------|
| `skillsDir` | `string` | `./skills` | `WORKBUDDY_SKILLS_DIR` |
| `memoryStore` | `'memory' \| 'file' \| 'api'` | `'memory'` | `WORKBUDDY_MEMORY_STORE` |
| `memoryApiUrl` | `string` | - | `WORKBUDDY_MEMORY_API_URL` |
| `maxToolTimeoutMs` | `number` | `120000` | - |
| `allowedTools` | `ToolName[]` | [8 default tools] | `WORKBUDDY_ALLOWED_TOOLS` |
| `logLevel` | `'debug' \| 'info' \| 'warn' \| 'error'` | `'info'` | `WORKBUDDY_LOG_LEVEL` |
| `llmApiUrl` | `string` | - | `WORKBUDDY_LLM_API_URL` |
| `llmApiKey` | `string` | - | `WORKBUDDY_LLM_API_KEY` |
| `llmModel` | `string` | `'gpt-4o'` | `WORKBUDDY_LLM_MODEL` |
| `llmMaxTokens` | `number` | `4096` | `WORKBUDDY_LLM_MAX_TOKENS` |
| `llmTemperature` | `number` | `0.1` | `WORKBUDDY_LLM_TEMPERATURE` |

### loadConfig(overrides?)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `overrides` | `Partial<RuntimeConfig>` | No | Configuration overrides |

**Returns**: `RuntimeConfig` merged from defaults, environment variables, and overrides.

### mergeConfig(base, overrides)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `base` | `RuntimeConfig` | Yes | Base configuration |
| `overrides` | `Partial<RuntimeConfig>` | Yes | Overrides to apply |

**Returns**: New `RuntimeConfig` with overrides applied.

---

## Session Manager

Manages session lifecycle with state machine and disk persistence.

```typescript
import { SessionManager, SessionState, SessionStatus } from '@workbuddy/runtime';
import { getSessionManager } from '@workbuddy/runtime/session/session-manager';
```

### `getSessionManager(config?)`

Returns singleton `SessionManager` instance.

```typescript
const manager = getSessionManager({ maxConcurrent: 10, ttlMs: 24 * 60 * 60 * 1000 });
```

### `create(sessionId?, options?)`

Creates a new session.

```typescript
const session = manager.create('my-session', { skillSlug: 'deep-research' });
// → { sessionId: 'my-session', status: 'idle', turnsCount: 0, ... }
```

- `sessionId`: Optional custom ID. Auto-generated if omitted.
- `options.skillSlug`: Associate with a skill.
- Throws if `maxConcurrent` reached or ID already exists.

### `get(sessionId)`

Get session by ID. Returns `SessionState | null`.

### `updateStatus(sessionId, status)`

Update session status. Throws if session not found.

```typescript
manager.updateStatus('my-session', 'working');
manager.updateStatus('my-session', 'completed');
```

### `list()`

Returns all sessions sorted by `lastActivityAt` (newest first).

### `remove(sessionId)`

Removes session from memory and disk. Returns `true` if existed.

### `cleanup()`

Removes completed/failed/timed_out sessions and expired ones (TTL exceeded). Returns count removed.

### `getActiveCount()`

Returns number of currently tracked sessions.

### SessionState

```typescript
interface SessionState {
  sessionId: string;
  status: SessionStatus;        // 'idle' | 'planning' | 'working' | 'completed' | 'failed' | 'timed_out'
  skillSlug: string | null;
  createdAt: number;
  lastActivityAt: number;
  turnsCount: number;
  toolCallsCount: number;
  error?: string;
}
```

### SessionStatus

```typescript
type SessionStatus = 'idle' | 'planning' | 'working' | 'completed' | 'failed' | 'timed_out';
```

**Status flow:**
```
idle → planning → working → completed (ideal)
                           → failed (error)
                           → timed_out (timeout)
```

---

## Skill Script Runner

Executes scripts from skill's `scripts/` directory.

```typescript
import { executeSkillScript, listSkillScripts, getSkillScriptRunner } from '@workbuddy/runtime';
```

### `listScripts(skill)`

Returns script filenames `.js/.ts/.sh/.bat` in the skill's `scripts/` directory.

```typescript
const scripts = runner.listScripts(skill);
// → ['setup.js', 'analyze.sh']
```

### `executeScript(skill, scriptName, args?)`

Executes a script with timeout (default 30s). Uses `spawn()` for command injection safety.

```typescript
const result = await runner.executeScript(skill, 'setup.js', ['--verbose']);
// → { success: true, output: 'Setup complete' }
```

**Returns `ToolResult`:**
- `success: true`: Script completed with exit code 0.
- `success: false`: Script timed out, returned non-zero, or execution error.

---

## CLI Commands

```bash
node runtime/dist/cli.js <command> [options]
```

| Command | Description |
|---------|-------------|
| `list` | List all available skills |
| `search <query>` | Search skills by query |
| `info <slug>` | Show skill details |
| `run <slug> [message]` | Execute a skill with LLM |
| `chat` | Start interactive chat mode |
| `config` | Show current configuration |

### run command

```bash
node runtime/dist/cli.js run deep-research "用一句话介绍你的能力"
```

Requires `WORKBUDDY_LLM_API_URL` and `WORKBUDDY_LLM_API_KEY` environment variables.

### chat mode

Interactive REPL. Type `/exit` to quit, `/clear` to reset conversation.

---

## Type Definitions

### ToolName

```typescript
type ToolName =
  | 'Read' | 'Write' | 'Edit' | 'Bash'
  | 'Glob' | 'Grep' | 'WebFetch' | 'WebSearch'
  | 'Agent' | 'TodoWrite' | 'Task' | 'Skill';
```

### ToolResult

```typescript
interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}
```

### ToolExecutor

```typescript
type ToolExecutor = (args: Record<string, unknown>) => Promise<ToolResult>;
```

### Skill

```typescript
interface Skill {
  slug: string;
  frontmatter: SkillFrontmatter;
  body: string;
  directory: string;
  hasScripts: boolean;
  hasReferences: boolean;
  hasAssets: boolean;
  hasTemplates: boolean;
  scriptPaths: string[];
  referencePaths: string[];
}
```

### MemoryEntry

```typescript
interface MemoryEntry {
  id: string;
  sessionId: string;
  type: 'fact' | 'conversation' | 'preference' | 'decision';
  content: string;
  metadata: Record<string, unknown>;
  createdAt: number;
}
```

### TaskNode

```typescript
interface TaskNode {
  id: string;
  description: string;
  dependsOn: string[];
  assignedRole?: string;
  skillSlug?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}
```

### TaskResult

```typescript
interface TaskResult {
  taskId: string;
  status: 'completed' | 'failed';
  output: string;
  error?: string;
  duration: number;
}
```

### OrchestrationMode

```typescript
type OrchestrationMode = 'fork' | 'linear' | 'dag' | 'team';
```

### SessionStatus

```typescript
type SessionStatus = 'idle' | 'planning' | 'working' | 'completed' | 'failed' | 'timed_out';
```

### SessionState

```typescript
interface SessionState {
  sessionId: string;
  status: SessionStatus;
  skillSlug: string | null;
  createdAt: number;
  lastActivityAt: number;
  turnsCount: number;
  toolCallsCount: number;
  error?: string;
}
```

### SessionConfig

```typescript
interface SessionConfig {
  maxConcurrent: number;
  ttlMs: number;
  maxTurnsPerSession: number;
  cleanupIntervalMs: number;
}
```

---

## Quick Start

```bash
# 1. Set environment variables
export WORKBUDDY_SKILLS_DIR=./skills
export WORKBUDDY_LLM_API_URL=https://api.deepseek.com/v1/chat/completions
export WORKBUDDY_LLM_API_KEY=sk-your-key-here
export WORKBUDDY_LLM_MODEL=deepseek-chat

# 2. List skills
node runtime/dist/cli.js list

# 3. Run a skill
node runtime/dist/cli.js run deep-research "What is the future of AI?"

# 4. Start interactive chat
node runtime/dist/cli.js chat

# 5. Run tests
cd runtime && npx vitest run
```
