import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DefaultSkillScriptRunner } from '../skill-script-runner';
import { Skill } from '../types';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = path.join(__dirname, 'test-scripts-tmp');

function createMockSkill(hasScripts: boolean = false): Skill {
  return {
    slug: 'test-skill',
    directory: TEST_DIR,
    frontmatter: { name: 'Test Skill', version: '0.1.0', description: 'Test' },
    body: '',
    hasScripts,
    hasReferences: false,
    hasAssets: false,
    hasTemplates: false,
    scriptPaths: [],
    referencePaths: [],
  };
}

describe('SkillScriptRunner', () => {
  let runner: DefaultSkillScriptRunner;

  beforeEach(() => {
    runner = new DefaultSkillScriptRunner();
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('returns empty list when no scripts directory', () => {
    const skill = createMockSkill(false);
    const scripts = runner.listScripts(skill);
    expect(scripts).toEqual([]);
  });

  it('lists script files in scripts directory', () => {
    const skill = createMockSkill(true);
    const scriptsDir = path.join(TEST_DIR, 'scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.writeFileSync(path.join(scriptsDir, 'hello.js'), '');
    fs.writeFileSync(path.join(scriptsDir, 'world.sh'), '');

    const scripts = runner.listScripts(skill);
    expect(scripts).toContain('hello.js');
    expect(scripts).toContain('world.sh');
  });

  it('returns error when script not found', async () => {
    const skill = createMockSkill(true);
    const scriptsDir = path.join(TEST_DIR, 'scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });

    const result = await runner.executeScript(skill, 'nonexistent.js');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('executes a simple script successfully', async () => {
    const skill = createMockSkill(true);
    const scriptsDir = path.join(TEST_DIR, 'scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.writeFileSync(
      path.join(scriptsDir, 'hello.js'),
      'console.log("Hello from script");'
    );

    const result = await runner.executeScript(skill, 'hello.js');
    expect(result.success).toBe(true);
    expect(result.output).toContain('Hello from script');
  });

  it('handles script timeout', async () => {
    const skill = createMockSkill(true);
    const scriptsDir = path.join(TEST_DIR, 'scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.writeFileSync(
      path.join(scriptsDir, 'slow.js'),
      'setTimeout(() => {}, 100000);'
    );

    const result = await runner.executeScript(skill, 'slow.js');
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  }, 35000);

  it('handles script execution error', async () => {
    const skill = createMockSkill(true);
    const scriptsDir = path.join(TEST_DIR, 'scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.writeFileSync(
      path.join(scriptsDir, 'fail.js'),
      'process.exit(1);'
    );

    const result = await runner.executeScript(skill, 'fail.js');
    expect(result.success).toBe(false);
  });
});
