import { describe, it, expect } from 'vitest';

// Replicate the pure functions from components.tsx for testing
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

function estimateMessageLines(msg: ChatMessage, terminalWidth: number): number {
  let lines = 2; // header + spacing
  const maxContentWidth = terminalWidth - 4;
  for (const paragraph of msg.content.split('\n')) {
    lines += Math.max(1, Math.ceil(paragraph.length / maxContentWidth));
  }
  return lines;
}

function calculateVisibleWindow(
  messages: ChatMessage[],
  offset: number,
  availableLines: number,
  terminalWidth: number
): ChatMessage[] {
  if (messages.length === 0) return [];

  const totalLines = messages.map(msg => estimateMessageLines(msg, terminalWidth));
  const endIdx = Math.max(0, messages.length - 1 - offset);

  let consumedLines = 0;
  let startIdx = endIdx;

  for (let i = endIdx; i >= 0; i--) {
    if (consumedLines + totalLines[i] > availableLines && i < endIdx) break;
    startIdx = i;
    consumedLines += totalLines[i];
  }

  return messages.slice(startIdx, endIdx + 1);
}

function makeMsg(content: string): ChatMessage {
  return { role: 'user', content, timestamp: Date.now() };
}

describe('estimateMessageLines', () => {
  it('counts header + spacing as 2 lines minimum', () => {
    const msg = makeMsg('hello');
    expect(estimateMessageLines(msg, 80)).toBe(3); // 2 (header) + 1 (content)
  });

  it('counts each paragraph as at least 1 line', () => {
    const msg = makeMsg('line1\nline2\nline3');
    expect(estimateMessageLines(msg, 80)).toBe(5); // 2 + 3
  });

  it('wraps long lines based on terminal width', () => {
    const msg = makeMsg('a'.repeat(160));
    // 160 chars at width 80-4=76 → ceil(160/76) = 3 lines
    expect(estimateMessageLines(msg, 80)).toBe(5); // 2 + 3
  });
});

describe('calculateVisibleWindow', () => {
  const msgs = Array.from({ length: 10 }, (_, i) => makeMsg(`Message ${i}`));

  it('returns empty for empty messages', () => {
    expect(calculateVisibleWindow([], 0, 10, 80)).toEqual([]);
  });

  it('shows last messages when offset=0', () => {
    // Each msg = 3 lines (2 header + 1 content). 10 lines → 3 msgs (9 lines) + overflow
    const visible = calculateVisibleWindow(msgs, 0, 10, 80);
    expect(visible.length).toBeGreaterThanOrEqual(3);
    expect(visible[visible.length - 1]).toBe(msgs[9]); // last msg must be included
  });

  it('scrolls up when offset > 0', () => {
    const visible0 = calculateVisibleWindow(msgs, 0, 10, 80);
    const visible1 = calculateVisibleWindow(msgs, 1, 10, 80);
    // offset=1 should show older messages than offset=0
    expect(visible1[0]).not.toBe(visible0[0]);
  });

  it('handles offset larger than message count', () => {
    const visible = calculateVisibleWindow(msgs, 100, 10, 80);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible[0]).toBe(msgs[0]); // should show from the beginning
  });

  it('handles single message', () => {
    const single = [makeMsg('only one')];
    const visible = calculateVisibleWindow(single, 0, 10, 80);
    expect(visible).toEqual(single);
  });

  it('fits messages within availableLines', () => {
    const longMsgs = [
      makeMsg('short'),
      makeMsg('a'.repeat(200)), // long message
      makeMsg('short again'),
    ];
    const visible = calculateVisibleWindow(longMsgs, 0, 5, 80);
    // With limited space (5 lines), shouldn't show all messages
    expect(visible.length).toBeLessThan(longMsgs.length);
  });
});
