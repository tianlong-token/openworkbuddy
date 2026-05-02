# WorkBuddy TUI 架构设计文档

> Version: 1.0 | Last Updated: 2026-05-02 | Maintainer: WorkBuddy Contributors

---

## 一、概述

TUI（Terminal User Interface）模块基于 **Ink**（React for CLI）构建，是 WorkBuddy 的终端交互界面。负责：
- 渲染对话消息（用户 + Agent）
- 接收用户输入（含 Emacs 风格快捷键）
- 调用 Runtime 执行技能
- 展示思考状态（Spinner 动画）

---

## 二、目录结构

```
runtime/src/tui/
├── index.ts          # 入口：渲染 React 应用，阻塞至退出
├── app.tsx           # 主组件：状态管理 + 输入处理 + UI 布局
├── components.tsx    # 子组件：Markdown 渲染器 + 消息气泡 + 消息列表
└── docs/            # 技术文档（本目录）
    ├── TUI_ARCHITECTURE.md   # 本文
    ├── TUI_COMPONENT_API.md  # 组件 API 文档
    └── TUI_TYPES.md         # 类型定义文档
```

---

## 三、组件树

```
<App>                              # 主组件（app.tsx）
├── <Box> top bar                 # 顶部状态栏
│   ├── "WorkBuddy TUI"         # 应用标识
│   ├── skillName                # 当前技能名
│   └── 快捷键提示              # Ctrl+A / Ctrl+E / ↑↓ / Ctrl+C
├── <Box> messages area          # 消息区域（flexGrow=1）
│   └── <MessageList>           # 消息列表（Ink Static 高性能渲染）
│       └── <MessageBubble>     # 单条消息气泡
│           └── <MarkdownContent> # Markdown 渲染器
│               ├── <Text> bold   # 粗体
│               ├── <Text> code   # 行内代码（黄色）
│               ├── <Text> italic # 斜体（青色，终端不支持真正斜体）
│               ├── <Text> header # 标题（粗体+青色）
│               ├── <Box> code block (yellow border)  # 代码块
│               └── <Text> list bullet  # 列表项（• 符号）
├── <Box> thinking indicator     # 思考状态（Spinner 动画）
├── <Text> divider              # 分隔线（自适应终端宽度）
└── <Box> input bar            # 输入栏（含光标模拟）
    ├── "λ"                     # 输入提示符（绿色）
    └── 输入文本 + 光标        # 反色块模拟光标
```

---

## 四、状态管理设计

### 4.1 `App` 组件状态

| 状态 | 类型 | 用途 | 初始化 |
|------|------|------|----------|
| `messages` | `ChatMessage[]` | 对话历史 | `[]` |
| `input` | `string` | 当前输入内容 | `''` |
| `cursorPos` | `number` | 模拟光标位置 | `0` |
| `isLoading` | `boolean` | 是否等待 Agent 回复 | `false` |
| `thinkingText` | `string` | Spinner 动画帧文本 | `''` |
| `history` | `string[]` | 输入历史记录 | `[]` |
| `historyIndex` | `number` | 历史浏览位置（-1=最新） | `-1` |

### 4.2 状态更新流程

```
用户输入 → Enter 键
    → setMessages([...prev, {role:'user', content: msg, timestamp}])
    → setIsLoading(true)
    → runtime.runSkill(skillName, msg)   // 异步调用 Runtime
    → setMessages([...prev, {role:'assistant', content: output, timestamp}])
    → setIsLoading(false)
```

### 4.3 `useRef` 的使用

| Ref | 用途 |
|-----|------|
| `skillRef` | 缓存 `runtime.getSkill(skillName)`，避免重复调用 |
| `inputRef` | 在 `useInput` 回调中访问最新 `input`（绕过闭包陷阱） |

> **设计决策**：`useInput` 的回调在每次按键时执行，但闭包捕获的是**上一次渲染的 state**。用 `useRef` 同步最新值，回调中通过 `inputRef.current` 读取。

---

## 五、关键决策记录（ADR）

### ADR-001：为什么选 Ink 而不是其他 TUI 框架？

**决策**：使用 Ink（React for CLI）

**考虑过的替代方案**：
- **blessed** — 命令式 API，无 React 生态
- **urwid**（Python）— 语言不匹配
- **tui-rs**（Rust）— 需要重写整个 Runtime

**原因**：
1. Runtime 已是 TypeScript/React 技术栈，Ink 无缝集成
2. 组件化开发，UI 可复用、可测试
3. 社区活跃，VS Code CLI、Gatsby、Yarn 都在用

### ADR-002：为什么用 `Static` 渲染消息列表？

**决策**：`MessageList` 使用 Ink 的 `Static` 组件

**原因**：
- 普通 `Box` + `map()` 会在每次新消息时**重新渲染所有消息**
- `Static` 只渲染**新增项**，已渲染的项被冻结（frozen）
- 长对话下性能差异明显（100 条消息：普通渲染 ~200ms，Static ~5ms）

**代价**：
- `Static` 的项必须是**追加式**（不能在中间插入）
- Key 必须稳定（不能用数组 index 作为唯一 key）

### ADR-003：为什么光标用「反色块」模拟？

**决策**：用 `<Text inverse>` 渲染一个字符，模拟终端光标

**原因**：
- Ink 不支持真正的光标（终端光标被 Ink 自身占用）
- 反色块（`inverse`）是各终端兼容的最好方案
- 光标在末尾时显示反色空格（`' '`）

**已知限制**：
- 光标宽度固定 1 个字符（双宽字符如中文会错位）
- 没有光标闪烁（Ink 不支持动画样式）

