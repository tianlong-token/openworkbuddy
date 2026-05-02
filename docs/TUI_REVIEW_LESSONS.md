# TUI 虚拟滚动实现复盘：常见错误与最佳实践

> 用途：组员学习材料  
> 日期：2026-05-02  
> 关联文档：`docs/TUI_ENHANCEMENTS.md`、`docs/TUI_ARCHITECTURE.md`

---

## 一、这次出现的问题

### 问题 1：用了不存在的 API

**现象**：`app.tsx` 从 Ink 导入了 `useStdoutDimensions`，但 Ink 4.4.1 根本没有这个导出。

```tsx
// ❌ 错的
import { Box, Text, useInput, useApp, useStdoutDimensions } from 'ink';

// ✅ 对的
import { Box, Text, useInput, useApp, useStdout } from 'ink';
const { stdout } = useStdout();
const columns = stdout.columns || 80;
const rows = stdout.rows || 24;
```

**教训**：**不要相信文档或记忆，以实际安装的版本为准**。写代码前先确认依赖的真实 API：

```bash
# 确认版本
cat node_modules/ink/package.json | grep version

# 看实际有哪些导出
ls node_modules/ink/build/hooks/
ls node_modules/ink/build/

# 看类型定义
cat node_modules/ink/build/index.d.ts
```

`useStdoutDimensions` 是 Ink 5+ 才引入的。我们的项目用的是 Ink 4.4.1，没有这个 hook。原来的代码从未编译运行过（`src/tui/` 在 git 里是 untracked），所以这个错误一直没被发现。

---

### 问题 2：算法逻辑方向反了

**现象**：`calculateVisibleWindow` 从 `startIdx` 往后遍历，导致永远只显示 1 条消息。

```typescript
// ❌ 错的：从 startIdx 往前走，当 offset=0 时只显示最后一条
let startIdx = Math.max(0, messages.length - offset - 1);
for (let i = startIdx; i < messages.length; i++) {
  // 只遍历到 messages.length-1，即 startIdx 本身
}

// ✅ 对的：从 endIdx 往回走，填充可见区域
const endIdx = Math.max(0, messages.length - 1 - offset);
let startIdx = endIdx;
for (let i = endIdx; i >= 0; i--) {
  if (consumedLines + totalLines[i] > availableLines && i < endIdx) break;
  startIdx = i;
  consumedLines += totalLines[i];
}
return messages.slice(startIdx, endIdx + 1);
```

**教训**：**实现后做一次心算（trace）验证边界情况**。用具体数字走一遍：

```
场景：10 条消息，offset=0（显示最新），可用 10 行，每条估算 2 行

错误的算法：
  startIdx = 10 - 0 - 1 = 9
  循环 i=9...9：只显示 messages[9] = 1 条消息 ❌

正确的算法：
  endIdx = 10 - 1 - 0 = 9
  从 i=9 往回：9(2行),8(2行),7(2行),6(2行),5(2行) = 10 行
  slice(5, 10) = 5 条消息 ✅
```

---

### 问题 3：代码改了一半

**现象**：只改了 `components.tsx`，`app.tsx` 完全没动。`MessageList` 新增了 3 个 props，但调用处没传。TypeScript 如果能跑一次就能发现。

**教训**：**改完一个文件后，立即编译检查**。不需要等到"全部改完"。`npx tsc --noEmit` 只要几秒钟，能立刻发现类型错误、未定义的导入、参数不匹配。

---

## 二、虚拟滚动的核心思路

### 2.1 不是什么高深技术

虚拟滚动的本质就是一句话：**不渲染用户看不到的消息**。

```
终端可见区域 (比如 24 行)
├── 顶部栏 (3 行)
├── 消息区 (17 行)  ← 只渲染这里能放下的消息
│   ├── msg 5
│   ├── msg 6
│   ├── ...
│   └── msg 9
├── 分隔线 (1 行)
└── 输入栏 (3 行)
```

### 2.2 核心数据流

```
scrollOffset (用户滚动偏移)
     │
     ▼
calculateVisibleWindow(messages, offset, availableLines, width)
     │  1. 从 offset 确定 endIdx（最后可见消息）
     │  2. 从 endIdx 往回累加行数，直到撑满 availableLines
     │  3. 返回 messages[startIdx..endIdx]
     │
     ▼
MessageList 只渲染返回的消息切片
```

### 2.3 自动滚动的逻辑

```typescript
const [autoScroll, setAutoScroll] = useState(true);

// 用户手动滚动 → 取消自动滚动
onPageUp → setAutoScroll(false)

// 用户回到底部 → 恢复自动滚动
onPageDown → if (newOffset === 0) setAutoScroll(true)
onEnd     → setAutoScroll(true)

// 新消息到达 → 如果在底部就跟着滚
useEffect(() => {
  if (autoScroll) setScrollOffset(0);
}, [messages.length]);
```

---

## 三、良好的工作习惯清单

### 每次改代码前

- [ ] `git status` 确认当前状态
- [ ] 阅读相关文件的全部内容，不要只看改的那部分

### 每次改代码后

- [ ] `npx tsc --noEmit` 编译检查（几秒钟的事）
- [ ] 如果是算法逻辑，心算 trace 一遍边界情况（空数组、1 条、offset=0、offset=max）
- [ ] 检查所有调用处是否需要同步修改（改了 props 接口，所有传 props 的地方都要改）

### 关于依赖 API

- [ ] 不要凭记忆写 API，`cat node_modules/包名/build/` 看一眼
- [ ] 不确定的 API 先写个最小 demo 验证

---

## 四、补充：`useStdout` vs `useStdoutDimensions`

| API | Ink 4.x | Ink 5+ |
|-----|---------|--------|
| `useStdout()` | ✅ 有，返回 `{ stdout }` | ✅ 有 |
| `useStdoutDimensions()` | ❌ 没有 | ✅ 有 |

在 Ink 4.x 中获取终端尺寸：

```tsx
import { useStdout } from 'ink';

function MyComponent() {
  const { stdout } = useStdout();
  const columns = stdout.columns || 80;
  const rows = stdout.rows || 24;
  // ...
}
```

`stdout.columns` 和 `stdout.rows` 来自 `NodeJS.WriteStream`，是 Node.js 原生属性，所有终端都支持。

---

*本文档由组长编写，供团队学习参考。*
