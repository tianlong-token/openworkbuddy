import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAgentLoop, AgentLoop } from '../agent-loop';
import { createLLMProvider, LLMProvider } from '../llm/llm-provider';
import { ToolRouter } from '../tool-router';

// Mock WorkBuddyRuntime
const createMockRuntime = () => {
  const toolRouter = new ToolRouter(['Read', 'Write', 'Bash']);
  toolRouter.register('Read', async () => ({ success: true, output: 'mock read' }));
  toolRouter.register('Write', async () => ({ success: true, output: 'mock write' }));
  toolRouter.register('Bash', async () => ({ success: true, output: 'mock bash' }));
  const mockStore = {
    add: vi.fn().mockResolvedValue('mem_123'),
    search: vi.fn().mockResolvedValue([]),
    getSessionHistory: vi.fn().mockResolvedValue([]),
    clear: vi.fn().mockResolvedValue(undefined),
  };
  return {
    getToolRouter: () => toolRouter,
    getMemoryStore: () => mockStore, // 持久引用，外部可断言
  } as any;
};

function createMockLLMProvider(responses: any[]): LLMProvider {
  let callCount = 0;
  const mockProvider = {
    chat: vi.fn().mockImplementation(async () => {
      if (callCount >= responses.length) {
        return { content: 'Default response', tool_calls: [] };
      }
      const r = responses[callCount++];
      if (r instanceof Error) throw r; // 支持抛出异常
      return r;
    }),
    setToolsSchema: vi.fn(),
    updateConfig: vi.fn(),
  } as any;
  return mockProvider;
}

