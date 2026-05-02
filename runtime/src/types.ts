export interface SkillFrontmatter {
  name: string;
  description: string;
  description_zh?: string;
  description_en?: string;
  version: string;
  homepage?: string;
  'allowed-tools'?: string;
  metadata?: {
    version?: string;
    tags?: string[];
    category?: string;
    quality?: 'alpha' | 'beta' | 'stable';
    requires?: string[];
  };
}

export interface Skill {
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

export interface SkillIndexEntry {
  slug: string;
  name: string;
  description: string;
  description_zh: string;
  version: string;
  category?: string;
  quality?: string;
  tags?: string[];
}

export type OrchestrationMode = 'fork' | 'linear' | 'dag' | 'team';

export interface AgentRole {
  id: string;
  name: string;
  description: string;
  skills: string[];
}

export interface TaskNode {
  id: string;
  description: string;
  dependsOn: string[];
  assignedRole?: string;
  skillSlug?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface TaskResult {
  taskId: string;
  status: 'completed' | 'failed';
  output: string;
  error?: string;
  duration: number;
}

export interface OrchestratorConfig {
  mode: OrchestrationMode;
  maxConcurrency: number;
  timeoutMs: number;
  retryCount: number;
}

export interface MemoryEntry {
  id: string;
  sessionId: string;
  type: 'fact' | 'conversation' | 'preference' | 'decision';
  content: string;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface MemoryStore {
  add(entry: Omit<MemoryEntry, 'id' | 'createdAt'>): Promise<string>;
  search(query: string, options?: MemorySearchOptions): Promise<MemoryEntry[]>;
  getSessionHistory(sessionId: string): Promise<MemoryEntry[]>;
  clear(sessionId?: string): Promise<void>;
}

export interface MemorySearchOptions {
  startDate?: string;
  endDate?: string;
  limit?: number;
  type?: MemoryEntry['type'];
}

export type ToolName =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Bash'
  | 'Glob'
  | 'Grep'
  | 'WebFetch'
  | 'WebSearch'
  | 'Agent'
  | 'TodoWrite'
  | 'Task'
  | 'Skill';

export interface ToolSchema {
  name: ToolName;
  description: string;
  parameters: Record<string, {
    type: string;
    required: boolean;
    description: string;
  }>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export type ToolExecutor = (args: Record<string, unknown>) => Promise<ToolResult>;

export interface RuntimeConfig {
  skillsDir: string;
  memoryStore: 'memory' | 'file' | 'api';
  memoryApiUrl?: string;
  maxToolTimeoutMs: number;
  allowedTools: ToolName[];
  systemPrompt?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  timeout?: number;  // 全局超时（毫秒），覆盖 Agent Loop 超时
  // LLM config
  llmApiUrl?: string;
  llmApiKey?: string;
  llmModel?: string;
  llmMaxTokens?: number;
  llmTemperature?: number;
}

export interface SessionContext {
  sessionId: string;
  skill: Skill | null;
  messages: { role: string; content: string }[];
  tools: Map<ToolName, ToolExecutor>;
  memory: MemoryStore;
  config: RuntimeConfig;
}

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
  create(sessionId?: string, options?: { skillSlug?: string }): SessionState;
  get(sessionId: string): SessionState | null;
  updateStatus(sessionId: string, status: SessionStatus): void;
  list(): SessionState[];
  remove(sessionId: string): boolean;
  cleanup(): number;            // 清理过期会话，返回清理数量
  getActiveCount(): number;
}
