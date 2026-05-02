import { ToolExecutor, ToolResult } from './types';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve, normalize } from 'path';
import { exec, ExecOptions, ExecException } from 'child_process';
import { glob as globNative } from 'glob';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_LINES = 2000;
const MAX_LINE_LENGTH = 2000;

function toString(x: string | Buffer | undefined): string {
  if (typeof x === 'string') return x;
  if (x instanceof Buffer) return x.toString('utf-8');
  return '';
}

// A1. Path traversal prevention: resolve and validate path stays within workDir
function resolveAndValidatePath(filePath: string, workDir?: string): { resolved: string; error?: string } {
  const baseDir = workDir ? resolve(workDir) : process.cwd();
  const resolvedPath = resolve(baseDir, filePath);
  // Ensure the resolved path starts with the base directory
  if (!resolvedPath.startsWith(baseDir)) {
    return { resolved: resolvedPath, error: `Path traversal detected: '${filePath}' resolves outside allowed directory` };
  }
  return { resolved: resolvedPath };
}

// ===== Read Tool =====
export const readExecutor: ToolExecutor = async (args: Record<string, unknown>): Promise<ToolResult> => {
  const filePath = args['filePath'] as string;
  if (!filePath) return { success: false, output: '', error: 'Missing filePath' };

  const { resolved, error: pathError } = resolveAndValidatePath(filePath);
  if (pathError) return { success: false, output: '', error: pathError };

  if (!existsSync(resolved)) {
    return { success: false, output: '', error: `File not found: ${resolved}` };
  }

  try {
    const stats = statSync(resolved);
    if (!stats.isFile()) {
      const files = readdirSync(resolved);
      const lines = files.map(f => {
        const full = join(resolved, f);
        const s = statSync(full);
        const type = s.isDirectory() ? 'd' : '-';
        return `${type} ${f}`;
      });
      return { success: true, output: lines.join('\n') };
    }

    if (stats.size > MAX_FILE_SIZE) {
      return { success: false, output: '', error: `File too large: ${stats.size} bytes (max ${MAX_FILE_SIZE})` };
    }

    let content = readFileSync(resolved, 'utf-8');
    let lines = content.split('\n');

    const offset = (args['offset'] as number) || 1;
    const limit = (args['limit'] as number) || MAX_LINES;

    const startIdx = Math.max(0, offset - 1);
    const endIdx = Math.min(lines.length, startIdx + limit);

    lines = lines.slice(startIdx, endIdx);

    lines = lines.map(line =>
      line.length > MAX_LINE_LENGTH ? line.substring(0, MAX_LINE_LENGTH) + '...[truncated]' : line
    );

    return { success: true, output: lines.join('\n') };
  } catch (e: any) {
    return { success: false, output: '', error: e.message };
  }
};

// ===== Write Tool =====
export const writeExecutor: ToolExecutor = async (args: Record<string, unknown>): Promise<ToolResult> => {
  const filePath = args['filePath'] as string;
  const content = args['content'] as string;

  if (!filePath) return { success: false, output: '', error: 'Missing filePath' };
  if (content === undefined) return { success: false, output: '', error: 'Missing content' };

  const { resolved, error: pathError } = resolveAndValidatePath(filePath);
  if (pathError) return { success: false, output: '', error: pathError };

  try {
    const dir = dirname(resolved);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(resolved, content, 'utf-8');
    return { success: true, output: `Written ${content.length} chars to ${resolved}` };
  } catch (e: any) {
    return { success: false, output: '', error: e.message };
  }
};

// ===== Edit Tool =====
export const editExecutor: ToolExecutor = async (args: Record<string, unknown>): Promise<ToolResult> => {
  const filePath = args['filePath'] as string;
  const oldString = args['oldString'] as string;
  const newString = args['newString'] as string;
  const replaceAll = (args['replaceAll'] as boolean) || false;

  if (!filePath) return { success: false, output: '', error: 'Missing filePath' };
  if (oldString === undefined) return { success: false, output: '', error: 'Missing oldString' };
  if (newString === undefined) return { success: false, output: '', error: 'Missing newString' };

  const { resolved, error: pathError } = resolveAndValidatePath(filePath);
  if (pathError) return { success: false, output: '', error: pathError };

  if (!existsSync(resolved)) {
    return { success: false, output: '', error: `File not found: ${resolved}` };
  }

  try {
    let content = readFileSync(resolved, 'utf-8');

    if (oldString === newString) {
      return { success: false, output: '', error: 'oldString and newString are the same' };
    }

    const count = content.split(oldString).length - 1;
    if (count === 0) {
      return { success: false, output: '', error: `oldString not found in file: ${resolved}` };
    }

    if (!replaceAll && count > 1) {
      return {
        success: false,
        output: '',
        error: `oldString found ${count} times (needs to be unique). Use replaceAll=true to replace all.`
      };
    }

    const newContent = replaceAll
      ? content.split(oldString).join(newString)
      : content.replace(oldString, newString);

    writeFileSync(resolved, newContent, 'utf-8');
    return { success: true, output: `Replaced ${replaceAll ? count : 1} occurrence(s) in ${resolved}` };
  } catch (e: any) {
    return { success: false, output: '', error: e.message };
  }
};

// ===== Bash Tool =====
function execPromise(command: string, timeoutMs: number): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const opts: ExecOptions = { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 };
    const proc = exec(command, opts, (error: ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => {
      const out = toString(stdout);
      const err = toString(stderr);
      const exitCode = error ? ((error as any).code || 1) : 0;
      resolve({ stdout: out, stderr: err, exitCode });
    });
    proc.on('timeout', () => {
      proc.kill();
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    });
  });
}

