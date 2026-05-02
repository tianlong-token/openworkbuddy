# WorkBuddy TUI 增强功能技术方案

> Version: 1.0 | Last Updated: 2026-05-02 | Status: Draft

---

## 目录

1. [功能一：代码块语法高亮](#功能一代码块语法高亮)
2. [功能二：消息区域滚动](#功能二消息区域滚动)
3. [两个功能的协作关系](#两个功能的协作关系)
4. [实施路线图](#实施路线图)

---

## 功能一：代码块语法高亮

### 1.1 现状

当前 `components.tsx:80-93` 的 `renderCodeBlock` 将所有代码渲染为绿色文本：

```tsx
<Box borderStyle="round" borderColor="yellow" paddingX={1} paddingY={0} marginY={1}>
  {lang && <Text dimColor>{lang}</Text>}
  {lines.map((line, i) => (
    <Text color="green">{line}</Text>   // ← 全绿色，无高亮
  ))}
</Box>
```

### 1.2 选型：shiki

推荐使用 **shiki**（当前最新 v4.0.2），理由：

| 方案 | 优点 | 缺点 |
|------|------|------|
| **shiki** | 精确的 TextMate 语法高亮，200+ 语言，自带主题配色（如 `min-dark`） | 包体积 ~5MB（含所有 grammar），但可按需加载 |
| highlight.js | 体积较小（~200KB） | 语法精度不如 shiki，返回 HTML 字符串，需要额外解析 |
| 手动正则 | 零依赖 | 覆盖度差，每个语言需要单独维护规则 |

**选择 shiki 的决定性理由**：shiki 4.x 的 `codeToTokens` API 直接返回带颜色信息的 token 数组，天然适合映射到 Ink 的 `<Text color>` 组件，不需要处理 HTML 解析。

### 1.3 核心 API

```typescript
import { codeToTokens } from 'shiki';

const { tokens } = await codeToTokens('const x = 1;', {
  lang: 'typescript',
  theme: 'min-dark',
});
// tokens = [
//   [{ content: 'const', color: '#569CD6', fontStyle: 1 }, ...],  // 第1行
// ]
```

每个 `ThemedToken` 包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `content` | `string` | token 文本 |
| `color` | `string` | 十六进制颜色（如 `"#569CD6"`），可直接传给 Ink |
| `fontStyle` | `number` | 位标志：1=斜体, 2=粗体, 4=下划线, 8=删除线 |

### 1.4 Ink 颜色兼容性

Ink 4.x 的 `<Text color>` 支持十六进制色值（底层由 chalk 5.x 驱动，`chalk.hex('#569CD6')` 原生支持）。`color` 在 Ink 类型中是 `string`，可直接传入 `#RRGGBB`。

**映射规则**：

```
shiki ThemedToken.color (#RRGGBB)
    → <Text color="#RRGGBB">{content}</Text>

fontStyle 包含 2 (bold)
    → 追加 <Text bold>

fontStyle 包含 1 (italic)
    → 追加 <Text italic>  （Ink 不支持真正斜体，和现有约定一致用颜色替代）
```

### 1.5 实现方案

#### 架构

新增 `runtime/src/tui/highlighter.ts`，负责 shiki 的初始化和缓存：

```
tui/
├── highlighter.ts    ← 新增：shiki 高亮器（懒加载 + 缓存）
├── index.ts
├── app.tsx
├── components.tsx    ← 修改：renderCodeBlock 调用高亮器
└── package.json
```

#### highlighter.ts 设计

```typescript
// highlighter.ts

// 核心设计：懒加载 + 按需语言 + Token 缓存

// 1. 高亮器实例作为模块级变量（单例），首次调用时初始化
// 2. 只加载常用语言子集以控制包体积
// 3. 缓存高频代码片段的高亮结果（LRU）
//
// 伪代码结构：

export async function highlightCode(code: string, lang?: string): Promise<TokenLine[]> {
  // 1. 如果 lang 为空或无法识别，返回普通文本（降级）
  // 2. 检查缓存命中 → 直接返回
  // 3. 懒初始化 highlighter（只在有代码块时加载 shiki）
  // 4. 调用 codeToTokens()
  // 5. 写入缓存
  // 6. 返回 Tokens
}

interface TokenSegment {
  text: string;
  color?: string;      // 十六进制
  bold?: boolean;
  italic?: boolean;
}

type TokenLine = TokenSegment[];
```

**关键设计决策**：

| 决策 | 选择 | 理由 |
|------|------|------|
| 初始化时机 | 懒加载：首次遇到代码块时初始化 | 避免 TUI 启动时加载 shiki（5MB+），不影响冷启动速度 |
| 语言加载策略 | 初始加载 `javascript,typescript,python,bash,json,markdown` | 覆盖 90%+ 使用场景。在 `createHighlighter` 的 `langs` 参数中指定 |
| 缓存策略 | LRU 缓存，最大 50 条 | 避免重复对同一代码片段高亮（翻历史时常见） |
| 错误处理 | `try/catch` 降级为普通绿色渲染 | shiki 加载失败不应阻塞消息显示 |
| 主题选择 | `min-dark` | 高对比度，终端友好 |

#### components.tsx 修改

修改 `renderCodeBlock`：

```typescript
// 修改前
function renderCodeBlock(content: string, lang?: string): React.ReactNode {
  const lines = content.split('\n');
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} paddingY={0} marginY={1}>
      {lang && <Text dimColor>{lang}</Text>}
      {lines.map((line, i) => (
        <Text key={i} color="green">{line}</Text>
      ))}
    </Box>
  );
}

// 修改后
function renderCodeBlock(content: string, lang?: string): React.ReactNode {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} paddingY={0} marginY={1}>
      {lang && <Text dimColor>{lang}</Text>}
      <HighlightedCode code={content} lang={lang} />
    </Box>
  );
}

// 新组件：异步高亮、同步回退
function HighlightedCode({ code, lang }: { code: string; lang?: string }) {
  const [tokenLines, setTokenLines] = useState<TokenLine[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    highlightCode(code, lang).then(tokens => {
      if (!cancelled) setTokenLines(tokens);
    }).catch(() => {
      if (!cancelled) setError(true);
    });
    return () => { cancelled = true; };
  }, [code, lang]);

  // 加载中 / 出错 → 普通绿色回退
  if (!tokenLines || error) {
    return <Text color="green">{code}</Text>;
  }

  return (
    <>
      {tokenLines.map((line, i) => (
        <Text key={i}>
          {line.map((seg, j) => (
            <Text
              key={j}
              color={seg.color ?? 'green'}
              bold={seg.bold}
              italic={seg.italic}
            >
              {seg.text}
            </Text>
          ))}
          {'\n'}
        </Text>
      ))}
    </>
  );
}
```

> **注意**：`HighlightedCode` 必须设计为 **异步兼容**。shiki 初始化是异步的（首次需要加载 wasm + grammar）。首次渲染时回退到绿色文本，高亮完成后自动替换。

### 1.6 依赖变更

```json
// runtime/package.json
{
  "dependencies": {
    "shiki": "^4.0.2"    // 新增
  }
}
```

### 1.7 边界情况

| 场景 | 处理方式 |
|------|----------|
| `lang` 未指定或无法识别 | 回退到普通绿色文本（shiki 也可无语言运行，但效果差） |
| 超大代码块（>500 行） | 在高亮前截断到 200 行 + 追加 `"... (truncated)"` |
| 高亮耗时 >100ms | 对用户无感知：首次渲染已显示绿色回退，高亮完成后替换 |
| shiki 加载失败（网络/内存） | `catch` 后永久回退到绿色文本，不影响 TUI 稳定性 |
| 主题色在白色终端不可读 | shiki 的 `min-dark` 在浅色背景下实际可读；可选提供 `min-light` 作为 fallback |

### 1.8 工作量评估

| 阶段 | 工时 | 产出物 |
|------|------|--------|
| 1. 安装依赖 + 创建 highlighter.ts | 30 min | 高亮器模块 |
| 2. 修改 components.tsx（renderCodeBlock + HighlightedCode） | 45 min | 高亮渲染 |
| 3. 缓存 + LRU + 边界情况 | 30 min | 健壮性 |
| 4. 测试（多语言、大文件、降级路径） | 30 min | 验证 |
| **总计** | **~2 小时** | |

---

## 功能二：消息区域滚动

### 2.1 现状

当前使用 Ink `<Static>` 组件渲染消息列表：

```tsx
// components.tsx:214
<Static items={messages.map((m, i) => ({ ...m, _key: ... }))}>
  {(msg: any) => (
    <Box key={msg._key}>
      <MessageBubble message={msg} />
    </Box>
  )}
</Static>
```

**`<Static>` 的特性**：只渲染新增项，已渲染项冻结（不参与后续 diff）。这意味着：
- 当消息数量超过终端高度时，超出部分不可见
- 没有滚动机制
- 不能通过方向键查看历史消息

### 2.2 方案对比

**不推荐使用第三方库**。原因：

| 方案 | 问题 |
|------|------|
| `ink-virtual-list` | 需要 Ink ^6.6.0 + React ^19.x，升级涉及 breaking changes |
| `ink-scroll-box` | 同上 |
| **自制虚拟滚动** | 兼容当前 Ink 4.x，无新增依赖，完全控制行为 |

### 2.3 架构设计

#### 核心思路

用 **条件渲染** 替代 `<Static>`：只渲染可见的消息行，`scrollOffset` 追踪偏移。

```
终端窗口 (假设高 24 行)
┌──────────────────────────┐
│ 顶部状态栏           (3行)│
├──────────────────────────┤
│ 消息1  You               │  ← 可见消息
│   hello                  │
│ 消息2  Agent             │
│   Hi there!              │
│ 消息3  You               │
│   What is ...            │
│ 消息4  Agent (部分可见)    │  ← 被截断
│                          │
│  ───────────────────  (1行)│
│ λ 输入栏              (3行)│
└──────────────────────────┘
   ↑ 可见区域
   scrollOffset = 0 (显示最新消息)
```

#### 核心状态

```typescript
// app.tsx 新增状态
const [scrollOffset, setScrollOffset] = useState(0);
// scrollOffset: 从最新消息往上偏移的消息条数
// 0 = 显示底部（最新消息）
// 1 = 向上偏移 1 条
// N = 向上偏移 N 条

// 自动滚动标志（是否在新消息时跟随到最新）
const [autoScroll, setAutoScroll] = useState(true);
```

#### 消息行数估算

每条消息占据的行数是可变的。使用**估算器**：

```typescript
function estimateMessageLines(msg: ChatMessage, terminalWidth: number): number {
  // 固定：角色标题行（"You • 14:30:00"）+ 上下间距 = 2
  let lines = 2;

  // 消息内容按终端宽度折行
  const maxContentWidth = terminalWidth - 4;  // 减去边距
  for (const paragraph of msg.content.split('\n')) {
    lines += Math.max(1, Math.ceil(paragraph.length / maxContentWidth));
  }

  return lines;
}
```

> **注意**：这是一个**近似估算**。Markdown 渲染（特别是代码块）的实际行数更难精确计算。因为只是用来确定可见范围，近似值足够 —— 滚动时保留 2 条消息的缓冲区。

#### 组件重构

重构 `MessageList`，接收 `scrollOffset` 并计算可见窗口：

```typescript
interface MessageListProps {
  messages: ChatMessage[];
  scrollOffset: number;    // 父组件传入
  terminalHeight: number;  // 可用行数
  onVisibleRangeChange?: (start: number, end: number) => void;
}

function MessageList({ messages, scrollOffset, terminalHeight }: MessageListProps) {
  // 1. 估算每条消息的行数
  // 2. 从底部往上计算：scrollOffset 决定了从哪条消息开始显示
  // 3. 向下计算可见范围，填满 terminalHeight 行
  // 4. 只渲染可见范围内的消息

  if (messages.length === 0) {
    return <EmptyState />;
  }

  const visibleMessages = calculateVisibleWindow(messages, scrollOffset, terminalHeight);

  return (
    <Box flexDirection="column">
      {visibleMessages.map(msg => (
        <MessageBubble key={buildKey(msg)} message={msg} />
      ))}
    </Box>
  );
}

function calculateVisibleWindow(
  messages: ChatMessage[],
  offset: number,         // 从底部往上偏移多少条消息
  availableLines: number  // 可用行数
): ChatMessage[] {
  // 1. 从最后一条消息开始，向上累加行数
  //    到达 offset 条后，继续累加直至撑满 availableLines
  // 2. 返回应当显示的消息切片

  const totalLines: number[] = [];  // 每条消息的行数

  // 粗略估算
  const lineWidth = process.stdout.columns || 80;
  for (const msg of messages) {
    totalLines.push(estimateMessageLines(msg, lineWidth));
  }

  // 从末尾开始定位
  let startIdx = Math.max(0, messages.length - offset - 1);
  let consumedLines = 0;

  // 从 startIdx 往下，填满 availableLines
  const visible: ChatMessage[] = [];
  for (let i = startIdx; i < messages.length; i++) {
    if (consumedLines + totalLines[i] > availableLines && i > startIdx) break;
    visible.push(messages[i]);
    consumedLines += totalLines[i];
  }

  return visible;
}
```

#### 键盘快捷键

在 `app.tsx` 的 `useInput` 中新增：

```typescript
// PageUp: 向上翻页
if (key.pageUp) {
  setScrollOffset(prev => Math.min(prev + pageSize, messages.length - 1));
  setAutoScroll(false);
  return;
}

// PageDown: 向下翻页
if (key.pageDown) {
  const newOffset = Math.max(0, scrollOffset - pageSize);
  setScrollOffset(newOffset);
  if (newOffset === 0) setAutoScroll(true);
  return;
}

// Home: 回到最顶部
if (key.home && !key.ctrl) {
  setScrollOffset(messages.length - 1);
  setAutoScroll(false);
  return;
}

// End: 回到最底部
if (key.end && !key.ctrl) {
  setScrollOffset(0);
  setAutoScroll(true);
  return;
}
```

#### 自动滚动逻辑

```typescript
// 在 useEffect 中监听 messages 变化
useEffect(() => {
  if (autoScroll && messages.length > 0) {
    setScrollOffset(0);  // 保持显示最新消息
  }
}, [messages.length]);  // 注意：只监听数组长度变化，减少触发次数
```

用户手动向上翻页 → `autoScroll = false` → 新消息到达时不会自动跳到底部
用户按 End 或 PageDown 到达底部 → `autoScroll = true` → 恢复自动滚动

### 2.4 旧组件迁移注意事项

当前 `MessageList` 有以下设计需要保留：

1. **空状态**：`No messages yet. Type something to start chatting!` ✓ 保留
2. **性能**：移除 `<Static>` 后，每次消息变化都会重新渲染所有可见消息。好在可见消息通常只占屏幕的 10-20 条，React diff 足够快。如果未来消息量极大，可以用 `React.memo` 包裹 `MessageBubble`
3. **Key**：仍使用 `role_timestamp_index` 确保 React 正确复用 DOM

### 2.5 边界情况

| 场景 | 处理方式 |
|------|----------|
| 终端窗口调整大小 | `useStdoutDimensions` 会重新触发渲染，当前可见范围自动重新计算 |
| 消息高度估算不准（截断/多余空白） | 保留 2 条消息的缓冲区，宁多勿少 |
| 快速连续输入新消息 | `autoScroll=true` 时每次消息到达都重新计算偏移，只在数组长度变化时触发 |
| 消息被删除（`/clear`） | 重置 `scrollOffset = 0`、`autoScroll = true` |
| 终端高度非常小（< 10 行） | 顶部状态栏和输入栏占用固定行数，消息区最小保留 3 行 |
| 估算行数 > 实际渲染行数 | 底部可能出现少量空白。可接受，优于消息被截断 |

### 2.6 标题栏快捷键提示更新

更新顶部栏提示，反映新的滚动能力：

```
// 之前
Ctrl+A Home | Ctrl+E End | ↑↓ History | Ctrl+C Exit

// 之后
Ctrl+A Home | Ctrl+E End | PgUp/PgDn Scroll | ↑↓ History | Ctrl+C Exit
```

### 2.7 状态概览（新增/修改的状态）

| 状态 | 类型 | 说明 | 初始值 |
|------|------|------|--------|
| `scrollOffset` | `number` | 从最新消息向上偏移条数 | `0` |
| `autoScroll` | `boolean` | 新消息到达时是否自动滚到底部 | `true` |

### 2.8 工作量评估

| 阶段 | 工时 | 产出物 |
|------|------|--------|
| 1. 重构 MessageList（移除 Static，改为条件渲染） | 60 min | 消息列表组件 |
| 2. 实现 scrollOffset + autoScroll 状态管理 | 20 min | 滚动状态 |
| 3. 实现消息行数估算器 | 20 min | 工具函数 |
| 4. 实现键盘快捷键（PgUp/PgDn/Home/End） | 20 min | 快捷键 |
| 5. 测试（resize、新消息、边界情况） | 30 min | 验证 |
| **总计** | **~2.5 小时** | |

---

## 两个功能的协作关系

### 独立开发

语法高亮和滚动功能**互不依赖**，可以独立开发、独立测试。

| 功能 | 依赖 | 影响范围 |
|------|------|----------|
| 语法高亮 | 新文件 `highlighter.ts` + 修改 `components.tsx` | 只影响代码块渲染 |
| 虚拟滚动 | 修改 `components.tsx` + `app.tsx` | 影响消息列表渲染和输入处理 |

### 合并后的组件树

```
<App>
├── top bar (更新快捷键提示)
├── messages area (flexGrow=1)
│   └── <MessageList>           ← 重构：不再是 Static，条件渲染
│       ├── scrollOffset        ← 父组件传入
│       ├── autoScroll           ← 父组件传入
│       └── <MessageBubble>     ← 不变
│           └── <MarkdownContent>
│               ├── <Text> bold/code/italic/header
│               └── <HighlightedCode>  ← 新增：异步语法高亮
├── thinking indicator
├── divider
└── input bar
```

---

## 实施路线图

### 推荐次序

```
第一优先：虚拟滚动
  理由：当前无法查看超过一屏的历史消息，属于功能性缺陷
  工时：~2.5 小时

第二优先：语法高亮
  理由：体验优化，不影响核心功能
  工时：~2 小时
```

### 验收标准

**虚拟滚动验收清单**：
- [ ] 终端只能显示部分消息时，自动显示最新消息
- [ ] PageUp 向上翻一页
- [ ] PageDown 向下翻一页
- [ ] Home 跳转到最早消息
- [ ] End 跳转到最新消息
- [ ] 新消息到达时，如果在底部则自动滚动
- [ ] 新消息到达时，如果已向上翻页则不跳转
- [ ] 终端调整大小时正常显示
- [ ] `/clear` 后重置滚动状态

**语法高亮验收清单**：
- [ ] TypeScript 关键字（`const`、`let`、`function`）带颜色
- [ ] Python 代码块正确高亮
- [ ] bash 脚本正确高亮
- [ ] 代码块不指定语言时回退到绿色文本
- [ ] 首次渲染先显示绿色文本，高亮完成后替换（无闪白）
- [ ] 多次高亮相同代码命中缓存（无重复计算）
- [ ] 高亮器初始化失败时永久回退

---

*本文档供 WorkBuddy TUI 功能增强参考，开发完成后需更新 TUI_ARCHITECTURE.md 和 TUI_COMPONENT_API.md。*
