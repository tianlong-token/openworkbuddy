import { ToolName, ToolExecutor, ToolResult, ToolSchema } from './types';

export const TOOL_SCHEMAS: Record<ToolName, ToolSchema> = {
  Read: {
    name: 'Read',
    description: 'Read a file or directory from the local filesystem',
    parameters: {
      filePath: { type: 'string', required: true, description: 'Absolute path to the file or directory' },
      limit: { type: 'number', required: false, description: 'Maximum number of lines to read' },
      offset: { type: 'number', required: false, description: 'Line number to start reading from (1-indexed)' },
    },
  },
  Write: {
    name: 'Write',
    description: 'Write content to a file',
    parameters: {
      filePath: { type: 'string', required: true, description: 'Absolute path to the file' },
      content: { type: 'string', required: true, description: 'Content to write' },
    },
  },
  Edit: {
    name: 'Edit',
    description: 'Perform exact string replacement in a file',
    parameters: {
      filePath: { type: 'string', required: true, description: 'Absolute path to the file' },
      oldString: { type: 'string', required: true, description: 'Text to replace' },
      newString: { type: 'string', required: true, description: 'Replacement text' },
      replaceAll: { type: 'boolean', required: false, description: 'Replace all occurrences' },
    },
  },
  Bash: {
    name: 'Bash',
    description: 'Execute a shell command',
    parameters: {
      command: { type: 'string', required: true, description: 'The command to execute' },
      timeout: { type: 'number', required: false, description: 'Timeout in milliseconds' },
      workdir: { type: 'string', required: false, description: 'Working directory for the command' },
    },
  },
  Glob: {
    name: 'Glob',
    description: 'Find files matching a glob pattern',
    parameters: {
      pattern: { type: 'string', required: true, description: 'Glob pattern to match' },
      path: { type: 'string', required: false, description: 'Directory to search in' },
    },
  },
  Grep: {
    name: 'Grep',
    description: 'Search file contents using regex',
    parameters: {
      pattern: { type: 'string', required: true, description: 'Regex pattern to search for' },
      path: { type: 'string', required: false, description: 'Directory to search in' },
      include: { type: 'string', required: false, description: 'File pattern to include' },
    },
  },
  WebFetch: {
    name: 'WebFetch',
    description: 'Fetch content from a URL',
    parameters: {
      url: { type: 'string', required: true, description: 'URL to fetch' },
      format: { type: 'string', required: false, description: 'Response format: markdown, text, or html' },
    },
  },
  WebSearch: {
    name: 'WebSearch',
    description: 'Search the web',
    parameters: {
      query: { type: 'string', required: true, description: 'Search query' },
      numResults: { type: 'number', required: false, description: 'Number of results to return' },
    },
  },
  Agent: {
    name: 'Agent',
    description: 'Spawn a subagent to handle a task',
    parameters: {
      prompt: { type: 'string', required: true, description: 'Task description for the subagent' },
      subagentType: { type: 'string', required: false, description: 'Type of specialized agent' },
    },
  },
  TodoWrite: {
    name: 'TodoWrite',
    description: 'Create and manage a structured task list',
    parameters: {
      todos: { type: 'array', required: true, description: 'Array of todo items' },
    },
  },
  Task: {
    name: 'Task',
    description: 'Launch a new agent to handle complex, multistep tasks',
    parameters: {
      description: { type: 'string', required: true, description: 'Short task description' },
      prompt: { type: 'string', required: true, description: 'Detailed task instructions' },
      subagentType: { type: 'string', required: false, description: 'Type of specialized agent' },
    },
  },
  Skill: {
    name: 'Skill',
    description: 'Load a specialized skill',
    parameters: {
      name: { type: 'string', required: true, description: 'Name of the skill to load' },
    },
  },
};

export class ToolRouter {
  private executors: Map<ToolName, ToolExecutor> = new Map();
  private allowedTools: Set<ToolName> = new Set();

  constructor(allowedTools?: ToolName[]) {
    this.allowedTools = new Set(allowedTools || Object.keys(TOOL_SCHEMAS) as ToolName[]);
  }

  register(tool: ToolName, executor: ToolExecutor): void {
    this.executors.set(tool, executor);
  }

  isAllowed(tool: ToolName): boolean {
    return this.allowedTools.has(tool);
  }

  getSchema(tool: ToolName): ToolSchema | undefined {
    return TOOL_SCHEMAS[tool];
  }

  getAllSchemas(): ToolSchema[] {
    return Object.values(TOOL_SCHEMAS);
  }

  async execute(tool: ToolName, args: Record<string, unknown>): Promise<ToolResult> {
    if (!this.isAllowed(tool)) {
      return { success: false, output: '', error: `Tool '${tool}' is not allowed` };
    }

    const executor = this.executors.get(tool);
    if (!executor) {
      return { success: false, output: '', error: `No executor registered for tool '${tool}'` };
    }

    const schema = this.getSchema(tool);
    if (schema) {
      const validationError = this.validateArgs(schema, args);
      if (validationError) {
        return { success: false, output: '', error: validationError };
      }
    }

    try {
      return await executor(args);
    } catch (e) {
      return { success: false, output: '', error: (e as Error).message };
    }
  }

  private validateArgs(schema: ToolSchema, args: Record<string, unknown>): string | null {
    for (const [key, param] of Object.entries(schema.parameters)) {
      if (param.required && (args[key] === undefined || args[key] === null)) {
        return `Missing required parameter: '${key}'`;
      }
      if (args[key] !== undefined) {
        const actualType = Array.isArray(args[key]) ? 'array' : typeof args[key];
        if (actualType !== param.type) {
          return `Parameter '${key}' must be of type '${param.type}', got '${actualType}'`;
        }
      }
    }
    return null;
  }

  filterAllowedTools(tools: ToolName[]): ToolName[] {
    return tools.filter(t => this.isAllowed(t));
  }
}
