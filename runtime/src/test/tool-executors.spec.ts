import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  readExecutor, writeExecutor, editExecutor,
  bashExecutor, globExecutor, grepExecutor,
  webFetchExecutor, webSearchExecutor,
  todoWriteExecutor, taskExecutor,
  getRuntimeRef, clearRuntimeRef, restoreRuntimeRef,
  registerAllTools
} from '../tool-executors';
import { TOOL_SCHEMAS } from '../tool-router';
import { ToolSchema, ToolName } from '../types';
import { existsSync, unlinkSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join, resolve } from 'path';

// 测试目录放在项目目录内（避免触发路径穿越保护）
const testDir = resolve(__dirname, '../../src/test-tmp-' + Date.now());

describe('Tool Executors', () => {
  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('ReadExecutor', () => {
    it('should return error for missing filePath', async () => {
      const result = await readExecutor({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing');
    });

    it('should return error for non-existent file', async () => {
      const result = await readExecutor({ filePath: '/nonexistent/file.txt' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('traversal');
    });

    it('should read existing file content', async () => {
      const testFile = join(testDir, 'read-test.txt');
      writeFileSync(testFile, 'Hello World', 'utf-8');
      const result = await readExecutor({ filePath: testFile });
      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello World');
    });

    it('should handle limit and offset parameters', async () => {
      const testFile = join(testDir, 'lines-test.txt');
      const lines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`);
      writeFileSync(testFile, lines.join('\n'), 'utf-8');
      const result = await readExecutor({ filePath: testFile, offset: 2, limit: 3 });
      expect(result.success).toBe(true);
      expect(result.output).toContain('Line 2');
      expect(result.output).toContain('Line 4');
      expect(result.output).not.toContain('Line 5');
    });

    it('should list directory contents', async () => {
      const result = await readExecutor({ filePath: testDir });
      expect(result.success).toBe(true);
      expect(result.output).toContain('read-test.txt');
    });
  });

  describe('WriteExecutor', () => {
    it('should return error for missing filePath', async () => {
      const result = await writeExecutor({ content: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing');
    });

    it('should return error for missing content', async () => {
      const result = await writeExecutor({ filePath: join(testDir, 'test.txt') });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing');
    });

    it('should write file successfully', async () => {
      const testFile = join(testDir, 'write-test.txt');
      const result = await writeExecutor({ filePath: testFile, content: 'Test content' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('Written 12 chars');
      expect(result.output).toContain('write-test.txt');
      const content = readFileSync(testFile, 'utf-8');
      expect(content).toBe('Test content');
    });
  });

  describe('EditExecutor', () => {
    it('should return error for missing arguments', async () => {
      const result = await editExecutor({ filePath: 'test.txt' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing');
    });

    it('should replace text in file', async () => {
      const testFile = join(testDir, 'edit-test.txt');
      writeFileSync(testFile, 'Hello World', 'utf-8');
      const result = await editExecutor({
        filePath: testFile,
        oldString: 'Hello',
        newString: 'Hi'
      });
      expect(result.success).toBe(true);
      const content = readFileSync(testFile, 'utf-8');
      expect(content).toBe('Hi World');
    });

    it('should error when oldString not found', async () => {
      const testFile = join(testDir, 'edit-notfound.txt');
      writeFileSync(testFile, 'Hello', 'utf-8');
      const result = await editExecutor({
        filePath: testFile,
        oldString: 'NonExistent',
        newString: 'Hi'
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found in file');
    });
  });

  describe('BashExecutor', () => {
    it('should return error for missing command', async () => {
      const result = await bashExecutor({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing');
    });

    it('should execute basic command', async () => {
      const result = await bashExecutor({ command: 'node -e "console.log(\'Hello from Bash\')"' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello from Bash');
    });

    it('should handle command failure', async () => {
      const result = await bashExecutor({ command: 'node -e "process.exit(1)"' });
      expect(result.success).toBe(false);
    });
  });

  describe('GlobExecutor', () => {
    it('should return error for missing pattern', async () => {
      const result = await globExecutor({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing');
    });

    it('should find files matching pattern', async () => {
      writeFileSync(join(testDir, 'glob-test.txt'), 'test', 'utf-8');
      const result = await globExecutor({ pattern: '*.txt', path: testDir });
      expect(result.success).toBe(true);
      expect(result.output).toContain('glob-test.txt');
    });
  });

  describe('GrepExecutor', () => {
    it('should return error for missing pattern', async () => {
      const result = await grepExecutor({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing');
    });

    it('should find text in files', async () => {
      writeFileSync(join(testDir, 'grep-test.txt'), 'findable content here', 'utf-8');
      const result = await grepExecutor({ pattern: 'findable', path: testDir });
      expect(result.success).toBe(true);
      expect(result.output).toContain('findable');
    });
  });

  describe('Tool Registration', () => {
    it('should have all 12 tool schemas defined', () => {
      const expectedTools: string[] = [
        'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
        'WebFetch', 'WebSearch', 'Agent', 'TodoWrite', 'Task', 'Skill'
      ];
      for (const name of expectedTools) {
        const schema = TOOL_SCHEMAS[name as ToolName];
        expect(schema).toBeDefined();
        expect(schema!.name).toBe(name);
        expect(schema!.description).toBeTruthy();
      }
    });
  });

  describe('TodoWriteExecutor', () => {
    it('should return error for missing todos', async () => {
      const result = await todoWriteExecutor({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing');
    });

    it('should save todos to disk', async () => {
      const result = await todoWriteExecutor({
        todos: [{ content: 'Test todo 1', status: 'pending' }],
      });
      expect(result.success).toBe(true);
      expect(result.output).toContain('todos.json');
    });
  });

  describe('TaskExecutor', () => {
    it('should return error for missing description', async () => {
      const result = await taskExecutor({ prompt: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing');
    });

    it('should return error for missing prompt', async () => {
      const result = await taskExecutor({ description: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing');
    });

    it('should return error when LLM not configured', async () => {
      const savedRef = getRuntimeRef();
      clearRuntimeRef();
      try {
        const result = await taskExecutor({
          description: 'Test task',
          prompt: 'Do something',
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('LLM configuration');
      } finally {
        restoreRuntimeRef(savedRef);
      }
    });

    it('should not error on valid arguments when LLM is configured', async () => {
      const result = await taskExecutor({
        description: 'Test task',
        prompt: 'Say hello',
        subagentType: 'general',
      });
      expect(result.error).not.toBe('Missing description');
      expect(result.error).not.toBe('Missing prompt');
    });
  });
});