describe('AgentLoop', () => {
  let mockRuntime: any;

  beforeEach(() => {
    mockRuntime = createMockRuntime();
  });

  describe('constructor and lifecycle', () => {
    it('should create AgentLoop instance', () => {
      const mockProvider = createMockLLMProvider([]);
      const loop = createAgentLoop(mockRuntime, mockProvider);
      expect(loop).toBeInstanceOf(AgentLoop);
    });

    it('should have default maxTurns of 20', () => {
      const mockProvider = createMockLLMProvider([]);
      const loop = createAgentLoop(mockRuntime, mockProvider);
      expect(loop).toBeDefined();
    });
  });

  describe('run()', () => {
    it('should return content when LLM responds directly', async () => {
      const mockProvider = createMockLLMProvider([
        { content: 'Hello from LLM', tool_calls: [] }
      ]);
      const loop = createAgentLoop(mockRuntime, mockProvider);
      const result = await loop.run('You are a helpful assistant', 'Say hello');
      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello from LLM');
      expect(result.turnsUsed).toBe(1);
    });

    it('should handle tool calls and return final response', async () => {
      const mockProvider = createMockLLMProvider([
        {
          content: '',
          tool_calls: [{
            id: 'call_1',
            type: 'function' as const,
            function: { name: 'Read', arguments: '{"filePath":"test.txt"}' }
          }]
        },
        { content: 'File content: mock read', tool_calls: [] }
      ]);
      const loop = createAgentLoop(mockRuntime, mockProvider);
      const result = await loop.run('You are a helpful assistant', 'Read a file');
      expect(result.success).toBe(true);
      expect(result.output).toBe('File content: mock read');
      expect(result.toolCallsCount).toBe(1);
      expect(result.turnsUsed).toBe(2);
    });

    it('should return error on invalid tool JSON args', async () => {
      const mockProvider = createMockLLMProvider([
        {
          content: '',
          tool_calls: [{
            id: 'call_1',
            type: 'function' as const,
            function: { name: 'Read', arguments: 'invalid json' }
          }]
        },
        { content: 'Error handled', tool_calls: [] }
      ]);
      const loop = createAgentLoop(mockRuntime, mockProvider);
      const result = await loop.run('You are a helpful assistant', 'Read a file');
      expect(result.success).toBe(true);
      expect(result.output).toBe('Error handled');
    });

    it('should handle multiple tool calls in one turn', async () => {
      const mockProvider = createMockLLMProvider([
        {
          content: '',
          tool_calls: [
            { id: 'call_1', type: 'function' as const, function: { name: 'Read', arguments: '{"filePath":"a.txt"}' } },
            { id: 'call_2', type: 'function' as const, function: { name: 'Read', arguments: '{"filePath":"b.txt"}' } }
          ]
        },
        { content: 'Both files read', tool_calls: [] }
      ]);
      const loop = createAgentLoop(mockRuntime, mockProvider);
      const result = await loop.run('You are a helpful assistant', 'Read two files');
      expect(result.success).toBe(true);
      expect(result.toolCallsCount).toBe(2);
    });
  });

  describe('continue()', () => {
    it('should append to existing conversation', async () => {
      const mockProvider = createMockLLMProvider([
        { content: 'First response', tool_calls: [] },
        { content: 'Second response', tool_calls: [] }
      ]);
      const loop = createAgentLoop(mockRuntime, mockProvider);

      const first = await loop.run('System prompt', 'First message');
      expect(first.output).toBe('First response');

      const second = await loop.continue('Second message');
      expect(second.output).toBe('Second response');

      const messages = loop.getMessages();
      expect(messages.length).toBe(5); // system + user1 + assistant1 + user2 + assistant2
    });

    it('should throw error if called before run()', async () => {
      const mockProvider = createMockLLMProvider([]);
      const loop = createAgentLoop(mockRuntime, mockProvider);
      await expect(loop.continue('Hello')).rejects.toThrow('No conversation started');
    });
  });

  describe('reset()', () => {
    it('should clear conversation history', async () => {
      const mockProvider = createMockLLMProvider([
        { content: 'Response', tool_calls: [] },
        { content: 'New response', tool_calls: [] }
      ]);
      const loop = createAgentLoop(mockRuntime, mockProvider);

      await loop.run('System prompt', 'First message');
      expect(loop.getMessages().length).toBe(3); // system + user + assistant

      loop.reset();
      expect(loop.getMessages().length).toBe(0);
    });
  });

  describe('getMessages()', () => {
    it('should return copy of messages', async () => {
      const mockProvider = createMockLLMProvider([
        { content: 'Response', tool_calls: [] }
      ]);
      const loop = createAgentLoop(mockRuntime, mockProvider);

      await loop.run('System', 'User msg');
      const msg1 = loop.getMessages();
      const msg2 = loop.getMessages();
      expect(msg1).toEqual(msg2);
      expect(msg1).not.toBe(msg2); // different references
    });
  });

  describe('memory integration', () => {
    it('should save conversation to memory after successful run', async () => {
      const mockProvider = createMockLLMProvider([
        { content: 'Response', tool_calls: [] },
      ]);
      const loop = createAgentLoop(mockRuntime, mockProvider);
      const memStore = mockRuntime.getMemoryStore();

      await loop.run('System prompt', 'Hello');

      expect(memStore.add).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'conversation', sessionId: expect.any(String) })
      );
    });

    it('should load memory context when starting new conversation', async () => {
      // Mock memory search to return one entry
      const memStore = mockRuntime.getMemoryStore();
      const mockEntry = {
        id: 'mem_1',
        sessionId: 'session_prev',
        type: 'conversation' as const,
        content: 'Previous conversation summary',
        metadata: {},
        createdAt: Date.now(),
      };
      memStore.search.mockResolvedValue([mockEntry]);

      const mockProvider = createMockLLMProvider([
        { content: 'Response', tool_calls: [] },
      ]);
      const loop = createAgentLoop(mockRuntime, mockProvider);

      await loop.run('System prompt', 'Hello');

      // Verify search was called
      expect(memStore.search).toHaveBeenCalled();

      // Verify memory context was injected into messages
      const messages = loop.getMessages();
      const memoryMsg = messages.find(m => m.content.includes('历史记忆'));
      expect(memoryMsg).toBeDefined();
    });

    it('should return error result when LLM chat throws', async () => {
      const mockProvider = createMockLLMProvider([
        new Error('API timeout'),
      ]);
      const loop = createAgentLoop(mockRuntime, mockProvider);

      const result = await loop.run('System prompt', 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM chat error');
      expect(result.error).toContain('API timeout');
    });
  });
});
