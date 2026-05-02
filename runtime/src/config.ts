import { RuntimeConfig, ToolName } from './types';
import { join, dirname, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';

const DEFAULT_CONFIG: RuntimeConfig = {
  skillsDir: '',
  memoryStore: 'memory',
  maxToolTimeoutMs: 120_000,
  allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch'],
  logLevel: 'info',
};

function getModuleDir(): string {
  // C1. CommonJS compatible (tsconfig uses NodeNext with CommonJS)
  const mainFile = require.main?.filename;
  if (mainFile) {
    return dirname(mainFile);
  }
  return process.cwd();
}

function resolveSkillsDir(): string {
  if (process.env.WORKBUDDY_SKILLS_DIR) {
    return process.env.WORKBUDDY_SKILLS_DIR;
  }

  const cwd = process.cwd();
  const moduleDir = getModuleDir();
  const candidates = [
    join(cwd, 'skills'),
    join(cwd, '..', 'skills'),
    join(moduleDir, '..', '..', 'skills'),
  ];

  for (const dir of candidates) {
    try {
      if (existsSync(dir)) return resolve(dir);
    } catch {
      continue;
    }
  }

  return join(cwd, 'skills');
}

// 尝试加载项目根目录的 .env 文件（不覆盖已设置的环境变量）
function tryLoadEnvFile(): void {
  const possiblePaths = [
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '.env'),
  ];

  for (const envPath of possiblePaths) {
    try {
      if (existsSync(envPath)) {
        const content = readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
              const key = trimmed.substring(0, eqIndex).trim();
              const value = trimmed.substring(eqIndex + 1).trim();
              if (!process.env[key]) {
                process.env[key] = value;
              }
            }
          }
        }
        return;
      }
    } catch {
      // ignore
    }
  }
}

export function loadConfig(overrides?: Partial<RuntimeConfig>): RuntimeConfig {
  tryLoadEnvFile();
  const config: RuntimeConfig = {
    ...DEFAULT_CONFIG,
    skillsDir: resolveSkillsDir(),
    ...overrides,
  };

  if (process.env.WORKBUDDY_MEMORY_STORE) {
    const val = process.env.WORKBUDDY_MEMORY_STORE;
    if (val === 'memory' || val === 'file' || val === 'api') {
      config.memoryStore = val;
    }
  }

  if (process.env.WORKBUDDY_MEMORY_API_URL) {
    config.memoryApiUrl = process.env.WORKBUDDY_MEMORY_API_URL;
  }

  if (process.env.WORKBUDDY_LOG_LEVEL) {
    const level = process.env.WORKBUDDY_LOG_LEVEL as RuntimeConfig['logLevel'];
    if (['debug', 'info', 'warn', 'error'].includes(level)) {
      config.logLevel = level;
    }
  }

  if (process.env.WORKBUDDY_ALLOWED_TOOLS) {
    config.allowedTools = process.env.WORKBUDDY_ALLOWED_TOOLS.split(',').map(t => t.trim()) as ToolName[];
  }

  // LLM config from env
  if (process.env.WORKBUDDY_LLM_API_URL) {
    config.llmApiUrl = process.env.WORKBUDDY_LLM_API_URL;
  }
  if (process.env.WORKBUDDY_LLM_API_KEY) {
    config.llmApiKey = process.env.WORKBUDDY_LLM_API_KEY;
  }
  if (process.env.WORKBUDDY_LLM_MODEL) {
    config.llmModel = process.env.WORKBUDDY_LLM_MODEL;
  }
  if (process.env.WORKBUDDY_LLM_MAX_TOKENS) {
    const parsed = parseInt(process.env.WORKBUDDY_LLM_MAX_TOKENS, 10);
    if (!isNaN(parsed)) {
      config.llmMaxTokens = parsed;
    }
  }
  if (process.env.WORKBUDDY_LLM_TEMPERATURE) {
    const parsed = parseFloat(process.env.WORKBUDDY_LLM_TEMPERATURE);
    if (!isNaN(parsed)) {
      config.llmTemperature = parsed;
    }
  }

  return config;
}

export function mergeConfig(base: RuntimeConfig, overrides: Partial<RuntimeConfig>): RuntimeConfig {
  return { ...base, ...overrides };
}
