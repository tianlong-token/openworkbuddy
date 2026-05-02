import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WorkBuddyRuntime } from '../index';
import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';

describe('E2E Integration Tests', () => {
  let runtime: WorkBuddyRuntime;
  const skillsDir = resolve(__dirname, '../../../skills');

  beforeAll(async () => {
    runtime = new WorkBuddyRuntime({
      skillsDir,
      memoryStore: 'memory',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Skill', 'Agent', 'Task', 'TodoWrite'],
      logLevel: 'error',
    });
    await runtime.initialize();
  });

  afterAll(() => {
    runtime.dispose();
  });

  describe('Skill Loading', () => {
    it('should load all skills', () => {
      const skills = runtime.listAllSkills();
      expect(skills.length).toBeGreaterThanOrEqual(147);
    });

    it('should get a skill by slug', () => {
      const skills = runtime.listAllSkills();
      const slug = skills[0]?.slug;
      expect(slug).toBeDefined();
      const skill = runtime.getSkill(slug!);
      expect(skill).toBeDefined();
      expect(skill!.slug).toBe(slug);
      expect(skill!.frontmatter.name).toBeTruthy();
    });

    it('should return undefined for non-existent skill', () => {
      const skill = runtime.getSkill('nonexistent-skill-slug');
      expect(skill).toBeUndefined();
    });
  });

  describe('Skill Search', () => {
    it('should find skills matching query', () => {
      const results = runtime.searchSkills('research');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty for non-matching query', () => {
      const results = runtime.searchSkills('xyznonexistent123');
      expect(results.length).toBe(0);
    });

    it('should search by Chinese description', () => {
      const results = runtime.searchSkills('研究');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Skill Info', () => {
    it('should return complete skill metadata', () => {
      const skills = runtime.listAllSkills();
      const skill = skills[0];
      expect(skill.frontmatter.version).toBeTruthy();
      expect(skill.frontmatter.description).toBeTruthy();
      expect(skill.body.length).toBeGreaterThan(0);
    });

    it('should have slug for every skill', () => {
      const skills = runtime.listAllSkills();
      for (const skill of skills) {
        expect(skill.slug).toBeTruthy();
        expect(skill.slug.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Tool Router', () => {
    it('should have all tools registered', () => {
      const router = runtime.getToolRouter();
      const schemas = router.getAllSchemas();
      expect(schemas.length).toBe(12); // Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch, Agent, TodoWrite, Task, Skill
    });

    it('should execute Read tool successfully', async () => {
      const router = runtime.getToolRouter();
      const result = await router.execute('Read', { filePath: __filename });
      expect(result.success).toBe(true);
      expect(result.output).toContain('e2e.spec');
    });

    it('should execute Glob tool successfully', async () => {
      const router = runtime.getToolRouter();
      const result = await router.execute('Glob', { pattern: '*.ts', path: __dirname });
      expect(result.success).toBe(true);
      expect(result.output).toContain('e2e.spec');
    });

    it('should execute Grep tool successfully', async () => {
      const router = runtime.getToolRouter();
      const result = await router.execute('Grep', {
        pattern: 'describe',
        path: __dirname,
        include: 'e2e.spec.ts',
      });
      expect(result.success).toBe(true);
      expect(result.output).toContain('e2e.spec');
    });
  });

  describe('Session Manager', () => {
    it('should create and list sessions', () => {
      const manager = runtime.getSessionManager();
      const session = manager.create('e2e-test-session', { skillSlug: 'deep-research' });
      expect(session.sessionId).toBe('e2e-test-session');
      expect(session.status).toBe('idle');
      expect(session.skillSlug).toBe('deep-research');

      const sessions = manager.list();
      expect(sessions.some(s => s.sessionId === 'e2e-test-session')).toBe(true);

      manager.remove('e2e-test-session');
    });

    it('should update session status', () => {
      const manager = runtime.getSessionManager();
      manager.create('status-test', { skillSlug: 'test' });
      manager.updateStatus('status-test', 'working');
      expect(manager.get('status-test')!.status).toBe('working');
      manager.remove('status-test');
    });
  });

  describe('Memory Store', () => {
    it('should add and search memories', async () => {
      const memoryStore = runtime.getMemoryStore();

      await memoryStore.add({
        type: 'fact',
        sessionId: 'e2e-memory-test',
        content: 'The capital of France is Paris',
        metadata: { source: 'e2e-test' },
      });

      const results = await memoryStore.search('capital of France', { limit: 5 });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('Paris');

      await memoryStore.clear('e2e-memory-test');
    });
  });

  describe('Configuration', () => {
    it('should return valid config', () => {
      const config = runtime.getConfig();
      expect(config.skillsDir).toBeTruthy();
      expect(config.memoryStore).toBe('memory');
      expect(config.allowedTools.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing skill gracefully', async () => {
      const result = await runtime.runSkill('nonexistent-skill');
      expect(result).toContain('not found');
      expect(result).toContain('Available skills');
    });

    it('should handle Read tool with missing file', async () => {
      const router = runtime.getToolRouter();
      const result = await router.execute('Read', { filePath: '/nonexistent/path/file.txt' });
      expect(result.success).toBe(false);
    });

    it('should handle Bash tool with missing command', async () => {
      const router = runtime.getToolRouter();
      const result = await router.execute('Bash', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing');
    });
  });

  describe('JSON Output Format', () => {
    it('should produce valid JSON for list command', async () => {
      const skills = runtime.listAllSkills();
      const json = skills.map(s => ({
        slug: s.slug,
        name: s.frontmatter.name || s.slug,
        version: s.frontmatter.version,
        description: s.frontmatter.description,
      }));
      const parsed = JSON.parse(JSON.stringify(json));
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThanOrEqual(147);
      expect(parsed[0]).toHaveProperty('slug');
      expect(parsed[0]).toHaveProperty('name');
    });

    it('should produce valid JSON for config command', () => {
      const config = runtime.getConfig();
      const json = JSON.stringify(config);
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('skillsDir');
      expect(parsed).toHaveProperty('memoryStore');
      expect(parsed).toHaveProperty('allowedTools');
    });
  });
});
