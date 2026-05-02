# WorkBuddy TUI 组件 API 文档

> Version: 1.0 | Last Updated: 2026-05-02 | Maintainer: WorkBuddy Contributors

---

## 一、概述

本文档描述 TUI 所有导出组件的 Props 接口、使用示例和扩展方式。

---

## 二、组件列表

| 组件 | 导出状态 | 位置 | 用途 |
|--------|----------|------|------|
| `App` | 命名导出 | `app.tsx` | 主应用组件 |
| `MessageList` | 命名导出 | `components.tsx` | 消息列表（高性能） |
| `MessageBubble` | 内部 | `components.tsx` | 单条消息气泡 |
| `MarkdownContent` | 内部 | `components.tsx` | Markdown 渲染器 |
| `renderCodeBlock` | 内部 | `components.tsx` | 代码块渲染 |
| `runTUI` | 命名导出 | `index.ts` | TUI 入口函数 |

---

## 三、导出组件 API

### 3.1 `runTUI(config)`

**位置**：`index.ts`

**功能**：启动 TUI，阻塞当前线程直到用户退出。

```typescript
interface TUIConfig {
  runtime: any;    // WorkBuddyRuntime 实例
  skillName: string; // 要运行的技能 slug
}

async function runTUI(config: TUIConfig): Promise<void>;
```

**使用示例**：

```typescript
// runtime/src/index.ts
import { runTUI } from './tui/index.js';

// 在 CLI --tui 模式下调用
if (options.tui) {
  await runTUI({ runtime: this, skillName: options.skill });
}
```

**阻塞行为**：

`runTUI` 内部调用 `ink.render().waitUntilExit()`，会阻塞直到：
- 用户按 `Ctrl+C`
- 用户输入 `/exit` 或 `/quit`

---

### 3.2 `App(props)`

**位置**：`app.tsx`

**功能**：TUI 主组件，管理所有状态和用户交互。

```typescript
interface AppProps {
  runtime: any;    // WorkBuddyRuntime 实例（来自 runtime/src/index.ts）
  skillName: string; // 技能 slug，显示在顶部状态栏
}
```

**状态（内部）**：

| 状态 | 类型 | 说明 |
|------|------|------|
| `messages` | `ChatMessage[]` | 对话历史（传递给 `MessageList`） |
| `input` | `string` | 当前输入内容 |
| `cursorPos` | `number` | 模拟光标位置 |
| `isLoading` | `boolean` | 是否等待 Agent 回复 |
| `thinkingText` | `string` | Spinner 动画帧文本 |
| `history` | `string[]` | 输入历史记录 |
| `historyIndex` | `number` | 历史浏览位置（-1 = 输入最新） |

**扩展点**：

- 添加新快捷键：在 `useInput` 回调中添加新的 `if (key.xxx)` 分支
- 添加新命令：在 `handleCommand` 的 `switch` 中添加新的 `case`
- 修改 Spinner 帧：修改模块级常量 `SPINNER_FRAMES`

---

### 3.3 `MessageList(props)`

**位置**：`components.tsx`

**功能**：用 Ink `Static` 高性能渲染消息列表。

```typescript
interface MessageListProps {
  messages: ChatMessage[];
}
```

**Key 策略**：

```typescript
// components.tsx MessageList 内部
<Static items={messages.map((m, i) => ({
  ...m,
  _key: `${m.role}_${m.timestamp ?? i}_${i}`
}))}>
```

> **设计说明**：Key 使用 `${role}_${timestamp}_${i}` 而非数组 index，避免消息被删除后 key 错乱。`Static` 要求 key 在消息生命周期内保持稳定。

**扩展点**：

- 添加消息删除功能：需要改用普通 `Box` + `map()`（因为 `Static` 不支持删除中间项）
- 添加消息状态（发送中/发送失败）：在 `ChatMessage` 中加入 `status` 字段

---

## 四、内部组件 API

### 4.1 `MessageBubble(props)`

**位置**：`components.tsx`

**功能**：渲染单条消息气泡（用户/Agent/系统）。

```typescript
interface MessageBubbleProps {
  message: ChatMessage;
}
```

**渲染规则**：

| `message.role` | 标题颜色 | 时间戳调用 |
|----------------|------------|--------------|
| `'user'` | 绿色粗体 `You` | `formatTime(message.timestamp)` |
| `'assistant'` | 青色粗体 `Agent` | `formatTime(message.timestamp)` |
| 其他 | 灰色普通文本 | 无 |

**Markdown 渲染**：

