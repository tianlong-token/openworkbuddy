# WorkBuddy TUI 类型定义文档

> Version: 1.0 | Last Updated: 2026-05-02 | Maintainer: WorkBuddy Contributors

---

## 一、概述

本文档描述 TUI 模块中所有 TypeScript 类型定义（`interface`、`type`）的字段含义、使用场景和扩展方式。

---

## 二、类型索引

| 类型 | 位置 | 用途 |
|------|------|------|
| `ChatMessage` | `components.tsx` | 单条对话消息 |
| `MarkdownSegment` | `components.tsx` | Markdown 行内片段 |
| `TUIConfig` | `index.ts` | TUI 入口配置 |

---

## 三、核心类型详解

### 3.1 `ChatMessage`

**位置**：`components.tsx`

```typescript
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;   // Unix ms，由 sendMessage 自动添加
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `role` | `'user' \| 'assitant' \| 'system'` | ✅ | 消息发送方 |
| `content` | `string` | ✅ | 消息内容（支持 Markdown） |
| `timestamp` | `number` | ❌ | Unix 毫秒时间戳；`MessageBubble` 用 `formatTime()` 显示为 `HH:MM:SS` |

**`role` 各值的行为**：

| 值 | 渲染效果 | 时间戳位置 |
|----|----------|--------------|
| `'user'` | 绿色粗体 `You` + 普通文本 | 顶部状态行 |
| `'assitant'` | 青色粗体 `Agent` + Markdown 渲染 | 顶部状态行 |
| `'system'` | 灰色普通文本（无头像/气泡） | 无 |

**扩展指南**：

添加新字段（如 `status: 'sending' | 'sent' | 'error'`）：

```typescript
// 1. 修改 interface
export interface ChatMessage {
  role: 'user' | 'assitant' | 'system';
  content: string;
  timestamp?: number;
  status?: 'sending' | 'sent' | 'error';   // ← 新增
}

