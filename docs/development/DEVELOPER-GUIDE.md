# WorkBuddy 开发者指南

> 版本: v0.2.0-alpha | 更新: 2026-05-02

---

## 一、开发环境搭建

### 前置要求
- Node.js >= 18（推荐 22）
- npm >= 9
- Git

### 初始化
```bash
# 克隆项目
git clone <repo-url> workbuddy
cd workbuddy

# 安装依赖
npm install

# 首次构建
npm run build
```

### 配置
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env，填入 API Key（DeepSeek 或 OpenAI）
# WORKBUDDY_LLM_API_URL=https://api.deepseek.com/v1/chat/completions
# WORKBUDDY_LLM_API_KEY=sk-your-key-here
```

### 验证安装
```bash
node runtime/dist/cli.js list        # 应看到 148 个技能
node runtime/dist/cli.js config      # 应看到配置信息
```

---

## 二、项目结构

```
workbuddy/
├── runtime/                  # 核心运行时（主要开发目录）
│   ├── src/
│   │   ├── index.ts          # 主入口
│   │   ├── cli.ts            # CLI 命令
│   │   ├── config.ts         # 配置系统
│   │   ├── types.ts          # 类型定义
│   │   ├── agent-loop.ts     # Agent 循环
│   │   ├── skill-loader.ts   # 技能加载
│   │   ├── skill-script-runner.ts  # 脚本执行
│   │   ├── tool-router.ts    # 工具路由
│   │   ├── tool-executors.ts # 工具实现
│   │   ├── llm/              # LLM 集成
│   │   ├── memory/           # 记忆管理
│   │   ├── session/          # 会话管理
│   │   ├── orchestrator/     # 多智能体编排
│   │   └── test/             # 单元测试
│   └── vitest.config.ts      # 测试配置
├── skills/                   # 技能目录
│   └── <skill-name>/
│       └── SKILL.md          # 技能定义文件
├── docs/development/         # 开发文档
├── scripts/                  # 工具脚本
├── .env.example              # 环境变量模板
├── start.bat / start.sh      # 启动脚本
├── package.json              # 项目配置
└── tsconfig.json             # TypeScript 配置
```

---

## 三、如何添加新工具

### 步骤 1：实现执行器函数

编辑 `runtime/src/tool-executors.ts`：

```typescript
export const myExecutor: ToolExecutor = async (args: Record<string, unknown>): Promise<ToolResult> => {
  const input = args['input'] as string;
  if (!input) return { success: false, output: '', error: 'Missing input' };

  try {
    // 你的实现逻辑
    const result = doSomething(input);
    return { success: true, output: result };
  } catch (e: any) {
    return { success: false, output: '', error: e.message };
  }
};
```

### 步骤 2：注册到路由

在 `tool-router.ts` 的 `TOOL_SCHEMAS` 中添加 schema：

```typescript
const toolSchema: ToolSchema = {
  name: 'MyTool',
  description: '描述你的工具做什么',
  parameters: {
    input: {
      type: 'string',
      required: true,
      description: '输入参数说明',
    },
  },
};
```

在 `tool-executors.ts` 的 `registerAllTools()` 中注册：

```typescript
router.register('MyTool', myExecutor);
```

### 步骤 3：更新允许工具列表

在 `config.ts` 的 `DEFAULT_CONFIG.allowedTools` 中添加 `'MyTool'`。

### 步骤 4：编写测试

```typescript
// runtime/src/test/tool-executors.spec.ts 中追加
it('myTool should process input correctly', async () => {
  const result = await myExecutor({ input: 'test' });
  expect(result.success).toBe(true);
});
```

---

## 四、如何添加新技能

在 `skills/` 目录下创建新的子目录和 `SKILL.md` 文件：

```markdown
---
name: My Custom Skill
version: 1.0.0
description: 描述这个技能的功能
description_zh: 中文描述
allowed-tools: Read, Write, Bash, WebSearch
metadata:
  category: development
  tags: [custom, example]
  quality: alpha
---

# My Custom Skill

你是 My Custom Skill，一个专门处理 XX 任务的 AI 助手。

## 核心能力
1. 能力一描述
2. 能力二描述

## 工作流程
1. 第一步：读取输入
2. 第二步：处理数据
3. 第三步：返回结果
```

### 技能可选目录
```
skills/my-skill/
├── SKILL.md              # 必填：技能定义
├── scripts/              # 可选：可执行脚本
│   ├── setup.js
│   └── analyze.sh
├── references/           # 可选：参考文档
│   └── spec.pdf
├── assets/               # 可选：资源文件
│   └── logo.png
└── templates/            # 可选：模板文件
    └── report.md
```

---

## 五、如何运行测试

```bash
# 运行全部测试
cd runtime && npx vitest run

# 运行单个测试文件
npx vitest run src/test/agent-loop.spec.ts

# 带覆盖率
npx vitest run --coverage

# 观察模式（开发时）
npx vitest
```

---

## 六、开发规范

### 编码规范
- **语言**: TypeScript，严格模式 (`strict: true`)
- **命名**: camelCase（变量/函数）、PascalCase（类/接口）、UPPER_CASE（常量）
- **错误处理**: 所有异步操作必须有 try/catch 或 .catch()
- **导入顺序**: 内置模块 → 第三方 → 项目内部

### 文件规范
- 一个文件一个主要功能
- 测试文件命名：`<module>.spec.ts`
- 模块目录命名：小写加连字符 (`memory/`, `session/`)

### Git 规范
- 分支名：`feature/<name>` 或 `fix/<name>`
- 提交信息：`<type>(<scope>): <description>`
- 类型：`feat` / `fix` / `docs` / `test` / `refactor`

---

## 七、调试技巧

```bash
# 查看所有技能
node runtime/dist/cli.js list

# 查看技能详情
node runtime/dist/cli.js info deep-research

# 搜索技能
node runtime/dist/cli.js search research

# 查看配置
node runtime/dist/cli.js config

# JSON 输出（方便解析）
node runtime/dist/cli.js --json list

# 带超时的运行
node runtime/dist/cli.js run --timeout=5000 deep-research

# 会话管理
node runtime/dist/cli.js sessions
```

---

*本文档由执行者编写，供开发者参考。*
