import readline from 'node:readline';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { WorkBuddyRuntime } from './index';
import { loadConfig } from './config';

// ===== ANSI 颜色工具 =====
const color = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

// ===== 全局参数解析 =====
interface GlobalFlags {
  json: boolean;
  session: string | undefined;
  timeout: number | undefined;
}

function parseFlags(args: string[]): { flags: GlobalFlags; rest: string[] } {
  const flags: GlobalFlags = { json: false, session: undefined, timeout: undefined };
  const rest: string[] = [];
  for (const arg of args) {
    if (arg === '--json') flags.json = true;
    else if (arg.startsWith('--session=')) flags.session = arg.split('=')[1];
    else if (arg.startsWith('--session ')) { /* handled in next iteration */ }
    else if (arg === '--session') { /* skip, handled below */ }
    else if (arg.startsWith('--timeout=')) flags.timeout = parseInt(arg.split('=')[1], 10);
    else rest.push(arg);
  }
  return { flags, rest };
}

function parseArgs(argv: string[]): { flags: GlobalFlags; command: string; args: string[] } {
  const parts = [];
  let i = 0;
  while (i < argv.length) {
    if (argv[i] === '--json') i++;
    else if (argv[i] === '--session') { i++; if (i < argv.length) i++; }
    else if (argv[i].startsWith('--session=')) i++;
    else if (argv[i] === '--timeout') { i++; if (i < argv.length) i++; }
    else if (argv[i].startsWith('--timeout=')) i++;
    else parts.push(argv[i++]);
  }

  const { flags } = parseFlags(argv);
  const command = parts[0] || '';
  const args = parts.slice(1);
  return { flags, command, args };
}

// ===== 加载动画 =====
let loadingInterval: ReturnType<typeof setInterval> | null = null;

function startLoading(msg: string): void {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  process.stdout.write(` ${frames[0]} ${msg}`);
  loadingInterval = setInterval(() => {
    i = (i + 1) % frames.length;
    process.stdout.write(`\r\x1b[K ${frames[i]} ${msg}`);
  }, 80);
}

function stopLoading(): void {
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
    process.stdout.write('\r\x1b[K');
  }
}

