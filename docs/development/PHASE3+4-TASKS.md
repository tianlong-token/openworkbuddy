# Phase 3+4 组员执行任务清单

> 角色：组员（实施） → 组长（审查）  
> 日期：2026-05-02  
> 目标：v0.1.0 发布准备

---

## 优先级排序

| 优先级 | 任务 | 原因 |
|--------|------|------|
| P0 | N1 记录 proxy-box 结果 | 关闭当前任务 |
| P0 | N2 修复 --timeout | CLI 功能不完整 |
| P0 | N3 skill-script-runner 单元测试 | 新代码无测试覆盖 |
| P0 | N3 修复命令注入漏洞 | 安全问题，必须修 |
| P0 | N2 实现 timeout 实际逻辑 | 解析了但没执行 |
| P1 | .gitignore | 初始化仓库必须 |
| P1 | LICENSE | 开源项目必须 |
| P1 | .env.example | 新手体验 |
| P1 | .env 自动加载 | 新手体验 |
| P2 | 一键启动脚本 | 便利性 |
| P2 | 技能 prompt 清理 | 品牌一致性 |
| 暂缓 | GitHub Actions CI | v0.2.0 |
| 暂缓 | E2E 测试 | v0.2.0 |

---

## P0 任务（必须完成）

### 任务 N1：记录 proxy-box 测试结果

**文件**: `docs/development/PROXY-BOX-DECISION.md`（追加到末尾）

