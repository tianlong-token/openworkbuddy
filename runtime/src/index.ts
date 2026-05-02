import { RuntimeConfig, Skill, ToolName, MemoryStore, SessionContext, SessionManager, SessionState } from './types';
import { loadConfig } from './config';
import { loadSkill, listSkills, loadAllSkills, searchSkills } from './skill-loader';
import { ToolRouter as ToolRouterClass, TOOL_SCHEMAS } from './tool-router';
import { createMemoryStore } from './memory/memory-manager';
import { createOrchestrator, Orchestrator } from './orchestrator/orchestrator';
import { registerAllTools, setSkillRuntimeRef } from './tool-executors';
import { createAgentLoop, AgentLoop, AgentLoopResult } from './agent-loop';
import { createLLMProvider, LLMProvider } from './llm/llm-provider';
import { getSessionManager, resetSessionManager } from './session/session-manager';

export class WorkBuddyRuntime {
  private config: RuntimeConfig;
  private skills: Map<string, Skill> = new Map();
  private toolRouter: ToolRouterClass;
  private memoryStore: MemoryStore;
  private sessions: Map<string, SessionContext> = new Map();
  private llmProvider: LLMProvider | null = null;
  private agentLoop: AgentLoop | null = null;
  private sessionManager: SessionManager;

  constructor(config?: Partial<RuntimeConfig>) {
    this.config = loadConfig(config);
    this.toolRouter = new ToolRouterClass(this.config.allowedTools);
    registerAllTools(this.toolRouter);
    this.memoryStore = createMemoryStore(this.config.memoryStore);
    this.sessionManager = getSessionManager();
    setSkillRuntimeRef(this);
  }

  async initialize(): Promise<void> {
    if (!this.config.skillsDir) {
      throw new Error('skillsDir not configured. Set WORKBUDDY_SKILLS_DIR env var or pass it in config.');
    }

    console.log(`Loading skills from: ${this.config.skillsDir}`);
    const allSkills = loadAllSkills(this.config.skillsDir);
    for (const skill of allSkills) {
      this.skills.set(skill.slug, skill);
    }
    console.log(`Loaded ${this.skills.size} skills`);

    // Initialize LLM provider if config is available
    this.initLLM();
  }

  private initLLM(): void {
    const { llmApiUrl, llmApiKey, llmModel, llmMaxTokens, llmTemperature } = this.config;
    if (!llmApiUrl || !llmApiKey) {
      console.warn('LLM not configured. Set WORKBUDDY_LLM_API_URL and WORKBUDDY_LLM_API_KEY.');
      return;
    }

    this.llmProvider = createLLMProvider({
      apiUrl: llmApiUrl,
      apiKey: llmApiKey,
      model: llmModel || 'gpt-4o',
      maxTokens: llmMaxTokens || 4096,
      temperature: llmTemperature ?? 0.1,
    }, TOOL_SCHEMAS);

    this.agentLoop = createAgentLoop(this, this.llmProvider, {
      maxTurns: 20,
      maxTokens: llmMaxTokens || 4096,
      temperature: llmTemperature ?? 0.1,
      tools: TOOL_SCHEMAS,
    });

    console.log(`LLM provider initialized: ${llmModel || 'gpt-4o'} @ ${llmApiUrl}`);
  }

  createSession(sessionId?: string, options?: { skillSlug?: string }): SessionContext {
    // 通过 SessionManager 创建，包含状态跟踪
    this.sessionManager.create(sessionId, { skillSlug: options?.skillSlug });

    const sid = sessionId || this.sessionManager.list()[0]?.sessionId || `session_${Date.now()}`;
    const ctx: SessionContext = {
      sessionId: sid,
      skill: null,
      messages: [],
      tools: new Map(),
      memory: this.memoryStore,
      config: this.config,
    };
    this.sessions.set(sid, ctx);
    return ctx;
  }

  getSession(sessionId: string): SessionContext | undefined {
    return this.sessions.get(sessionId);
  }