// ===== JSON 输出工具 =====
function printJSON(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  const { flags, command, args: cmdArgs } = parseArgs(process.argv.slice(2));

  const useJson = flags.json;
  const sessionId = flags.session;
  const timeout = flags.timeout;

  // 加载时静默化 console.log（避免打断 spinner）
  const originalLog = console.log;
  let loadingSilenced = false;

  function silenceLogging() {
    loadingSilenced = true;
    console.log = () => {};
  }

  function restoreLogging() {
    if (loadingSilenced) {
      console.log = originalLog;
      loadingSilenced = false;
    }
  }

  switch (command) {
    case 'run': {
      const skillName = cmdArgs[0];
      if (!skillName) {
        console.error('Usage: workbuddy run [--json] <skill-name> [user-message...]');
        process.exit(1);
      }

      const userMessage = cmdArgs.slice(1).join(' ') || undefined;

      silenceLogging();
      startLoading(color.dim(`Loading skills...`));
      const runtime = new WorkBuddyRuntime(timeout ? { timeout } : undefined);
      await runtime.initialize();
      stopLoading();
      restoreLogging();

      const skill = runtime.getSkill(skillName);
      if (!skill) {
        if (useJson) {
          printJSON({ success: false, error: `Skill '${skillName}' not found` });
        } else {
          console.error(`${color.red('✗')} Skill '${skillName}' not found`);
        }
        process.exit(1);
      }

      if (!useJson) {
        console.log(`${color.cyan('→')} Running skill: ${color.bold(skill.frontmatter.name || skillName)}`);
      }

      startLoading(color.dim(`Running...`));
      const output = await runtime.runSkill(skillName, userMessage);
      stopLoading();
      restoreLogging();

      if (useJson) {
        printJSON({ success: true, skill: skillName, output });
      } else {
        console.log(`\n${output}\n`);
      }
      break;
    }

    case 'list': {
      silenceLogging();
      startLoading(color.dim(`Loading skills...`));
      const runtime = new WorkBuddyRuntime();
      await runtime.initialize();
      stopLoading();
      restoreLogging();

      const skills = runtime.listAllSkills();
      skills.sort((a, b) => a.slug.localeCompare(b.slug));

      if (useJson) {
        printJSON(skills.map(s => ({
          slug: s.slug,
          name: s.frontmatter.name || s.slug,
          version: s.frontmatter.version,
          description: s.frontmatter.description,
        })));
      } else {
        console.log(`\n${color.bold('WorkBuddy Skills')} (${skills.length}):\n`);
        console.log('| # | Slug | Name | Description | Version |');
        console.log('|---|------|------|-------------|---------|');
        skills.forEach((skill, i) => {
          const { frontmatter } = skill;
          const name = frontmatter.name || skill.slug;
          const desc = (frontmatter.description || '').substring(0, 60);
          const ver = frontmatter.version || 'unknown';
          console.log(`| ${i + 1} | ${skill.slug} | ${name} | ${desc} | ${ver} |`);
        });
      }
      break;
    }

    case 'search': {
      const query = cmdArgs.join(' ');
      if (!query) {
        console.error('Usage: workbuddy search [--json] <query>');
        process.exit(1);
      }

      silenceLogging();
      startLoading(color.dim(`Searching...`));
      const runtime = new WorkBuddyRuntime();
      await runtime.initialize();
      stopLoading();
      restoreLogging();

      const results = runtime.searchSkills(query);

      if (useJson) {
        printJSON(results.map(s => ({
          slug: s.slug,
          name: s.frontmatter.name || s.slug,
          description: s.frontmatter.description,
        })));
      } else {
        console.log(`\n${color.bold('Search results')} for "${query}" (${results.length} matches):\n`);
        results.forEach(skill => {
          const { frontmatter } = skill;
          console.log(`  ${color.cyan(skill.slug)}: ${frontmatter.description || 'No description'}`);
        });
      }
      break;
    }

    case 'info': {
      const skillName = cmdArgs[0];
      if (!skillName) {
        console.error('Usage: workbuddy info [--json] <skill-name>');
        process.exit(1);
      }

      silenceLogging();
      startLoading(color.dim(`Loading...`));
      const runtime = new WorkBuddyRuntime();
      await runtime.initialize();
      stopLoading();
      restoreLogging();

      const skill = runtime.getSkill(skillName);
      if (!skill) {
        if (useJson) {
          printJSON({ error: `Skill '${skillName}' not found` });
        } else {
          console.error(`${color.red('✗')} Skill '${skillName}' not found`);
        }
        process.exit(1);
      }

      const { frontmatter } = skill;
      if (useJson) {
        printJSON({
          slug: skill.slug,
          name: frontmatter.name || skill.slug,
          version: frontmatter.version,
          description: frontmatter.description,
          description_zh: frontmatter.description_zh,
          homepage: frontmatter.homepage,
          allowedTools: frontmatter['allowed-tools'],
          tags: frontmatter.metadata?.tags,
          category: frontmatter.metadata?.category,
          quality: frontmatter.metadata?.quality,
          hasScripts: skill.hasScripts,
          hasReferences: skill.hasReferences,
          hasAssets: skill.hasAssets,
          hasTemplates: skill.hasTemplates,
        });
      } else {
        console.log(`\n${color.bold('Skill:')} ${skill.slug}`);
        console.log(`  ${color.cyan('Name:')}        ${frontmatter.name || skill.slug}`);
        console.log(`  ${color.cyan('Version:')}     ${frontmatter.version}`);
        console.log(`  ${color.cyan('Description:')} ${frontmatter.description}`);
        if (frontmatter.description_zh) console.log(`  ${color.cyan('中文描述:')}   ${frontmatter.description_zh}`);
        if (frontmatter.homepage) console.log(`  ${color.cyan('Homepage:')}     ${frontmatter.homepage}`);
        if (frontmatter['allowed-tools']) console.log(`  ${color.cyan('Tools:')}       ${frontmatter['allowed-tools']}`);
        if (frontmatter.metadata) {
          if (frontmatter.metadata.tags) console.log(`  ${color.cyan('Tags:')}        ${frontmatter.metadata.tags.join(', ')}`);
          if (frontmatter.metadata.category) console.log(`  ${color.cyan('Category:')}    ${frontmatter.metadata.category}`);
          if (frontmatter.metadata.quality) console.log(`  ${color.cyan('Quality:')}     ${frontmatter.metadata.quality}`);
        }
        console.log(`  ${color.cyan('Scripts:')}     ${skill.hasScripts}`);
        console.log(`  ${color.cyan('Refs:')}        ${skill.hasReferences}`);
        console.log(`  ${color.cyan('Assets:')}      ${skill.hasAssets}`);
        console.log(`  ${color.cyan('Templates:')}   ${skill.hasTemplates}`);
      }
      break;
    }

    case 'chat': {
      const skillName = cmdArgs[0];
      if (!skillName) {
        console.error('Usage: workbuddy chat [--session=<id>] <skill-name>');
        process.exit(1);
      }

      silenceLogging();
      startLoading(color.dim(`Loading skills...`));
      const runtime = new WorkBuddyRuntime();
      await runtime.initialize();
      stopLoading();
      restoreLogging();

      const skill = runtime.getSkill(skillName);
      if (!skill) {
        console.error(`${color.red('✗')} Skill '${skillName}' not found`);
        process.exit(1);
      }

      console.log(`\n${color.green('●')} Chat mode: ${color.bold(skill.frontmatter.name || skillName)}`);
      if (sessionId) console.log(`  ${color.dim('Session:')} ${sessionId}`);
      console.log(`  ${color.dim('Type /exit to quit, /clear to clear history.')}\n`);

      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      const askQuestion = () => {
        rl.question(`${color.green('You')}: `, async (input: string) => {
          if (input === '/exit') {
            rl.close();
            return;
          }
          if (input === '/clear') {
            const agentLoop = runtime.getAgentLoop();
            if (agentLoop) agentLoop.reset();
            console.log(`${color.yellow('↻')} History cleared.`);
            askQuestion();
            return;
          }

          silenceLogging();
          startLoading(color.dim(`Thinking...`));
          const output = await runtime.runSkill(skillName, input);
          stopLoading();
          restoreLogging();

          console.log(`\n${color.cyan('Agent')}: ${output}\n`);
          askQuestion();
        });
      };

      askQuestion();
      return;
    }

    case 'config': {
      const runtime = new WorkBuddyRuntime();
      await runtime.initialize();

      const config = runtime.getConfig();
      if (useJson) {
        printJSON(config);
      } else {
        console.log(`\n${color.bold('WorkBuddy Configuration')}\n`);
        console.log(`  ${color.cyan('Skills directory:')} ${config.skillsDir || '(not set)'}`);
        console.log(`  ${color.cyan('Memory store:')}     ${config.memoryStore || 'memory'}`);
        console.log(`  ${color.cyan('Allowed tools:')}    ${config.allowedTools.join(', ')}`);
        console.log(`  ${color.cyan('LLM API URL:')}      ${config.llmApiUrl || color.red('(not set)')}`);
        console.log(`  ${color.cyan('LLM Model:')}        ${config.llmModel || color.red('(not set)')}`);
        console.log(`  ${color.cyan('LLM Max Tokens:')}   ${config.llmMaxTokens || '(default: 4096)'}`);
        console.log(`  ${color.cyan('LLM Temperature:')}  ${config.llmTemperature ?? '(default: 0.1)'}`);
      }
      break;
    }

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
        sessions.forEach((s: any, i: number) => {
          const statusColor: Record<string, (x: string) => string> = {
            idle: color.dim,
            planning: color.yellow,
            working: color.green,
            completed: color.cyan,
            failed: color.red,
            timed_out: color.red,
          };
          const c = statusColor[s.status] || ((x: string) => x);
          const skillName = s.skillSlug || '(none)';
          const lastActivity = new Date(s.lastActivityAt).toLocaleTimeString();
          console.log(
            `| ${i + 1} | ${s.sessionId} | ${c(s.status)} | ${skillName} | ${s.turnsCount} | ${s.toolCallsCount} | ${lastActivity} |`
          );
        });
        console.log(`\n${color.dim('TTL: 24h | Max concurrent: 10')}`);
      }
      break;
    }

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

    case 'tui': {
      const skillName = cmdArgs[0];
      if (!skillName) {
        console.error('Usage: workbuddy tui <skill-name>');
        process.exit(1);
      }

      // Suppress runtime initialization logs to avoid Ink conflicts
      const originalLog = console.log;
      console.log = () => {};

      const runtime = new WorkBuddyRuntime(timeout ? { timeout } : undefined);
      await runtime.initialize();
      console.log = originalLog;

      const skill = runtime.getSkill(skillName);
      if (!skill) {
        console.error(`${color.red('✗')} Skill '${skillName}' not found`);
        process.exit(1);
      }

      try {
        const { runTUI } = await import('./tui/index.js');
        await runTUI({ runtime, skillName });
      } catch (e: any) {
        console.error(`${color.red('✗')} TUI error: ${e.message}`);
        process.exit(1);
      }
      break;
    }

    default: {
      console.log(`
${color.bold('WorkBuddy')} - Open-source AI Assistant Framework

${color.yellow('Usage:')}
  workbuddy [--json] [--session=<id>] chat <skill-name>  Start interactive chat
  workbuddy [--json] run <skill-name> [message]           Run a skill
  workbuddy [--json] list                                  List all skills
  workbuddy [--json] search <query>                        Search skills
  workbuddy [--json] info <skill-name>                     Show skill details
  workbuddy [--json] config                                Show configuration
  workbuddy [--json] sessions                               List active sessions
  workbuddy tui <skill-name>                               Start TUI chat interface
  workbuddy todos list [--status=x] [--priority=x]          List todos
  workbuddy todos add <msg> [--priority=x]                  Add a todo
  workbuddy todos complete <idx> [<idx> ...]                Mark todos complete
  workbuddy todos cancel <idx> [<idx> ...]                  Cancel todos
  workbuddy todos delete <idx> [<idx> ...]                  Delete todos
  workbuddy todos clear [--all]                             Clear finished todos

${color.yellow('Global flags:')}
  --json                    Output results as JSON
  --session=<session-id>    Specify session ID (for chat)
  --timeout=<ms>            Set max tool timeout in milliseconds

${color.yellow('Environment variables:')}
  WORKBUDDY_SKILLS_DIR           Path to skills directory
  WORKBUDDY_MEMORY_STORE         Memory store type: memory|file|api
  WORKBUDDY_LLM_API_URL          LLM API URL (OpenAI-compatible)
  WORKBUDDY_LLM_API_KEY          LLM API Key
  WORKBUDDY_LLM_MODEL            LLM Model name (default: gpt-4o)
`);
    }
  }
}

main().catch(err => {
  console.error(`${color.red('Fatal error:')}`, err);
  process.exit(1);
});
