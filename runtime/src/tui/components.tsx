import React, { Fragment, useState, useEffect } from 'react';
import { Box, Text } from 'ink';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

// ─── Helpers ─────────────────────────────────────────────
/** Format Unix ms timestamp to HH:MM:SS (24-hour) */
function formatTime(timestamp?: number): string {
  if (!timestamp) return 'now';
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// ─── Markdown renderer ──────────────────────────────────────

interface MarkdownSegment {
  type: 'text' | 'bold' | 'code' | 'header' | 'italic';
  text: string;
}

function parseInlineMarkdown(line: string): MarkdownSegment[] {
  // Handle headers: # text
  const headerMatch = line.match(/^(#{1,3})\s+(.+)/);
  if (headerMatch) {
    // Header text may contain inline markdown — render it
    return [{ type: 'header', text: headerMatch[2] }];
  }

  const segments: MarkdownSegment[] = [];
  // Supports: **bold**, `code`, *italic*
  const regex = /(\*\*(.+?)\*\*)|(`[^`]+?`)|(\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: line.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      segments.push({ type: 'bold', text: match[2] });
    } else if (match[3]) {
      segments.push({ type: 'code', text: match[3].slice(1, -1) });
    } else if (match[4]) {
      // Italic: terminal cannot render true italics; use underline color as visual cue
      segments.push({ type: 'italic', text: match[4].slice(1, -1) });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    segments.push({ type: 'text', text: line.slice(lastIndex) });
  }

  return segments;
}

function renderInlineSegments(segments: MarkdownSegment[]): React.ReactNode {
  return segments.map((seg, i) => (
    <Fragment key={i}>
      {seg.type === 'bold' && <Text bold>{seg.text}</Text>}
      {seg.type === 'code' && <Text color="yellow">{seg.text}</Text>}
      {seg.type === 'header' && <Text bold color="cyan">{seg.text}</Text>}
      {seg.type === 'italic' && <Text color="cyan">{seg.text}</Text>}
      {seg.type === 'text' && <Text>{seg.text}</Text>}
    </Fragment>
  ));
}

// ─── Code block rendering ───────────────────────────────────

function renderCodeBlock(content: string, lang?: string): React.ReactNode {
  const lines = content.split('\n');
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} paddingY={0} marginY={1}>
      {lang && (
        <Text dimColor>{lang}</Text>
      )}
      {lines.map((line, i) => (
        <Fragment key={i}>
          <Text color="green">{line}</Text>
        </Fragment>
      ))}
    </Box>
  );
}

// ─── Main markdown renderer ─────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const parts: Array<{ type: 'code'; lang: string; content: string } | { type: 'text'; content: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', lang: match[1], content: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'code') {
          return <Fragment key={i}>{renderCodeBlock(part.content, part.lang)}</Fragment>;
        }

        const lines = part.content.split('\n');
        return (
          <Fragment key={i}>
            {lines.map((line, j) => {
              if (line.trim() === '') {
                return <Fragment key={`${i}-${j}`}><Text>{'\n'}</Text></Fragment>;
              }

              const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)/);
              if (listMatch) {
                const indent = listMatch[1].length > 0 ? '  ' : '';
                const bullet = listMatch[2].length <= 2 ? '•' : `${listMatch[2]}`;
                const restText = listMatch[3];
                const segments = parseInlineMarkdown(restText);
                return (
                  <Fragment key={`${i}-${j}`}>
                    <Text>
                      {indent}{bullet} {renderInlineSegments(segments)}
                    </Text>
                  </Fragment>
                );
              }

              const segments = parseInlineMarkdown(line);
              return (
                <Fragment key={`${i}-${j}`}>
                  <Text>
                    {renderInlineSegments(segments)}
                  </Text>
                </Fragment>
              );
            })}
          </Fragment>
        );
      })}
    </>
  );
}

// ─── Message bubble ─────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const timeStr = formatTime(message.timestamp);

  if (message.role === 'user') {
    return (
      <Box flexDirection="column" marginBottom={1} paddingLeft={1}>
        <Box>
          <Text bold color="green">You</Text>
          <Text dimColor>  •  {timeStr}</Text>
        </Box>
        <Box marginTop={0} paddingLeft={1}>
          <Text>{message.content}</Text>
        </Box>
      </Box>
    );
  }

  if (message.role === 'assistant') {
    return (
      <Box flexDirection="column" marginBottom={1} paddingLeft={1}>
        <Box>
          <Text bold color="cyan">Agent</Text>
          <Text dimColor>  •  {timeStr}</Text>
        </Box>
        <Box marginTop={0} paddingLeft={1}>
          <MarkdownContent content={message.content} />
        </Box>
      </Box>
    );
  }

  return (
    <Box marginBottom={1} paddingLeft={1}>
      <Text dimColor>{message.content}</Text>
    </Box>
  );
}

// ─── Message lines estimation ─────────────────────────────────

/** Estimate the display width of a string, accounting for CJK and ANSI codes */
function estimateDisplayWidth(text: string): number {
  // Strip ANSI escape codes
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, '');
  let width = 0;
  for (const char of stripped) {
    const code = char.codePointAt(0) || 0;
    // CJK Unified Ideographs, CJK Extensions, Hangul, Kana, Full-width
    if (
      (code >= 0x1100 && code <= 0x115F) ||
      (code >= 0x2E80 && code <= 0x9FFF) ||
      (code >= 0xAC00 && code <= 0xD7AF) ||
      (code >= 0xF900 && code <= 0xFAFF) ||
      (code >= 0xFF01 && code <= 0xFF60) ||
      (code >= 0xFFE0 && code <= 0xFFE6) ||
      (code >= 0x1F300 && code <= 0x1F9FF) ||
      (code >= 0x20000 && code <= 0x2FA1F)
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

function estimateMessageLines(msg: ChatMessage, terminalWidth: number): number {
  // Fixed: role title line ("You • 14:30:00") + spacing = 2
  let lines = 2;

  // Message content wraps according to terminal width (using display width for CJK)
  const maxContentWidth = terminalWidth - 4;
  for (const paragraph of msg.content.split('\n')) {
    const displayWidth = estimateDisplayWidth(paragraph);
    lines += Math.max(1, Math.ceil(displayWidth / maxContentWidth));
  }

  return lines;
}

// ─── Calculate visible window ─────────────────────────────────

function calculateVisibleWindow(
  messages: ChatMessage[],
  offset: number,         // offset from bottom (number of messages)
  availableLines: number,  // available lines in the message area
  terminalWidth: number    // terminal width for line estimation
): ChatMessage[] {
  if (messages.length === 0) return [];

  const totalLines = messages.map(msg => estimateMessageLines(msg, terminalWidth));

  // endIdx is the last message to show (accounting for scrollOffset from bottom)
  const endIdx = Math.max(0, messages.length - 1 - offset);

  // Work backwards from endIdx to fill availableLines
  let consumedLines = 0;
  let startIdx = endIdx;

  for (let i = endIdx; i >= 0; i--) {
    if (consumedLines + totalLines[i] > availableLines && i < endIdx) break;
    startIdx = i;
    consumedLines += totalLines[i];
  }

  return messages.slice(startIdx, endIdx + 1);
}

// ─── Message list (refactored) ───────────────────────────────────

export function MessageList({
  messages,
  scrollOffset,
  terminalHeight,
  terminalWidth,
}: {
  messages: ChatMessage[];
  scrollOffset: number;
  terminalHeight: number;
  terminalWidth: number;
}) {
  if (messages.length === 0) {
    return (
      <Box flexDirection="column" alignItems="center" marginTop={2}>
        <Text dimColor italic>No messages yet. Type something to start chatting!</Text>
      </Box>
    );
  }

  const visibleMessages = calculateVisibleWindow(messages, scrollOffset, terminalHeight, terminalWidth);

  return (
    <Box flexDirection="column">
      {visibleMessages.map((msg, index) => (
        <MessageBubble key={`${msg.role}_${msg.timestamp ?? index}_${index}`} message={msg} />
      ))}
    </Box>
  );
}