// 2. 修改 MessageBubble 渲染
if (message.status === 'sending') {
  // 显示"发送中..." 动画
}
```

---

### 3.2 `MarkdownSegment`

**位置**：`components.tsx`

```typescript
interface MarkdownSegment {
  type: 'text' | 'bold' | 'code' | 'header' | 'italic';
  text: string;
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | `MarkdownSegmentType` | 片段类型，决定渲染样式 |
| `text` | `string` | 片段文本内容（不含 Markdown 标记） |

**`type` 各值对应的渲染**（由 `renderInlineSegments()` 消费）：

| 值 | 渲染效果 | 实现 |
|----|----------|------|
| `'text'` | 普通文本（无样式） | `<Text>{text}</Text>` |
| `'bold'` | 粗体 | `<Text bold>{text}</Text>` |
| `'code'` | 黄色行内代码 | `<Text color="yellow">{text}</Text>` |
| `'header'` | 粗体 + 青色 | `<Text bold color="cyan">{text}</Text>` |
| `'italic'` | 青色文本（终端不支持真正斜体） | `<Text color="cyan">{text}</Text>` |

> **设计说明**：终端不支持真正的斜体渲染。用青色作为斜体的视觉替代方案，与粗体（白色/亮色）和行内代码（黄色）形成区分。

**扩展指南**：

添加新的 Markdown 语法（如删除线 `~~text~~`）：

```typescript
// 1. 修改 type 联合
type MarkdownSegmentType = 'text' | 'bold' | 'code' | 'header' | 'italic' | 'strikethrough';

// 2. 在 parseInlineMarkdown() 的正则中加入匹配
// 删除线：~~text~~
const regex = /(\*\*(.+?)\*\*)|(`[^`]+?`)|(\*[^*]+\*)|(~~(.+?)~~)/g;

// 3. 在 while 循环中添加处理
if (match[5]) {
  segments.push({ type: 'strikethrough', text: match[6] });
}

// 4. 在 renderInlineSegments() 中添加渲染
{seg.type === 'strikethrough' && <Text dimColor>{seg.text}</Text>}
```

---

### 3.3 `TUIConfig`

**位置**：`index.ts`

```typescript
export interface TUIConfig {
  runtime: any;    // WorkBuddyRuntime 实例
  skillName: string; // 技能 slug，显示在顶部状态栏
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `runtime` | `any` | ✅ | WorkBuddyRuntime 实例，由 `runtime/src/index.ts` 传入 |
| `skillName` | `string` | ✅ | 技能 slug，用于加载技能信息和显示 |

**调用链**：

```typescript
// runtime/src/index.ts 或 CLI 入口
import { runTUI } from './tui/index.js';

const config: TUIConfig = {
  runtime: workbuddyRuntimeInstance,
  skillName: 'deep-research',
};

await runTUI(config);
```

---

## 四、内部类型（不导出）

### 4.1 Spinner 帧常量

**位置**：`app.tsx`（模块级别）

```typescript
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
```

- Unicode 盲文旋转字符，间隔 80ms
- 提到模块级别避免每次渲染重新创建数组

---

## 五、类型扩展完整流程

### 场景：为消息添加「点赞/点踩」反馈

**Step 1**：修改 `ChatMessage`

```typescript
export interface ChatMessage {
  role: 'user' | 'assitant' | 'system';
  content: string;
  timestamp?: number;
  feedback?: 'like' | 'dislike' | null;  // ← 新增
}
```

**Step 2**：修改 `MessageBubble` 添加反馈按钮

```tsx
// components.tsx MessageBubble 函数内
{ message.role === 'assitant' && (
  <Box marginTop={0}>
    <Text dimColor>Did this help? </Text>
    <Text color={message.feedback === 'like' ? 'green' : 'white'}>👍</Text>
    <Text color={message.feedback === 'dislike' ? 'red' : 'white'}>👎</Text>
  </Box>
)}
```

**Step 3**：修改 `app.tsx` 的 `useInput` 添加快捷键（如 `Ctrl+L` 点赞）

```typescript
if (key.ctrl && char === 'l') {
  setMessages(prev => prev.map((m, i) =>
    i === prev.length - 1 ? { ...m, feedback: 'like' } : m
  ));
}
```

**Step 4**：更新 `docs/TUI_TYPES.md`（本文档）记录新字段

---

## 六、常见陷阱

### 陷阱 1：`ChatMessage` 的 `timestamp` 由谁设置？

**问题**：`timestamp` 是可选字段，如果手动构造 `ChatMessage` 时忘记设置，会显示 `now`。

**正确做法**：始终通过 `sendMessage()` 发送消息，它会自动添加 `timestamp: Date.now()`。

```typescript
// ✅ 正确：通过 sendMessage 发送
sendMessage('Hello');

// ❌ 错误：手动构造，忘记 timestamp
setMessages(prev => [...prev, { role: 'user', content: 'Hello' }]);
// → 显示为 "now"
```

### 陷阱 2：`MarkdownSegment` 的 `text` 不含 Markdown 标记

**问题**：`parseInlineMarkdown()` 返回的 `text` 已经**剥离了 Markdown 标记**（如 `**bold**` 的 `text` 是 `bold`，不含 `**`）。

如果在 `renderInlineSegments` 中又手动加上了标记，会导致双重渲染。

### 陷阱 3：`Static` 的 key 必须稳定

**问题**：`MessageList` 使用 Ink `Static` 组件，其 key 必须在消息生命周期内保持稳定。

```typescript
// ❌ 错误：用数组 index 作为 key
<Static items={messages.map((m, i) => ({ ...m, _key: i }))>

// ✅ 正确：用 role + timestamp + index 组合
<Static items={messages.map((m, i) => ({
  ...m,
  _key: `${m.role}_${m.timestamp ?? i}_${i}`
}))}>
```

---

## 七、与其他模块的接口

### Runtime → TUI

```typescript
// runtime/src/index.ts
import { runTUI } from './tui/index.js';

// Runtime 调用 TUI，传入自身实例和技能名
await runTUI({ runtime: this, skillName: 'deep-research' });
```

### TUI → Runtime

TUI 通过 `runtime` 引用调用：

| 调用 | 方法 | 说明 |
|------|------|------|
| 执行技能 | `runtime.runSkill(skillName, msg)` | `app.tsx:sendMessage()` 中调用 |
| 重置对话 | `runtime.getAgentLoop()?.reset()` | `/clear` 命令 |
| 获取技能信息 | `runtime.getSkill(skillName)` | 顶部状态栏显示技能名 |

---

*本文档由 WorkBuddy 在 Craft 模式下自动生成，最后更新于 2026-05-02。*
