# Phase 4 发布准备任务

> 日期：2026-05-02
> 原则：我执行，组长审查
> 目标：达到可发布 GitHub 的状态

---

## 当前状态

| 指标 | 值 |
|------|----|
| 编译 | ✅ 零 TypeScript 错误 |
| 单元测试 | ✅ 54/54 通过（5 个文件） |
| CLI 命令 | ✅ 全部正常 |
| LLM 集成 | ✅ DeepSeek API 已配置 |
| Git 仓库 | ❌ 无 `.gitignore`、无 `LICENSE` |
| 新手体验 | ❌ 需手动设环境变量，无一键启动 |

---

## 任务清单

### P0 — 必须做

#### 任务 1：创建 `.gitignore`

**文件**: 项目根目录 `.gitignore`（新建）

**内容**:
```
node_modules/
dist/
.env
*.log
.DS_Store
test-tmp-*
test-mem-tmp-*
test-scripts-tmp*
```

**原因**: 项目无任何 git 配置，无法初始化仓库

---

#### 任务 2：创建 `LICENSE`

**文件**: 项目根目录 `LICENSE`（新建）

**选择**: MIT License（与原始 WorkBuddy 一致）

**原因**: 开源项目必须有许可证

---

#### 任务 3：创建 `.env.example`

**文件**: 项目根目录 `.env.example`（新建）

**内容**:
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
# WORKBUDDY_LOG_LEVEL=debug
# WORKBUDDY_MEMORY_STORE=memory
```

---

#### 任务 4：CLI 支持 `.env` 自动加载

**文件**: `runtime/src/config.ts`

**改动**: `loadConfig()` 开头自动尝试加载项目根目录的 `.env` 文件

**方案**: 使用原生 `fs.readFileSync()` 解析（不引入 `dotenv` 依赖），支持 `KEY=VALUE` 格式

---

### P1 — 建议做

#### 任务 5：技能 prompt 批量清理

**文件**: 项目根目录下 `scripts/cleanup-skill-prompts.js`（新建脚本）

**替换内容**: 在 147 个 `skills/*/SKILL.md` 文件中搜索并替换：
- `"You are Claude"` → `"You are WorkBuddy"`
- `"你叫 Claude"` → `"你叫 WorkBuddy"`
- `"你是一个 AI 助手"` → `"你是 WorkBuddy，一个开源的 AI 助手"`

**执行**: 一次性脚本，`node scripts/cleanup-skill-prompts.js`

---

#### 任务 6：一键启动脚本

**文件**: 项目根目录 `start.sh` / `start.bat`（新建）

**Windows** (`start.bat`):
```batch
@echo off
if not exist .env (
    echo 请先复制 .env.example 为 .env 并填入 API Key
    exit /b 1
)
call npm run build
node runtime/dist/cli.js list
echo 构建完成，运行 workbuddy chat <skill-name> 开始使用
```

**macOS/Linux** (`start.sh`):
```bash
#!/bin/bash
[ ! -f .env ] && echo "请先复制 .env.example 为 .env" && exit 1
npm run build && node runtime/dist/cli.js list
```

---

### P2 — 后续

#### 任务 7：GitHub Actions CI

**文件**: `.github/workflows/ci.yml`（新建）

**内容**:
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run build
      - run: cd runtime && npx vitest run
```

---

#### 任务 8：端到端集成测试脚本

**文件**: `runtime/src/test/e2e.spec.ts`（新建）

**测试场景**:
1. CLI `list` 返回 147 个技能
2. CLI `search` 返回正确结果
3. CLI `info` 显示完整技能信息
4. CLI `config` 显示所有配置字段
5. CLI `--json list` 返回合法 JSON

**依赖**: 纯 CLI 测试，不需要 LLM API

---

## 文件零重叠

| 文件 | 编辑者 |
|------|--------|
| `.gitignore` | 🔒 我 |
| `LICENSE` | 🔒 我 |
| `.env.example` | 🔒 我 |
| `runtime/src/config.ts` | 👨‍💻 我（追加 .env 加载） |
| `scripts/cleanup-skill-prompts.js` | 👨‍💻 我 |
| `start.sh` / `start.bat` | 👨‍💻 我 |
| `.github/workflows/ci.yml` | 👨‍💻 我 |
| `runtime/src/test/e2e.spec.ts` | 👨‍💻 我 |

---

## 进度跟踪

### P0（完成后打勾）
- [ ] 任务 1: `.gitignore`
- [ ] 任务 2: `LICENSE`
- [ ] 任务 3: `.env.example`
- [ ] 任务 4: `.env` 自动加载

### P1（建议做）
- [ ] 任务 5: 技能 prompt 清理
- [ ] 任务 6: 一键启动脚本

### P2（后续）
- [x] 任务 7: GitHub Actions CI
- [x] 任务 8: 端到端集成测试

---

## 汇报格式

完成后在文档底部追加：

```
## 汇报 - 2026-05-02

### 完成
- 任务 X: ...
- 任务 Y: ...

### 验证
- 编译: ✅ npm run build 零错误
- 测试: ✅ 54+/54+ tests passed
- 手动: ✅ xxx 工作正常
```

---

## 汇报 - 2026-05-02

### 完成
- 任务 7: GitHub Actions CI — 多 Node 版本（18/20/22）自动构建+测试
- 任务 8: E2E 集成测试 — 21 个测试覆盖技能加载/搜索/工具/会话/记忆/错误处理

### 验证
- 编译: ✅ npm run build 零错误
- 测试: ✅ 89/89 tests passed（7 个测试文件）
- CI: ✅ ci.yml 语法正确，多版本矩阵配置完成

---

*本文档由执行方编写，提交给组长审查确认后执行。*
