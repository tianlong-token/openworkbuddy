/**
 * TUI 虚拟滚动手动测试脚本
 * 用模拟数据启动 TUI，不依赖 LLM 和技能
 *
 * 使用方法：
 *   cd runtime
 *   npx tsx src/test/tui-scroll-manual-test.tsx
 *
 * 快捷键：
 *   PageUp    — 向上翻页
 *   PageDown  — 向下翻页
 *   Home      — 跳到最早消息
 *   End       — 跳到最新消息
 *   Enter     — 添加一条模拟消息
 *   Ctrl+C    — 退出
 */
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp, useStdout, render } from 'ink';
import { MessageList } from '../tui/components.js';
import type { ChatMessage } from '../tui/components.js';

function TestApp() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const columns = stdout.columns || 80;
  const rows = stdout.rows || 24;

  // Generate 30 mock messages with varying lengths
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    Array.from({ length: 30 }, (_, i) => ({
      role: (i % 3 === 1 ? 'assistant' : 'user') as 'user' | 'assistant',
      content: [
        `**Message #${i + 1}** — This is a test message.`,
        `Short message.`,
        `Long line: ${'Lorem ipsum dolor sit amet. '.repeat(5)}`,
        `Multi-line\nmessage\nwith\nseveral\nparagraphs\nfor testing.`,
        `**Bold text** and \`code\` and *italic* in one message #${i + 1}.`,
        `A message with a \`\`\`js\nconst x = 42;\nconsole.log(x);\n\`\`\` code block inside it.`,
        `Message #${i + 1}: ${'word '.repeat(i + 1)}`,
      ][i % 7],
      timestamp: Date.now() + i * 1000,
    }))
  );

  const [scrollOffset, setScrollOffset] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [msgCount, setMsgCount] = useState(0);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (autoScroll && messages.length > 0) {
      setScrollOffset(0);
    }
  }, [messages.length, autoScroll]);

  useInput((_char: string, key: any) => {
    if (key.ctrl && _char === 'c') {
      exit();
      return;
    }

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

    // Enter: add a mock message
    if (key.return) {
      const i = messages.length;
      setMsgCount(c => c + 1);
      setMessages(prev => [...prev, {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `**New Message #${i + 1}** — Added at ${new Date().toLocaleTimeString()}. ${'word '.repeat((msgCount % 5) + 1)}`,
        timestamp: Date.now(),
      }]);
    }
  });

  return (
    <Box flexDirection="column" height="100%">
      {/* Top bar */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1} paddingY={0}>
        <Text bold color="cyan">● Scroll Test</Text>
        <Box flexGrow={1} />
        <Text dimColor>PgUp/PgDn Scroll | Enter=Add msg | Ctrl+C Exit</Text>
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

      {/* Status bar */}
      <Box>
        <Text dimColor>
          msgs:{messages.length} | offset:{scrollOffset} | autoScroll:{String(autoScroll)} | rows:{rows} | cols:{columns}
        </Text>
      </Box>

      {/* Divider */}
      <Text dimColor>{'─'.repeat(Math.min(columns || 80, 80))}</Text>

      {/* Input bar */}
      <Box borderStyle="round" borderColor="green" paddingX={1}>
        <Text bold color="green">λ</Text>
        <Box marginLeft={1}>
          <Text dimColor>Press Enter to add a mock message</Text>
        </Box>
      </Box>
    </Box>
  );
}

render(React.createElement(TestApp));
