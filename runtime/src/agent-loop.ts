import { WorkBuddyRuntime } from './index';
import { LLMProvider, LLMMessage, ToolCall } from './llm/llm-provider';
import { ToolResult, ToolSchema } from './types';

export interface AgentLoopConfig {
  maxTurns: number;
  maxTokens: number;
  temperature: number;
  tools: Record<string, ToolSchema>;
}

export interface AgentLoopResult {
  success: boolean;
  output: string;
  toolCallsCount: number;
  turnsUsed: number;
  error?: string;
}

export class AgentLoop {
  private runtime: WorkBuddyRuntime;
  private llmProvider: LLMProvider;
  private config: AgentLoopConfig;
  private messages: LLMMessage[] = [];
  private systemPromptHash: string = '';

  constructor(
    runtime: WorkBuddyRuntime,
    llmProvider: LLMProvider,
    config?: Partial<AgentLoopConfig>
  ) {
    this.runtime = runtime;
    this.llmProvider = llmProvider;
    this.config = {
      maxTurns: config?.maxTurns ?? 8,
      maxTokens: config?.maxTokens ?? 4096,
      temperature: config?.temperature ?? 0.1,
      tools: config?.tools ?? {},
    };
    this.llmProvider.setToolsSchema(this.config.tools);
  }

  async run(systemPrompt: string, userMessage: string): Promise<AgentLoopResult> {
    const isNewConversation = !this.systemPromptHash || this.systemPromptHash !== systemPrompt;

    if (isNewConversation) {
      this.messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ];
      this.systemPromptHash = systemPrompt;

      // G2: 从 Memory Store 加载相关历史，注入到系统提示后
      this.loadMemoryContext(systemPrompt);
    } else {
      this.messages.push({ role: 'user', content: userMessage });
    }

    return this.executeLoop();
  }

  async continue(userMessage: string): Promise<AgentLoopResult> {
    if (this.messages.length === 0) {
      throw new Error('No conversation started. Call run() first.');
    }
    this.messages.push({ role: 'user', content: userMessage });
    return this.executeLoop();
  }

  private async loadMemoryContext(systemPrompt: string): Promise<void> {
    try {
      const memoryStore = this.runtime.getMemoryStore();
      const entries = await memoryStore.search(systemPrompt.substring(0, 60), { limit: 3 });
      if (entries.length > 0) {
        const memoryContext = '\n\n## 相关历史记忆\n' + entries.map((e, i) =>
          `[${i + 1}] ${e.content.substring(0, 300)}`
        ).join('\n---\n');
        // 注入到最后一条消息（用户消息）之前
        this.messages.splice(this.messages.length - 1, 0, {
          role: 'system',
          content: memoryContext,
        });
      }
    } catch {
      // 记忆加载失败不阻塞主流程
    }
  }

  private async executeLoop(): Promise<AgentLoopResult> {
    let turnsUsed = 0;
    let toolCallsCount = 0;
    let finalOutput = '';
    let consecutiveToolTurns = 0;

    while (turnsUsed < this.config.maxTurns) {
      turnsUsed++;

      // F1: try/catch 捕获 chat() 异常
      let response;
      try {
        response = await this.llmProvider.chat(this.messages, this.config.tools);
      } catch (e: any) {
        return {
          success: false,
          output: finalOutput,
          toolCallsCount,
          turnsUsed,
          error: `LLM chat error: ${e.message}`,
        };
      }

      // 优先处理 tool_calls（LLM 可能同时返回 content + tool_calls）
      if (response.tool_calls && response.tool_calls.length > 0) {
        // 只有 LLM 没产生 content 时才算"纯工具轮次"；有 content 说明 LLM 在正常交互
        if (!response.content) {
          consecutiveToolTurns++;
        } else {
          consecutiveToolTurns = 0; // 有文字回复时重置计数器
        }

        // 防护：连续 8 轮纯工具调用无回复 → 强制中断
        if (consecutiveToolTurns >= 8) {
          return {
            success: false,
            output: finalOutput,
            toolCallsCount,
            turnsUsed,
            error: `Tool call loop detected: ${consecutiveToolTurns} consecutive turns without assistant response`,
          };
        }

        this.messages.push({
          role: 'assistant',
          content: response.content || '',
          reasoning_content: response.reasoning_content,
          tool_calls: response.tool_calls,
        });

        toolCallsCount += response.tool_calls.length;

        for (const toolCall of response.tool_calls) {
          const result = await this.executeToolCall(toolCall);
          this.messages.push({
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: toolCall.id,
          });
        }

        continue;
      }

      // 无 tool_calls → 重置连续计数器
      consecutiveToolTurns = 0;

      if (response.content) {
        this.messages.push({
          role: 'assistant',
          content: response.content,
          reasoning_content: response.reasoning_content,
        });
        finalOutput = response.content;
        break;
      }

      // 无 content 且无 tool_calls → 特殊异常
      return {
        success: false,
        output: finalOutput,
        toolCallsCount,
        turnsUsed,
        error: `Unexpected LLM response: no content and no tool_calls (turn ${turnsUsed})`,
      };
    }

    const isMaxTurns = turnsUsed >= this.config.maxTurns;

    const result: AgentLoopResult = isMaxTurns ? {
      success: false,
      output: finalOutput || 'Max turns reached without completion.',
      toolCallsCount,
      turnsUsed,
      error: 'Max turns reached',
    } : {
      success: true,
      output: finalOutput,
      toolCallsCount,
      turnsUsed,
    };

    // G1: 对话结束后自动写入记忆（异步，不阻塞）
    this.saveConversationToMemory(result);

    return result;
  }

  private async saveConversationToMemory(result: AgentLoopResult): Promise<void> {
    try {
      const conversationContent = this.messages
        .filter(m => m.role !== 'system') // 排除系统提示
        .map(m => `${m.role}: ${m.content || '(tool call)'}`)
        .join('\n\n')
        .substring(0, 5000); // 限制长度

      await this.runtime.getMemoryStore().add({
        type: 'conversation',
        sessionId: `session_${this.systemPromptHash.substring(0, 16)}`,
        content: conversationContent,
        metadata: {
          toolCallsCount: result.toolCallsCount,
          turnsUsed: result.turnsUsed,
          success: result.success,
          error: result.error,
          timestamp: Date.now(),
        },
      });
    } catch {
      // 记忆写入失败不阻塞
    }
  }

  private async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    const toolName = toolCall.function.name;
    let toolArgs: Record<string, unknown>;
    try {
      toolArgs = JSON.parse(toolCall.function.arguments);
    } catch {
      return { success: false, output: '', error: `Invalid JSON arguments: ${toolCall.function.arguments}` };
    }

    const toolRouter = this.runtime.getToolRouter();
    return await toolRouter.execute(toolName as any, toolArgs);
  }

  getMessages(): LLMMessage[] {
    return [...this.messages];
  }

  reset(): void {
    this.messages = [];
    this.systemPromptHash = '';
  }
}

export function createAgentLoop(
  runtime: WorkBuddyRuntime,
  llmProvider: LLMProvider,
  config?: Partial<AgentLoopConfig>
): AgentLoop {
  return new AgentLoop(runtime, llmProvider, config);
}
