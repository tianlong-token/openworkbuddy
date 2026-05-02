# Phase 3 收尾任务技术文档

> 角色：组员（实施） → 组长（检查）  
> 日期：2026-05-02  
> 优先级：高（发布前最后任务）

---

## 任务概览

| 任务 | 优先级 | 估计时间 | 状态 |
|------|--------|----------|------|
| 记录 N1 测试结果 | 低 | 5 分钟 | 待执行 |
| 修复 N2 `--timeout` 未使用 | 高 | 10 分钟 | 待执行 |
| N3 单元测试 | 高 | 20 分钟 | 待执行 |
| 最终集成验证 | 高 | 10 分钟 | 待执行 |

---

## 任务 1：记录 N1 测试结果

### 背景

M1 任务已删除 proxy-box 编译代码（`index.js`、`ecosystem.config.js`），导致 5/6 测试因依赖缺失而失败。这是预期行为，需要记录到决策文档中。

### 执行步骤

1. 打开 `docs/development/PROXY-BOX-DECISION.md`
2. 在文档末尾添加以下内容：

```markdown
## N1: proxy-box 测试结果（2026-05-02）

### 测试执行结果
| 测试文件 | 结果 | 原因 |
|----------|------|------|
| validate-session-id.spec.ts | ✅ 通过 | 纯函数，无外部依赖 |
| session-router.spec.ts | ❌ 失败 | 依赖 `../../const/env`（已删除） |
| idle-gate-session.spec.ts | ❌ 失败 | 依赖 `../../service/idle-gate`（已删除） |
| env-multi-session.spec.ts | ❌ 失败 | 依赖 `../../const/env`（已删除） |
| dynamic-session-facade.spec.ts | ❌ 失败 | 依赖 `../../service/multi-session/session-facade`（已删除） |
| bound-session-handle.spec.ts | ❌ 失败 | 依赖 `../../service/multi-session/session-router-protocol`（已删除） |

### 结论
- 5/6 测试失败是预期行为（M1 任务已删除 proxy-box 编译代码）
- 仅 `validate-session-id.spec.ts` 可独立运行（纯函数测试）
- 其他测试文件依赖已删除的服务模块，不再适用于当前版本
```

---

## 任务 2：修复 N2 `--timeout` 未使用

### 问题

`cli.ts` 第 29-30 行已解析 `--timeout` 参数：
```typescript
else if (arg.startsWith('--timeout=')) flags.timeout = parseInt(arg.split('=')[1], 10);
```

但第 114 行创建 runtime 时未使用该参数：
```typescript
const runtime = new WorkBuddyRuntime(timeout ? undefined : undefined);
```

### 修改方案

#### 步骤 1：检查 `runtime/src/types.ts`

查找 `WorkBuddyConfig` 接口，添加 timeout 字段：

```typescript
export interface WorkBuddyConfig {
  // ... 现有字段
  timeout?: number;  // 全局超时（毫秒）
}
```

#### 步骤 2：检查 `runtime/src/index.ts`

在 `WorkBuddyRuntime` 类中，检查构造函数或 `initialize()` 方法是否使用 config.timeout。

如果未使用，需要添加 timeout 处理逻辑。例如：

```typescript
// 在 initialize() 或 runSkill() 中添加
if (this.config.timeout) {
  // 设置全局超时或传递给 agent loop
}
```

#### 步骤 3：修改 `runtime/src/cli.ts`

将第 114 行：
```typescript
const runtime = new WorkBuddyRuntime(timeout ? undefined : undefined);
```

改为：
```typescript
const runtime = new WorkBuddyRuntime();
await runtime.initialize();
if (timeout) {
  runtime.setConfig({ ...runtime.getConfig(), timeout });
}
```

**或者** 如果 `WorkBuddyRuntime` 构造函数接受配置对象：

```typescript
const runtime = new WorkBuddyRuntime(timeout ? { timeout } : undefined);
```

### 注意事项

1. 必须先检查 `WorkBuddyRuntime` 的实际构造函数签名
2. 不要假设接口，以实际代码为准
3. 如果 `setConfig()` 不存在，需要直接在初始化时传入

---

## 任务 3：N3 单元测试

### 需要创建的文件

`runtime/src/test/skill-script-runner.spec.ts`

### 测试用例清单

| 序号 | 测试名称 | 测试内容 | 预期结果 |
|------|----------|----------|----------|
| 1 | `listScripts - 无 scripts 目录` | 技能没有 scripts/ 目录 | 返回空数组 `[]` |
| 2 | `listScripts - 有脚本文件` | 技能有 scripts/ 目录和 .js/.sh 文件 | 返回文件名列表 |
| 3 | `executeScript - 脚本不存在` | 执行不存在的脚本 | `{ success: false, error: "Script 'xxx' not found..." }` |
| 4 | `executeScript - 成功执行` | 执行一个返回 0 的简单脚本 | `{ success: true, output: "..." }` |
| 5 | `executeScript - 超时` | 执行无限等待的脚本 | `{ success: false, error: "Script timed out after 30000ms" }` |
| 6 | `executeScript - 执行错误` | 执行 `exit 1` 或语法错误的脚本 | `{ success: false, error: "..." }` |