Agent 消息的 `content` 会传入 `MarkdownContent` 组件，自动解析：
- `**bold**` → 粗体
- `` `code` `` → 黄色行内代码
- `*italic*` → 青色文本（终端不支持真正斜体）
- `## Header` → 青色粗体标题
- `li items` → `•` 符号列表
- ````js\ncode\n``` `` → 黄色边框代码块

**扩展点**：

- 添加用户头像：在用户消息前加 `<Text>` 头像字符
- 添加消息操作按钮（复制/重新生成）：在气泡右下角加 `<Box>`

---

### 4.2 `MarkdownContent(props)`

**位置**：`components.tsx`

**功能**：将 Markdown 文本解析为 Ink 组件树。

```typescript
interface MarkdownContentProps {
  content: string;
}
```

**解析流程**：

1. 用正则 `/```(\w*)\n([\s\S]*?)```/g` 分离代码块和普通文本
2. 代码块 → 调用 `renderCodeBlock(content, lang)`
3. 普通文本 → 按 `\n` 分割成行
4. 每行 → 调用 `parseInlineMarkdown(line)` 解析行内格式
5. 列表项 → 转换为 `•` 符号

**支持的 Markdown 语法**：

| 语法 | 正则 | 渲染效果 |
|------|------|----------|
| `# H1` ~ `### H3` | `/^(#{1,3})\s+(.+)/` | 粗体 + 青色 |
| `**bold**` | `/(\*\*(.+?)\*\*)/` | 粗体 |
| `` `code` `` | `/(`.+?`)/` | 黄色行内代码 |
| `*italic*` | `/(\*[^*]+\*)/` | 青色文本 |
| `- item` / `1. item` | `/^(\s*)([-*]\|\d+\.)\s+(.+)/` | `•` 列表项 |
| ````code``` `` | `/```(\w*)\n([\s\S]*?)```/g` | 黄色边框代码块 |

**扩展点**：

- 添加表格支持：解析 `| col1 | col2 |` 语法，用 Ink `Box` + `flexDirection="row"` 模拟
- 添加引用支持：解析 `> quote` 语法，用左侧青色竖线渲染

---

### 4.3 `renderCodeBlock(content, lang?)`

**位置**：`components.tsx`

**功能**：渲染代码块（带边框和语言名）。

```typescript
function renderCodeBlock(
  content: string,
  lang?: string   // 语言标识符（如 "js", "tsx"）
): React.ReactNode;
```

**渲染结构**：

```tsx
<Box borderStyle="round" borderColor="yellow" paddingX={1} paddingY={0} marginY={1}>
  {lang && <Text dimColor>{lang}</Text>}  {/* 语言名 */}
  {content.split('\n').map((line, i) => (
    <Text key={i} color="green">{line}</Text>  {/* 绿色代码 */}
  ))}
</Box>
```

**扩展点**：

- 添加行号：在每行前加 `<Text dimColor>{i + 1}</Text>`
- 添加语法高亮：引入 `shiki` 或手动关键词 → 颜色映射

---

### 4.4 `parseInlineMarkdown(line)`

**位置**：`components.tsx`

**功能**：解析行内 Markdown（粗体 / 代码 / 斜体）。

```typescript
function parseInlineMarkdown(line: string): MarkdownSegment[];
```

**正则**：

```typescript
// 同时匹配三种语法
const regex = /(\*\*(.+?)\*\*)|(`[^`]+?`)|(\*[^*]+\*)/g;
//              匹配 **bold**      匹配 `code`     匹配 *italic*
```

**返回值**：`MarkdownSegment[]`，由 `renderInlineSegments()` 消费。

---

### 4.5 `formatTime(timestamp?)`

**位置**：`components.tsx`

**功能**：将 Unix ms 时间戳格式化为 `HH:MM:SS`。

```typescript
function formatTime(timestamp?: number): string;
```

**实现**：

```typescript
function formatTime(timestamp?: number): string {
  if (!timestamp) return 'now';
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
```

---

## 五、扩展指南

### 5.1 添加新组件

1. 在 `components.tsx` 或新建 `components/NewComponent.tsx`
2. 编写函数组件 + JSDoc 注释
3. 如果是内部组件，不用导出；如果要导出，加 `export`
4. 在 `app.tsx` 中引入并使用

### 5.2 修改消息气泡样式

1. 打开 `components.tsx`
2. 找到 `function MessageBubble`
3. 修改 `<Box>` 的样式属性（`borderStyle`, `borderColor`, `paddingX` 等）
4. 修改时间戳颜色、头像文本等

### 5.3 添加新的 Markdown 语法

1. 在 `MarkdownSegment` 类型中加入新类型
2. 在 `parseInlineMarkdown` 的正则中加入新语法的匹配
3. 在 `renderInlineSegments` 中加入新类型的渲染逻辑

---

## 六、Props 类型参考

### `ChatMessage`

```typescript
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;  // Unix ms，由 sendMessage 自动添加
}
```

### `MarkdownSegment`

```typescript
interface MarkdownSegment {
  type: 'text' | 'bold' | 'code' | 'header' | 'italic';
  text: string;
}
```

---

*本文档由 WorkBuddy 在 Craft 模式下自动生成，最后更新于 2026-05-02。*