**内容**:
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
- 仅 `validate-session-id.spec.ts` 可独立运行
- 其他测试依赖已删除的服务模块，不再适用于当前版本
```

---

### 任务 N2：修复 --timeout 参数（两步）

#### 步骤 1：在 `runtime/src/types.ts` 添加 timeout 字段

找到 `RuntimeConfig` 接口，添加：
```typescript
timeout?: number;  // 全局超时（毫秒）
```

#### 步骤 2：在 `runtime/src/index.ts` 的 `runSkill()` 中实现超时逻辑

找到 `runSkill()` 方法（第 115 行），将 try 块改为：

```typescript
try {
  const promise = this.agentLoop.run(systemPrompt, userMsg);
  const timeoutMs = this.config.timeout || 120000; // 默认 2 分钟

  const result: AgentLoopResult = await Promise.race([
    promise,
    new Promise<AgentLoopResult>((_, reject) =>
      setTimeout(() => reject(new Error(`Skill execution timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);

  if (result.success) {
    return result.output;
  } else {
    return `Error running skill: ${result.error || 'Unknown error'}\n\nPartial output:\n${result.output}`;
  }
} catch (e: any) {
  return `Fatal error running skill: ${e.message}`;
}
```

#### 步骤 3：修改 `runtime/src/cli.ts` 传参

找到第 114 行：
```typescript
const runtime = new WorkBuddyRuntime(timeout ? undefined : undefined);
```

改为：
```typescript
const runtime = new WorkBuddyRuntime(timeout ? { timeout } : undefined);
```

**验证**: 编译通过后，运行 `node dist/cli.js run --timeout=5000 deep-research` 应在 5 秒后超时。

---

### 任务 N3：skill-script-runner 单元测试 + 安全修复

#### 步骤 1：修复命令注入漏洞

**文件**: `runtime/src/skill-script-runner.ts`

**问题**: 第 68 行 `args.map(a => `\"${a}\"`)` 允许通过 `"` 或 `` ` `` 逃逸执行任意命令。

**修复**: 将 `exec()` 改为 `spawn()`，参数通过数组传递（自动转义）：

```typescript
// 替换 execWithTimeout 方法：
private execWithTimeout(command: string, timeoutMs: number): Promise<ToolResult> {
  return new Promise((resolve) => {
    // 解析命令和参数
    const parts = command.split(' ').filter(Boolean);
    const cmd = parts[0];
    const args = parts.slice(1).map(a => a.replace(/"/g, '')); // 去除引号

    const proc = spawn(cmd, args, {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('close', (code: number | null) => {
      let output = stdout;
      if (stderr) output += `\n[stderr]\n${stderr}`;

      if (code === null || code > 0) {
        resolve({ success: false, output, error: stderr || `Exit code: ${code}` });
      } else {
        resolve({ success: true, output });
      }
    });

    proc.on('error', (err: Error) => {
      resolve({ success: false, output: '', error: err.message });
    });
  });
}
```

同时在文件顶部添加导入：
```typescript
import { spawn, SpawnOptions } from 'child_process';
```

#### 步骤 2：创建测试文件

**文件**: `runtime/src/test/skill-script-runner.spec.ts`（新建）

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
    expect(runner.listScripts(skill)).toEqual([]);
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
    fs.writeFileSync(path.join(scriptsDir, 'hello.js'), 'console.log("Hello from script");');

    const result = await runner.executeScript(skill, 'hello.js');
    expect(result.success).toBe(true);
    expect(result.output).toContain('Hello from script');
  });

  it('handles script timeout', async () => {
    const skill = createMockSkill(true);
    const scriptsDir = path.join(TEST_DIR, 'scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.writeFileSync(path.join(scriptsDir, 'slow.js'), 'setTimeout(() => {}, 100000);');

    const result = await runner.executeScript(skill, 'slow.js');
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  }, 35000);

  it('handles script execution error', async () => {
    const skill = createMockSkill(true);
    const scriptsDir = path.join(TEST_DIR, 'scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.writeFileSync(path.join(scriptsDir, 'fail.js'), 'process.exit(1);');

    const result = await runner.executeScript(skill, 'fail.js');
    expect(result.success).toBe(false);
  });
});
```

---

### 任务 P1-1：创建 `.gitignore`

**文件**: 项目根目录 `.gitignore`（新建）

```
# Dependencies
node_modules/

# Build output
dist/

# Environment
.env
.env.local

# Logs
*.log

# OS
.DS_Store
Thumbs.db

# Test temp directories
test-tmp-*
test-mem-tmp-*
test-scripts-tmp*

# IDE
.vscode/
.idea/
*.swp
```

---

### 任务 P1-2：创建 `LICENSE`

**文件**: 项目根目录 `LICENSE`（新建）

```
MIT License

Copyright (c) 2026 WorkBuddy Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

### 任务 P1-3：创建 `.env.example`

**文件**: 项目根目录 `.env.example`（新建）

```
# LLM 配置（二选一）

# 选项 A：DeepSeek
WORKBUDDY_LLM_API_URL=https://api.deepseek.com/v1/chat/completions
WORKBUDDY_LLM_API_KEY=sk-your-key-here
WORKBUDDY_LLM_MODEL=deepseek-chat

# 选项 B：OpenAI
# WORKBUDDY_LLM_API_URL=https://api.openai.com/v1/chat/completions
# WORKBUDDY_LLM_API_KEY=sk-your-key-here
# WORKBUDDY_LLM_MODEL=gpt-4o

# 可选配置
# WORKBUDDY_SKILLS_DIR=./skills
# WORKBUDDY_MEMORY_STORE=memory
# WORKBUDDY_TIMEOUT=120000
```

---

### 任务 P1-4：CLI 支持 `.env` 自动加载

**文件**: `runtime/src/config.ts`

**在 `loadConfig()` 函数开头添加**:

```typescript
// 尝试加载项目根目录的 .env 文件
function tryLoadEnvFile(): void {
  const possiblePaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '..', '.env'),
  ];

  for (const envPath of possiblePaths) {
    try {
      if (existsSync(envPath)) {
        const content = readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
              const key = trimmed.substring(0, eqIndex).trim();
              const value = trimmed.substring(eqIndex + 1).trim();
              // 只设置未存在的环境变量（不覆盖已设置的）
              if (!process.env[key]) {
                process.env[key] = value;
              }
            }
          }
        }
        return; // 找到并加载后退出
      }
    } catch {
      // 忽略读取错误
    }
  }
}
```

在 `loadConfig()` 开头调用：
```typescript
export function loadConfig(overrides?: Partial<RuntimeConfig>): RuntimeConfig {
  tryLoadEnvFile();  // 添加这一行
  // ... 现有代码
}
```

确保文件顶部有必要的导入：
```typescript
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
```

---

### 任务 P2-1：一键启动脚本

**文件**: 项目根目录 `start.bat`（新建）

```batch
@echo off
echo ========================================
echo   WorkBuddy - Open-source AI Assistant
echo ========================================
echo.

if not exist .env (
    echo [!] 未找到 .env 文件
    echo [!] 请先复制 .env.example 为 .env 并填入 API Key
    echo.
    echo 按任意键退出...
    pause > nul
    exit /b 1
)

echo [+] 安装依赖...
call npm install

echo [+] 构建项目...
call npm run build
if %errorlevel% neq 0 (
    echo [!] 构建失败
    pause
    exit /b 1
)

echo [+] 加载技能...
node runtime\dist\cli.js list

echo.
echo ========================================
echo   构建完成！使用以下命令开始：
echo   node runtime\dist\cli.js list
echo   node runtime\dist\cli.js search ^<query^>
echo   node runtime\dist\cli.js info ^<skill^>
echo   node runtime\dist\cli.js chat ^<skill^>
echo   node runtime\dist\cli.js run ^<skill^> [message]
echo ========================================
```

**文件**: 项目根目录 `start.sh`（新建，macOS/Linux）

```bash
#!/bin/bash
echo "========================================"
echo "  WorkBuddy - Open-source AI Assistant"
echo "========================================"
echo

if [ ! -f .env ]; then
    echo "[!] 未找到 .env 文件"
    echo "[!] 请先复制 .env.example 为 .env 并填入 API Key"
    exit 1
fi

echo "[+] 安装依赖..."
npm install

echo "[+] 构建项目..."
npm run build || { echo "[!] 构建失败"; exit 1; }

echo "[+] 加载技能..."
node runtime/dist/cli.js list

echo
echo "========================================"
echo "  构建完成！使用以下命令开始："
echo "  node runtime/dist/cli.js list"
echo "  node runtime/dist/cli.js search <query>"
echo "  node runtime/dist/cli.js info <skill>"
echo "  node runtime/dist/cli.js chat <skill>"
echo "  node runtime/dist/cli.js run <skill> [message]"
echo "========================================"
```

完成后运行 `chmod +x start.sh`。

---

### 任务 P2-2：技能 prompt 清理

**文件**: 项目根目录 `scripts/cleanup-skill-prompts.js`（新建）

```javascript
const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');
const replacements = [
  { from: /You are Claude/g, to: 'You are WorkBuddy' },
  { from: /你叫 Claude/g, to: '你叫 WorkBuddy' },
  { from: /你是一个 AI 助手/g, to: '你是 WorkBuddy，一个开源的 AI 助手' },
];

let count = 0;

function processDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const skillMd = path.join(fullPath, 'SKILL.md');
      if (fs.existsSync(skillMd)) {
        let content = fs.readFileSync(skillMd, 'utf-8');
        let modified = false;
        for (const { from, to } of replacements) {
          if (from.test(content)) {
            content = content.replace(from, to);
            modified = true;
          }
        }
        if (modified) {
          fs.writeFileSync(skillMd, content, 'utf-8');
          count++;
          console.log(`  ✓ ${entry.name}/SKILL.md`);
        }
      }
    }
  }
}

console.log('Cleaning skill prompts...');
processDir(SKILLS_DIR);
console.log(`Done! Modified ${count} files.`);
```

执行：`node scripts/cleanup-skill-prompts.js`

---

## 执行顺序

```
1. N1 (记录 proxy-box 结果)          ← 5 分钟
2. N2 (timeout 修复)                 ← 15 分钟
3. N3 (安全修复 + 单元测试)          ← 20 分钟
4. P1-1 (.gitignore)                 ← 2 分钟
5. P1-2 (LICENSE)                    ← 2 分钟
6. P1-3 (.env.example)               ← 2 分钟
7. P1-4 (.env 自动加载)              ← 10 分钟
8. P2-1 (启动脚本)                   ← 5 分钟
9. P2-2 (prompt 清理)                ← 5 分钟
                                    ───────
                              总计约 66 分钟
```

---

## 完成后验证

```bash
# 1. 编译
cd runtime && npm run build

# 2. 测试（预期 54+ tests）
npx vitest run

# 3. CLI 测试
node dist/cli.js list
node dist/cli.js search research
node dist/cli.js config

# 4. 清理临时目录
cd .. && rm -rf runtime/src/test-mem-tmp-* runtime/src/test-scripts-tmp*
```

---

## 汇报格式

完成后在 `TASK-ASSIGNMENT.md` 底部追加：

```markdown
---

## 汇报 - 2026-05-02 组员（Phase 3+4 收尾）

### 完成
- N1: 记录 proxy-box 测试结果
- N2: 修复 --timeout 参数并实现超时逻辑
- N3: 修复命令注入漏洞 + 新增 skill-script-runner.spec.ts（6 个测试）
- P1-1: 创建 .gitignore
- P1-2: 创建 LICENSE（MIT）
- P1-3: 创建 .env.example
- P1-4: .env 自动加载
- P2-1: 一键启动脚本（start.bat + start.sh）
- P2-2: 技能 prompt 清理

### 验证
- 编译: ✅ 零 TypeScript 错误
- 测试: ✅ X/X tests passed
- CLI: ✅ 所有命令正常
```

---

*本文档由组长编写，组员执行完成后由组长审查。*