### 完整测试代码

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DefaultSkillScriptRunner } from '../skill-script-runner';
import { Skill } from '../types';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = path.join(__dirname, 'test-scripts-tmp');

function createMockSkill(hasScripts: boolean = false): Skill {
  return {
    slug: 'test-skill',
    directory: TEST_DIR,
    frontmatter: { name: 'Test Skill', version: '0.1.0', description: 'Test' },
    hasScripts,
    hasReferences: false,
    hasAssets: false,
    hasTemplates: false,
    content: '',
    metadata: {},
  } as unknown as Skill;
}

describe('SkillScriptRunner', () => {
  let runner: DefaultSkillScriptRunner;

  beforeEach(() => {
    runner = new DefaultSkillScriptRunner();
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('returns empty list when no scripts directory', () => {
    const skill = createMockSkill(false);
    const scripts = runner.listScripts(skill);
    expect(scripts).toEqual([]);
  });

  it('lists script files in scripts directory', () => {
    const skill = createMockSkill(true);
    const scriptsDir = path.join(TEST_DIR, 'scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.writeFileSync(path.join(scriptsDir, 'hello.js'), '');
    fs.writeFileSync(path.join(scriptsDir, 'world.sh'), '');

    const scripts = runner.listScripts(skill);
    expect(scripts).toContain('hello.js');
    expect(scripts).toContain('world.sh');
  });

  it('returns error when script not found', async () => {
    const skill = createMockSkill(true);
    const scriptsDir = path.join(TEST_DIR, 'scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });

    const result = await runner.executeScript(skill, 'nonexistent.js');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('executes a simple script successfully', async () => {
    const skill = createMockSkill(true);
    const scriptsDir = path.join(TEST_DIR, 'scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.writeFileSync(
      path.join(scriptsDir, 'hello.js'),
      'console.log("Hello from script");'
    );

    const result = await runner.executeScript(skill, 'hello.js');
    expect(result.success).toBe(true);
    expect(result.output).toContain('Hello from script');
  });

  it('handles script timeout', async () => {
    const skill = createMockSkill(true);
    const scriptsDir = path.join(TEST_DIR, 'scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.writeFileSync(
      path.join(scriptsDir, 'slow.js'),
      'setTimeout(() => {}, 100000);'
    );

    const result = await runner.executeScript(skill, 'slow.js');
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  }, 35000);

  it('handles script execution error', async () => {
    const skill = createMockSkill(true);
    const scriptsDir = path.join(TEST_DIR, 'scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.writeFileSync(
      path.join(scriptsDir, 'fail.js'),
      'process.exit(1);'
    );

    const result = await runner.executeScript(skill, 'fail.js');
    expect(result.success).toBe(false);
  });
});
```

### 注意事项

1. **超时测试**：需要设置 `35000ms` 的测试超时（默认 5000ms 不够）
2. **临时目录**：使用 `test-scripts-tmp` 避免与其他测试冲突
3. **清理文件**：每个测试前后都要清理临时文件
4. **Windows 兼容**：脚本路径使用 `path.join()`，不要硬编码 `/` 或 `\`

---

## 任务 4：最终集成验证

### 执行步骤

#### 1. 编译验证

```bash
cd runtime
npm run build
```

预期：0 错误

#### 2. 单元测试验证

```bash
npx vitest run
```

预期：53+ tests passed（原有 48 + N3 新增 5-6 个）

#### 3. CLI 手动测试

```bash
cd runtime

# 测试 list
node dist/cli.js list

# 测试 search
node dist/cli.js search research

# 测试 info
node dist/cli.js info deep-research

# 测试 config
node dist/cli.js config

# 测试 run（无 LLM）
node dist/cli.js run deep-research
```

#### 4. 验证 timeout 参数

```bash
# 测试 --timeout 参数是否被正确解析
node dist/cli.js run --timeout=5000 deep-research
```

---

## 完成后汇报格式

在 `docs/development/TASK-ASSIGNMENT.md` 底部添加：

```markdown
---

## 汇报 - 2026-05-02 组员（Phase 3 收尾）

### 完成
- N1: 记录 proxy-box 测试结果到 PROXY-BOX-DECISION.md
- N2: 修复 --timeout 参数未使用的问题
- N3: 新增 skill-script-runner.spec.ts（X 个测试用例）

### 验证
- 编译: ✅ 零 TypeScript 错误
- 测试: ✅ X/X tests passed（含 N3 新增测试）
- CLI: ✅ --timeout 参数正常工作
```

---

## ⚠️ 重要提醒

1. **不要修改组长负责的文件：** `PROXY-BOX-DECISION.md`（只可追加）、`RELEASE-CHECKLIST.md`
2. **N3 测试文件必须是新文件：** 不要修改现有测试文件
3. **所有测试必须独立：** 每个测试前后都要清理临时文件
4. **Windows 兼容性：** 注意路径分隔符和命令兼容性
5. **编辑前阅读文件：** 使用 Read 工具确认文件内容后再修改

---

**完成后通知组长检查。**