### ADR-004：为什么 Spinner 帧提到模块级别？

**决策**：`SPINNER_FRAMES` 是模块级常量，不在组件内部定义

**原因**：
- 组件每次渲染都会重新创建内部变量
- `useEffect` 依赖 `isLoading`，每次变化都会创建新数组
- 提到模块级别避免不必要的内存分配

---

## 六、数据流

### 6.1 用户发送消息

```
[User presses Enter]
    │
    ▼
[useInput callback]
    │  key.return === true
    │  inputRef.current.trim() !== ''
    │
    ▼
[sendMessage(msg)]
    │
    ├── setMessages(prev => [...prev, {role:'user', content: msg, timestamp: Date.now()}])
    ├── setIsLoading(true)
    │
    │   (async)
    ▼
[runtime.runSkill(skillName, msg)]
    │  调用 Runtime Agent Loop
    │  可能执行多轮 tool call
    │
    ▼
[setMessages(prev => [...prev, {role:'assistant', content: output, timestamp: Date.now()})]
    │
    ▼
[setIsLoading(false)]
```

### 6.2 Markdown 渲染流程

```
MarkdownContent({ content })
    │
    ├── 用 codeBlockRegex 分离代码块和文本
    │
    ├── 代码块 → renderCodeBlock(content, lang)
    │   └── <Box borderStyle="round" borderColor="yellow">
    │       ├── <Text dimColor>{lang}</Text>
    │       └── <Text color="green">{line}</Text>  (每行)
    │
    └── 文本 → 按行分割 → parseInlineMarkdown(line)
        └── 正则匹配：
            ├── match[1] → **bold**  → type: 'bold'
            ├── match[3] → `code`    → type: 'code'
            └── match[4] → *italic*   → type: 'italic'
                │
                ▼
            renderInlineSegments(segments)
                ├── 'bold'   → <Text bold>
                ├── 'code'   → <Text color="yellow">
                ├── 'italic' → <Text color="cyan">  (终端不支持真正斜体，用颜色替代)
                └── 'header' → <Text bold color="cyan">
```

---

## 七、快捷键系统

### 7.1 Emacs 风格快捷键

| 快捷键 | 功能 | 实现位置 |
|--------|------|------------|
| `Ctrl+A` | 光标跳到行首（Home） | app.tsx:95 |
| `Ctrl+E` | 光标跳到行尾（End） | app.tsx:101 |
| `Ctrl+W` | 删除光标前的一个单词 | app.tsx:107 |
| `Ctrl+K` | 删除光标到行尾 | app.tsx:119 |
| `Ctrl+C` | 退出应用 | app.tsx:72 |

### 7.2 方向键

| 键 | 功能 | 实现位置 |
|----|------|------------|
| `Left Arrow` | 光标左移 | app.tsx:135 |
| `Right Arrow` | 光标右移 | app.tsx:139 |
| `Up Arrow` | 浏览历史（更早） | app.tsx:143 |
| `Down Arrow` | 浏览历史（更新的） | app.tsx:143 |

### 7.3 斜杠命令

| 命令 | 功能 |
|------|------|
| `/exit` 或 `/quit` | 退出 TUI |
| `/clear` | 清空对话 + 重置 AgentLoop |
| `/help` | 显示可用命令列表 |

---

## 八、构建与集成

### 8.1 TypeScript 编译

```bash
# tsconfig.json 关键配置
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "outDir": "./dist"
  }
}
```

> **注意**：`app.tsx` 导入 `components.js`（而非 `components.tsx`），这是 TypeScript ESM 规范的要求——导入时写 `.js` 后缀，编译器会解析到 `.ts/.tsx` 源文件。

### 8.2 被 Runtime 调用

```typescript
// runtime/src/index.ts
import { runTUI } from './tui/index.js';

// 当 CLI 传入 --tui 标志时
if (options.tui) {
  await runTUI({ runtime: this, skillName });
}
```

`runTUI()` 调用 `ink.render()`，阻塞当前线程直到用户退出（Ctrl+C 或 `/exit`）。

---

## 九、限制与已知问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 中文光标错位 | 双宽字符算 1 个光标位置 | 用 `stringWidth()` 计算显示宽度（未实现） |
| 无滚动 | `Static` 不支持滚动 | 用 `useStdoutDimensions` 手动实现虚拟滚动（待开发） |
| 代码块无语法高亮 | Ink 的 `Text` 不支持 | 引入 `shiki` 或手动关键词着色（待开发） |
| 标题内 Markdown 不解析 | `parseInlineMarkdown` 在标题分支直接返回 | 应先解析再返回（待修复） |

---

## 十、扩展指南

### 10.1 添加新快捷键

1. 在 `app.tsx` 的 `useInput` 回调中添加新的 `if (key.ctrl && char === 'x')` 分支
2. 更新顶部状态栏的快捷键提示
3. 更新 `/help` 命令的说明文字

### 10.2 添加新 Markdown 语法支持

1. 在 `components.tsx` 的 `MarkdownSegment` 类型中加入新类型
2. 在 `parseInlineMarkdown` 的正则中加入新语法的匹配
3. 在 `renderInlineSegments` 中加入新类型的渲染逻辑

### 10.3 添加新的消息类型

1. 在 `ChatMessage.role` 中加入新类型
2. 在 `MessageBubble` 中加入新类型的渲染分支
3. 考虑是否需要新的时间戳、头像、颜色等

---

*本文档由 WorkBuddy 在 Craft 模式下自动生成，最后更新于 2026-05-02。*
