import { ToolSchema } from '../types';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  reasoning_content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface LLMResponse {
  content: string | null;
  reasoning_content?: string;
  tool_calls: ToolCall[];
}

export interface LLMProviderConfig {
  apiUrl: string;      // e.g. "https://api.openai.com/v1/chat/completions"
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

function convertToolsToOpenAIFormat(tools: Record<string, ToolSchema>): object[] {
  return Object.values(tools).map(schema => ({
    type: 'function',
    function: {
      name: schema.name,
      description: schema.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(schema.parameters).map(([key, param]: [string, any]) => [
            key,
            { type: param.type, description: param.description }
          ])
        ),
        required: Object.entries(schema.parameters)
          .filter(([, param]: [string, any]) => param.required)
          .map(([key]) => key)
      }
    }
  }));
}

export class LLMProvider {
  private config: LLMProviderConfig;
  private toolsSchema: Record<string, ToolSchema>;

  constructor(config: LLMProviderConfig, toolsSchema: Record<string, ToolSchema> = {}) {
    this.config = config;
    this.toolsSchema = toolsSchema;
  }

  updateConfig(config: Partial<LLMProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  setToolsSchema(schema: Record<string, ToolSchema>): void {
    this.toolsSchema = schema;
  }

  async chat(messages: LLMMessage[], tools?: Record<string, ToolSchema>): Promise<LLMResponse> {
    const body: any = {
      model: this.config.model,
      messages: messages.map(m => {
        if (m.tool_calls) {
          const assistantMsg: any = {
            role: m.role,
            content: m.content || null,
            reasoning_content: m.reasoning_content || '', // DeepSeek requires this field for tool-call turns
            tool_calls: m.tool_calls
          };
          return assistantMsg;
        }
        if (m.tool_call_id) {
          return {
            role: m.role,
            content: m.content,
            tool_call_id: m.tool_call_id,
          };
        }
        const msg: any = { role: m.role, content: m.content };
        // DeepSeek thinking mode: forward reasoning_content from previous assistant messages
        if (m.role === 'assistant' && m.reasoning_content) {
          msg.reasoning_content = m.reasoning_content;
        }
        return msg;
      }),
      max_tokens: this.config.maxTokens || 4096,
      temperature: this.config.temperature || 0.1,
    };

    // DeepSeek v4-flash always runs in thinking mode. We handle this by
    // preserving reasoning_content in assistant messages and forwarding
    // it on every follow-up request.

    const activeTools = tools || this.toolsSchema;
    if (Object.keys(activeTools).length > 0) {
      body.tools = convertToolsToOpenAIFormat(activeTools);
      body.tool_choice = 'auto';
    }

    const resp = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000), // 60s per API call to prevent infinite hangs
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`LLM API error ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    const choice = data.choices?.[0];
    if (!choice) throw new Error('No choice in LLM response');

    const msg = choice.message;
    const toolCalls: ToolCall[] = (msg.tool_calls || []).map((tc: any) => ({
      id: tc.id,
      type: 'function',
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments
      }
    }));

    return {
      content: msg.content,
      reasoning_content: msg.reasoning_content,
      tool_calls: toolCalls
    };
  }
}

export function createLLMProvider(
  config: LLMProviderConfig,
  toolsSchema?: Record<string, ToolSchema>
): LLMProvider {
  return new LLMProvider(config, toolsSchema);
}
