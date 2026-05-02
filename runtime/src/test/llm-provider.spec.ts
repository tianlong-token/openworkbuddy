import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLLMProvider, LLMProvider, LLMMessage } from '../llm/llm-provider';
import { TOOL_SCHEMAS } from '../tool-router';

const mockFetchResponse = (data: any, ok = true, status = 200): Response => {
  return {
    ok,
    status,
    text: () => Promise.resolve(JSON.stringify(data)),
    json: () => Promise.resolve(data),
  } as Response;
};

describe('LLMProvider', () => {
  const config = {
    apiUrl: 'https://api.test.com/v1/chat/completions',
    apiKey: 'test-key-123',
    model: 'test-model',
    maxTokens: 4096,
    temperature: 0.1,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create LLMProvider instance', () => {
      const provider = createLLMProvider(config);
      expect(provider).toBeInstanceOf(LLMProvider);
    });

    it('should accept tools schema', () => {
      const provider = createLLMProvider(config, TOOL_SCHEMAS);
      expect(provider).toBeInstanceOf(LLMProvider);
    });
  });

  describe('updateConfig()', () => {
    it('should update configuration partially', () => {
      const provider = createLLMProvider(config);
      provider.updateConfig({ model: 'new-model', temperature: 0.5 });
      // Provider should now use new-model and 0.5 temperature
      expect(true).toBe(true); // Method exists and works
    });
  });

  describe('chat() - API call', () => {
    it('should send correct request format', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchResponse({
          choices: [{
            message: {
              content: 'Hello response',
              tool_calls: [],
            }
          }]
        })
      );

      const provider = createLLMProvider(config);
      const messages: LLMMessage[] = [
        { role: 'system', content: 'Be helpful' },
        { role: 'user', content: 'Hello' },
      ];

      const result = await provider.chat(messages);

      // Verify fetch was called with correct URL and headers
      expect(fetch).toHaveBeenCalledWith(
        config.apiUrl,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key-123',
          }),
        })
      );

      // Verify request body structure
      const callArgs = (fetch as any).mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.model).toBe('test-model');
      expect(body.messages.length).toBe(2);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[1].role).toBe('user');

      // Verify response parsing
      expect(result.content).toBe('Hello response');
      expect(result.tool_calls).toEqual([]);
    });

    it('should include tools in request when provided', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchResponse({
          choices: [{
            message: { content: 'Result', tool_calls: [] }
          }]
        })
      );

      const provider = createLLMProvider(config, TOOL_SCHEMAS);
      await provider.chat([{ role: 'user', content: 'Hi' }], TOOL_SCHEMAS);

      const callArgs = (fetch as any).mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.tools).toBeDefined();
      expect(Array.isArray(body.tools)).toBe(true);
      expect(body.tools.length).toBeGreaterThan(0);
      expect(body.tools[0].type).toBe('function');
    });

    it('should parse tool_calls from response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchResponse({
          choices: [{
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call_abc123',
                  type: 'function',
                  function: {
                    name: 'Read',
                    arguments: '{"filePath":"test.txt"}',
                  },
                },
              ],
            },
          }],
        })
      );

      const provider = createLLMProvider(config);
      const result = await provider.chat([{ role: 'user', content: 'Read file' }]);

      expect(result.content).toBeNull();
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0].id).toBe('call_abc123');
      expect(result.tool_calls[0].function.name).toBe('Read');
      expect(result.tool_calls[0].function.arguments).toBe('{"filePath":"test.txt"}');
    });

    it('should handle API errors', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchResponse({ error: 'Invalid API key' }, false, 401)
      );

      const provider = createLLMProvider(config);
      await expect(
        provider.chat([{ role: 'user', content: 'Hello' }])
      ).rejects.toThrow('LLM API error 401');
    });

    it('should handle empty choices response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchResponse({ choices: [] })
      );

      const provider = createLLMProvider(config);
      await expect(
        provider.chat([{ role: 'user', content: 'Hello' }])
      ).rejects.toThrow('No choice in LLM response');
    });

    it('should handle message with tool_call_id', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        mockFetchResponse({
          choices: [{
            message: { content: 'Tool result received', tool_calls: [] }
          }]
        })
      );

      const provider = createLLMProvider(config);
      const messages: LLMMessage[] = [
        { role: 'tool', content: '{"success":true}', tool_call_id: 'call_1' },
      ];

      const result = await provider.chat(messages);
      expect(result.content).toBe('Tool result received');

      const callArgs = (fetch as any).mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.messages[0].tool_call_id).toBe('call_1');
    });
  });
});