export const bashExecutor: ToolExecutor = async (args: Record<string, unknown>): Promise<ToolResult> => {
  const command = args['command'] as string;
  const timeout = (args['timeout'] as number) || 120_000;
  const workdir = (args['workdir'] as string) || undefined;

  if (!command) return { success: false, output: '', error: 'Missing command' };

  try {
    const opts: ExecOptions = { timeout, maxBuffer: 10 * 1024 * 1024, cwd: workdir };
    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
      const proc = exec(command, opts, (error: ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => {
        const out = toString(stdout);
        const err = toString(stderr);
        const exitCode = error ? ((error as any).code || 1) : 0;
        resolve({ stdout: out, stderr: err, exitCode });
      });
      proc.on('timeout', () => {
        proc.kill();
        reject(new Error(`Command timed out after ${timeout}ms`));
      });
    });

    let output = result.stdout;
    if (result.stderr) {
      output += `\n[stderr]\n${result.stderr}`;
    }
    if (result.exitCode !== 0) {
      output += `\n[exit code: ${result.exitCode}]`;
    }
    return { success: result.exitCode === 0, output };
  } catch (e: any) {
    return { success: false, output: '', error: e.message };
  }
};

// ===== Glob Tool (Native Node.js) =====
export const globExecutor: ToolExecutor = async (args: Record<string, unknown>): Promise<ToolResult> => {
  const pattern = args['pattern'] as string;
  const basePath = (args['path'] as string) || '.';

  if (!pattern) return { success: false, output: '', error: 'Missing pattern' };

  try {
    const files = await globNative(pattern, {
      cwd: basePath,
      nodir: false,
      maxDepth: 10,
    });
    return { success: true, output: files.join('\n') || 'No files found.' };
  } catch (e: any) {
    return { success: false, output: '', error: e.message };
  }
};

// ===== Grep Tool (Native Node.js) =====
export const grepExecutor: ToolExecutor = async (args: Record<string, unknown>): Promise<ToolResult> => {
  const pattern = args['pattern'] as string;
  const basePath = (args['path'] as string) || '.';
  const include = (args['include'] as string) || '*';

  if (!pattern) return { success: false, output: '', error: 'Missing pattern' };

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, 'gi');
  } catch (e: any) {
    return { success: false, output: '', error: `Invalid regex pattern: ${e.message}` };
  }

  try {
    const files = await globNative(include, { cwd: basePath, nodir: true, maxDepth: 10 });
    const matches: string[] = [];

    for (const file of files.slice(0, 100)) {
      const fullPath = join(basePath, file);
      try {
        const content = readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (regex.test(line)) {
            matches.push(`${fullPath}:${index + 1}:${line.trim()}`);
          }
          regex.lastIndex = 0; // Reset for global regex
        });
      } catch {
        // Skip unreadable files
      }
    }

    return { success: true, output: matches.slice(0, 50).join('\n') || 'No matches found.' };
  } catch (e: any) {
    return { success: false, output: '', error: e.message };
  }
};

// ===== WebFetch Tool (Native fetch) =====
export const webFetchExecutor: ToolExecutor = async (args: Record<string, unknown>): Promise<ToolResult> => {
  const url = args['url'] as string;
  if (!url) return { success: false, output: '', error: 'Missing url' };

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WorkBuddy/1.0)' },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      return { success: false, output: '', error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const html = await response.text();
    let text = html
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return { success: true, output: text.substring(0, 10000) };
  } catch (e: any) {
    return { success: false, output: '', error: e.message };
  }
};

// ===== WebSearch Tool (DuckDuckGo HTML) =====
export const webSearchExecutor: ToolExecutor = async (args: Record<string, unknown>): Promise<ToolResult> => {
  const query = args['query'] as string;
  // A3. Fixed: use numResults to match schema definition (was 'count')
  const count = (args['numResults'] as number) || 5;

  if (!query) return { success: false, output: '', error: 'Missing query' };

  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WorkBuddy/1.0)' },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return { success: false, output: '', error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const html = await response.text();
    const results: string[] = [];
    const linkRegex = /<a class="result__url"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null && results.length < count) {
      // A4. Resolve relative URLs to absolute
      let url = match[1].trim();
      try {
        url = new URL(url, 'https://html.duckduckgo.com').href;
      } catch {
        // Keep original if URL parsing fails
      }
      results.push(`${match[2].trim()} - ${url}`);
    }

    return { success: true, output: results.join('\n') || 'No results found.' };
  } catch (e: any) {
    return { success: false, output: '', error: e.message };
  }
};

// ===== Agent Tool (Sub-Agent Dispatch) =====
let _runtimeRef: any = null;

export function setSkillRuntimeRef(runtime: any): void {
  _runtimeRef = runtime;
}

export const agentExecutor: ToolExecutor = async (args: Record<string, unknown>): Promise<ToolResult> => {
  const prompt = args['prompt'] as string;
  const subagentType = (args['subagentType'] as string) || 'general';
  const maxTurns = (args['maxTurns'] as number) || 10;

  if (!prompt) return { success: false, output: '', error: 'Missing prompt' };

  if (!_runtimeRef || !_runtimeRef.getAgentLoop()) {
    return { success: false, output: '', error: 'Agent tool requires LLM configuration.' };
  }

  // 构建子代理的系统提示
  const systemPrompt = `You are a specialized sub-agent of type '${subagentType}'. Your task is: ${prompt}. Provide a concise, focused response.`;
  const userMessage = `Execute the following task: ${prompt}`;

  try {
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

// ===== Skill Tool (Skill Invocation) =====
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
  const existingMap = new Map(existing.map(t => [t.content, t]));

  // 合并：新列表覆盖已有项
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

// ===== Registration Helper =====
import { ToolRouter as ToolRouterClass } from './tool-router';

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
}
