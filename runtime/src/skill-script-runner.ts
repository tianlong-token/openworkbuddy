import { Skill, ToolResult } from './types';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import { spawn } from 'child_process';

const DEFAULT_TIMEOUT = 30_000; // 30s

export interface SkillScriptRunner {
  /** 执行技能中的指定脚本 */
  executeScript(skill: Skill, scriptName: string, args?: string[]): Promise<ToolResult>;
  /** 列出技能中所有可执行脚本 */
  listScripts(skill: Skill): string[];
}

interface ScriptCommand {
  cmd: string;
  args: string[];
}

export class DefaultSkillScriptRunner implements SkillScriptRunner {
  private scriptCache = new Map<string, string[]>();

  listScripts(skill: Skill): string[] {
    const key = skill.directory;
    if (this.scriptCache.has(key)) return this.scriptCache.get(key)!;

    const scriptsDir = join(skill.directory, 'scripts');
    if (!existsSync(scriptsDir)) {
      this.scriptCache.set(key, []);
      return [];
    }

    const { readdirSync } = require('fs');
    const files: string[] = readdirSync(scriptsDir).filter((f: string) => {
      const ext = extname(f).toLowerCase();
      return ['.js', '.ts', '.sh', '.bat', '.cmd'].includes(ext);
    });

    this.scriptCache.set(key, files);
    return files;
  }

  async executeScript(skill: Skill, scriptName: string, args?: string[]): Promise<ToolResult> {
    const scriptsDir = join(skill.directory, 'scripts');

    if (!existsSync(scriptsDir)) {
      return { success: false, output: '', error: `No scripts directory for skill '${skill.slug}'` };
    }

    const scriptPath = join(scriptsDir, scriptName);
    if (!existsSync(scriptPath)) {
      const available = this.listScripts(skill).join(', ') || '(none)';
      return {
        success: false,
        output: '',
        error: `Script '${scriptName}' not found in skill '${skill.slug}'. Available scripts: ${available}`,
      };
    }

    const ext = extname(scriptName).toLowerCase();
    const { cmd, args: cmdArgs } = this.buildCommand(scriptPath, ext, args);
    const timeout = DEFAULT_TIMEOUT;

    try {
      const result = await this.execWithTimeout(cmd, cmdArgs, timeout);
      return result;
    } catch (e: any) {
      return { success: false, output: '', error: `Script execution error: ${e.message}` };
    }
  }

  private buildCommand(scriptPath: string, ext: string, args?: string[]): ScriptCommand {
    // args 通过 spawn 的 args 数组传递，自动转义，无注入风险
    const userArgs = args || [];

    switch (ext) {
      case '.js':
      case '.ts':
        return { cmd: 'node', args: [scriptPath, ...userArgs] };
      case '.sh':
        return { cmd: 'bash', args: [scriptPath, ...userArgs] };
      case '.bat':
      case '.cmd':
        return { cmd: 'cmd', args: ['/c', scriptPath, ...userArgs] };
      default:
        return { cmd: 'node', args: [scriptPath, ...userArgs] };
    }
  }

  private execWithTimeout(cmd: string, args: string[], timeoutMs: number): Promise<ToolResult> {
    return new Promise((resolve) => {
      const proc = spawn(cmd, args, {
        timeout: timeoutMs,
        shell: false,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

      proc.on('close', (code: number | null, signal: string | null) => {
        let output = stdout;
        if (stderr) output += `\n[stderr]\n${stderr}`;

        if (signal === 'SIGTERM') {
          resolve({ success: false, output, error: `Script timed out after ${timeoutMs}ms` });
        } else if (code !== null && code !== 0) {
          resolve({ success: false, output, error: stderr || `Exit code: ${code}` });
        } else {
          resolve({ success: true, output });
        }
      });

      proc.on('error', (err: Error) => {
        resolve({ success: false, output: '', error: err.message });
      });
    });
  }
}

let defaultRunner: DefaultSkillScriptRunner | null = null;

export function getSkillScriptRunner(): SkillScriptRunner {
  if (!defaultRunner) {
    defaultRunner = new DefaultSkillScriptRunner();
  }
  return defaultRunner;
}

export function executeSkillScript(skill: Skill, scriptName: string, args?: string[]): Promise<ToolResult> {
  return getSkillScriptRunner().executeScript(skill, scriptName, args);
}

export function listSkillScripts(skill: Skill): string[] {
  return getSkillScriptRunner().listScripts(skill);
}
