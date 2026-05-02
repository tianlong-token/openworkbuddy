import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import { MessageList } from './components.js';
import type { ChatMessage } from './components.js';

// Spinner animation frames (module-level to avoid re-creation)
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function App({ runtime, skillName }: { runtime: any; skillName: string }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const columns = stdout.columns || 80;
  const rows = stdout.rows || 24;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingText, setThinkingText] = useState('');
  // Input history state
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const skillRef = useRef(runtime.getSkill(skillName));
  const inputRef = useRef(input);
  const cursorRef = useRef(cursorPos);
  inputRef.current = input;
  cursorRef.current = cursorPos;

  // Scroll state
  const [scrollOffset, setScrollOffset] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (autoScroll && messages.length > 0) {
      setScrollOffset(0);
    }
  }, [messages.length, autoScroll]);

  // Spinner animation
  useEffect(() => {
    if (!isLoading) {
      setThinkingText('');
      return;
    }
    let i = 0;
    const timer = setInterval(() => {
      i = (i + 1) % SPINNER_FRAMES.length;
      setThinkingText(`${SPINNER_FRAMES[i]} Thinking...`);
    }, 80);
    return () => clearInterval(timer);
  }, [isLoading]);

  // Handle commands: /exit, /clear, /help
  const handleCommand = useCallback((cmd: string): boolean => {
    const args = cmd.slice(1).split(/\s+/);
    switch (args[0]) {
      case 'exit':
      case 'quit':
        exit();
        return true;
      case 'clear':
        runtime.getAgentLoop()?.reset();
        setMessages([]);
        setScrollOffset(0);
        setAutoScroll(true);
        return true;
      case 'help':
        setMessages((prev: ChatMessage[]) => [...prev, {
          role: 'assistant',
          content: '**Available commands:**\n- `/exit` or `/quit` — Exit TUI\n- `/clear` — Clear conversation history\n- `/help` — Show this help',
          timestamp: Date.now(),
        }]);
        return true;
    }
    return false;
  }, [exit, runtime]);

  const sendMessage = useCallback(async (msg: string) => {
    const now = Date.now();
    setMessages((prev: ChatMessage[]) => [...prev, { role: 'user', content: msg, timestamp: now }]);
    setIsLoading(true);

    try {
      const output = await runtime.runSkill(skillName, msg);
      setMessages((prev: ChatMessage[]) => [...prev, { role: 'assistant', content: output, timestamp: Date.now() }]);
    } catch (e: any) {
      setMessages((prev: ChatMessage[]) => [...prev, {
        role: 'assistant',
        content: `**Error:** ${e.message || 'Unknown error'}`,
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [runtime, skillName]);

  useInput((char: string, key: any) => {
    if (key.ctrl && char === 'c') {
      exit();
      return;
    }

    // Enter: send message
    if (key.return) {
      const trimmed = inputRef.current.trim();
      if (!trimmed) return;

      if (trimmed.startsWith('/')) {
        handleCommand(trimmed);
      } else if (!isLoading) {
        // Save to history before sending
        setHistory(prev => [...prev, trimmed]);
        setHistoryIndex(-1);
        sendMessage(trimmed);
      }
      setInput('');
      setCursorPos(0);
      inputRef.current = '';
      cursorRef.current = 0;
      return;
    }

    // Scroll shortcuts: work even during loading
    const availableHeight = Math.max(1, rows - 10);
    const pageSize = Math.max(1, Math.floor(availableHeight / 2));

    if (key.pageUp) {
      setScrollOffset(prev => Math.min(prev + pageSize, messages.length - 1));
      setAutoScroll(false);
      return;
    }
    if (key.pageDown) {
      const newOffset = Math.max(0, scrollOffset - pageSize);
      setScrollOffset(newOffset);
      if (newOffset === 0) setAutoScroll(true);
      return;
    }
    if (key.home && !key.ctrl) {
      setScrollOffset(Math.max(0, messages.length - 1));
      setAutoScroll(false);
      return;
    }
    if (key.end && !key.ctrl) {
      setScrollOffset(0);
      setAutoScroll(true);
      return;
    }

    if (isLoading) return;

    // Ctrl+A: go to start of line (home)
    if (key.ctrl && char === 'a') {
      setCursorPos(0);
      cursorRef.current = 0;
      return;
    }

    // Ctrl+E: go to end of line (end)
    if (key.ctrl && char === 'e') {
      const len = inputRef.current.length;
      setCursorPos(len);
      cursorRef.current = len;
      return;
    }

    // Ctrl+W: delete word backward
    if (key.ctrl && char === 'w') {
      const current = inputRef.current;
      const pos = cursorRef.current;
      const before = current.slice(0, pos);
      const after = current.slice(pos);
      const trimmed = before.replace(/\s*\S+\s*$/, '');
      const newVal = trimmed + after;
      setInput(newVal);
      setCursorPos(trimmed.length);
      inputRef.current = newVal;
      cursorRef.current = trimmed.length;
      return;
    }

    // Ctrl+K: delete to end of line
    if (key.ctrl && char === 'k') {
      const current = inputRef.current;
      const pos = cursorRef.current;
      const newVal = current.slice(0, pos);
      setInput(newVal);
      inputRef.current = newVal;
      return;
    }

    // Backspace
    if (key.backspace || key.delete) {
      const pos = cursorRef.current;
      if (pos > 0) {
        const current = inputRef.current;
        const newVal = current.slice(0, pos - 1) + current.slice(pos);
        setInput(newVal);
        setCursorPos(pos - 1);
        inputRef.current = newVal;
        cursorRef.current = pos - 1;
      }
      return;
    }

    // Arrow keys
    if (key.upArrow) {
      // Browse input history backward
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        const historicalMsg = history[history.length - 1 - newIndex];
        setInput(historicalMsg ?? '');
        setCursorPos((historicalMsg ?? '').length);
        inputRef.current = historicalMsg ?? '';
        cursorRef.current = (historicalMsg ?? '').length;
      }
      return;
    }
    if (key.downArrow) {
      // Browse input history forward
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        const historicalMsg = history[history.length - 1 - newIndex];
        setInput(historicalMsg ?? '');
        setCursorPos((historicalMsg ?? '').length);
        inputRef.current = historicalMsg ?? '';
        cursorRef.current = (historicalMsg ?? '').length;
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
        setCursorPos(0);
        inputRef.current = '';
        cursorRef.current = 0;
      }
      return;
    }

    // Regular character input
    if (char && !key.ctrl && !key.meta) {
      const current = inputRef.current;
      const pos = cursorRef.current;
      const newVal = current.slice(0, pos) + char + current.slice(pos);
      setInput(newVal);
      setCursorPos(pos + 1);
      inputRef.current = newVal;
      cursorRef.current = pos + 1;
    }
  });

  const skill = skillRef.current;
  const skillName_ = skill?.frontmatter?.name || skillName || 'unknown';
  const dividerLength = Math.min(columns || 80, 80);

  return (
    <Box flexDirection="column" height="100%">
      {/* Top bar */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1} paddingY={0}>
        <Text bold color="cyan">● WorkBuddy TUI</Text>
        <Text dimColor> — </Text>
        <Text italic>{skillName_}</Text>
        <Box flexGrow={1} />
        <Text dimColor>Ctrl+A Home | Ctrl+E End | PgUp/PgDn Scroll | ↑↓ History | Ctrl+C Exit</Text>
      </Box>

      {/* Messages area */}
      <Box flexGrow={1} flexDirection="column" marginY={1}>
        <MessageList
          messages={messages}
          scrollOffset={scrollOffset}
          terminalHeight={Math.max(1, rows - 10)}
          terminalWidth={columns}
        />
      </Box>

      {/* Thinking indicator */}
      {isLoading && (
        <Box>
          <Text color="yellow">{thinkingText}</Text>
        </Box>
      )}

      {/* Divider */}
      <Text dimColor>{'─'.repeat(dividerLength)}</Text>

      {/* Input bar */}
      <Box borderStyle="round" borderColor="green" paddingX={1} marginTop={0}>
        <Box marginRight={1}>
          <Text bold color="green">λ</Text>
        </Box>
        <Box flexGrow={1}>
          {input.length === 0 && !isLoading ? (
            <Text dimColor>Type a message...</Text>
          ) : (
            <>
              <Text>{input.slice(0, cursorPos)}</Text>
              <Text inverse backgroundColor="white" color="black">
                {input[cursorPos] || ' '}
              </Text>
              <Text>{input.slice(cursorPos + 1)}</Text>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