  getSkill(slug: string): Skill | undefined {
    return this.skills.get(slug);
  }

  listAllSkills(): Skill[] {
    return [...this.skills.values()];
  }

  searchSkills(query: string): Skill[] {
    return searchSkills([...this.skills.values()], query);
  }

  getSkillSlugs(): string[] {
    return [...this.skills.keys()];
  }

  getToolRouter(): ToolRouterClass {
    return this.toolRouter;
  }

  getMemoryStore(): MemoryStore {
    return this.memoryStore;
  }

  createOrchestrator(): Orchestrator {
    const orch = createOrchestrator(undefined, this);
    return orch;
  }

  async runSkill(slug: string, userMessage?: string): Promise<string> {
    const skill = this.getSkill(slug);
    if (!skill) {
      const available = this.getSkillSlugs().join(', ');
      return `Error: Skill '${slug}' not found.\nAvailable skills: ${available}`;
    }

    if (!this.llmProvider || !this.agentLoop) {
      return `Error: LLM not configured. Set WORKBUDDY_LLM_API_URL and WORKBUDDY_LLM_API_KEY.\n\nSkill info: ${skill.frontmatter.name || slug}\nDescription: ${skill.frontmatter.description}\n\n${skill.body.substring(0, 300)}...`;
    }

    const systemPrompt = this.buildSystemPrompt(skill);
    const userMsg = userMessage || 'Please introduce yourself and describe what you can do with this skill.';

    // 更新会话状态为 working
    const activeSessions = this.sessionManager.list();
    const currentSession = activeSessions.find((s: SessionState) => s.skillSlug === slug && s.status !== 'completed');
    if (currentSession) {
      this.sessionManager.updateStatus(currentSession.sessionId, 'working');
    }

    console.log(`Running skill: ${skill.frontmatter.name || slug}`);
    console.log(`System prompt length: ${systemPrompt.length} chars`);

    try {
      const promise = this.agentLoop.run(systemPrompt, userMsg);
      const timeoutMs = this.config.timeout || 120_000;

      const result: AgentLoopResult = await Promise.race([
        promise,
        new Promise<AgentLoopResult>((_, reject) =>
          setTimeout(() => reject(new Error(`Skill execution timed out after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);

      if (result.success) {
        return result.output;
      } else {
        return `Error running skill: ${result.error || 'Unknown error'}\n\nPartial output:\n${result.output}`;
      }
    } catch (e: any) {
      return `Fatal error running skill: ${e.message}`;
    } finally {
      // 更新会话状态为 completed
      const sessions = this.sessionManager.list();
      const active = sessions.find((s: SessionState) => s.skillSlug === slug && s.status === 'working');
      if (active) {
        this.sessionManager.updateStatus(active.sessionId, 'completed');
      }
    }
  }

  private buildSystemPrompt(skill: Skill): string {
    // Start with the skill body as the system prompt
    let prompt = skill.body;

    // Append tool usage instructions
    const allowedTools = skill.frontmatter['allowed-tools']
      ? skill.frontmatter['allowed-tools'].split(',').map(s => s.trim())
      : this.config.allowedTools;

    prompt += `\n\n## Available Tools\nYou have access to the following tools: ${allowedTools.join(', ')}.\nCall them when needed to complete the user's request.`;

    return prompt;
  }

  getConfig(): RuntimeConfig {
    return this.config;
  }

  getAgentLoop(): AgentLoop | null {
    return this.agentLoop;
  }

  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  // 关闭时清理
  dispose(): void {
    resetSessionManager();
  }
}

export { loadConfig } from './config';
export { loadSkill, listSkills, loadAllSkills, searchSkills, parseFrontmatter, validateSkill } from './skill-loader';
export { ToolRouter, TOOL_SCHEMAS } from './tool-router';
export { createMemoryStore, InMemoryStore, FileMemoryStore } from './memory/memory-manager';
export { createOrchestrator, Orchestrator } from './orchestrator/orchestrator';
export * from './types';
