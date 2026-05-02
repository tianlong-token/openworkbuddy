# WorkBuddy Runtime 代码审查报告

> 审查日期: 2026-05-02 | 审查范围: runtime/src/ (7 核心文件) | 深度: Standard + Cross-file

---

## 📊 审查统计

| 严重程度 | 数量 | 关键领域 |
|----------|------|----------|
| Critical | 4 | 命令注入、路径穿越、ES模块兼容、参数名不匹配 |
| High | 6 | 跨平台兼容、正则不合规、内存泄漏、类型不安全 |
| Medium | 8 | 死代码、未验证数字、HTML剥离bug、缺少错误处理 |
| Warning | 12 | 不安全类型转换、未修剪环境变量、未使用参数 |

---

## 文件级审查

### 1. tool-executors.ts (263 行)

#### ✅ 通过项
- 安全常量定义合理（2MB 文件限制、2000 行限制）
- `toString()` 辅助函数正确处理 `string | Buffer | undefined`
- Read 工具验证文件存在性，处理目录，截断过大文件
- Write 工具递归创建父目录
- Edit 工具验证唯一匹配，支持 `replaceAll`
- Bash 工具捕获 stdout/stderr/退出码，包含超时处理

#### ⚠️ 警告项
- **死代码**: `execPromise` 函数定义但 Bash executor 中重复实现了逻辑
- **不安全类型转换**: `args['x'] as string/number` 不验证实际类型
- **WebSearch 结果解析脆弱**: DuckDuckGo HTML 正则可能因标记变化而失效

#### ❌ 失败项
- **CRITICAL: Bash 工具命令注入** - 传递原始命令字符串到 `exec()`，未验证
- **CRITICAL: 文件工具路径穿越** - Read/Write/Edit 接受任意 `filePath`，无 `../` 检查
- **HIGH: Grep 使用 substring 而非正则** - `line.includes(pattern)` 不符合工具描述
- **MEDIUM: WebFetch HTML 剥离** - 正则缺少 `s` (dotall) 标志，含换行的 script/style 标签未被剥离

---

### 2. agent-loop.ts (154 行)

#### ✅ 通过项
- 清晰的配置和结果接口
- 系统提示哈希跟踪避免不必要的对话重置
- 工具调用执行循环带最大轮数限制
- 正确的消息历史管理

#### ⚠️ 警告项
- Line 9: `tools: Record<string, any>` 应为 `Record<string, ToolSchema>`
- Line 35: `||` 应改为 `??` 以允许显式 `0` 值
- 未验证工具调用 ID

#### ❌ 失败项
- **MEDIUM: AgentLoop 中无 LLM 错误处理** - `chat()` 抛出异常时无 try/catch

---

### 3. llm/llm-provider.ts (141 行)

#### ✅ 通过项
- 正确的 TypeScript 接口匹配 OpenAI 格式
- `convertToolsToOpenAIFormat` 正确映射 ToolSchema
- 处理 tool_call 序列化/反序列化

#### ⚠️ 警告项
- Line 72: `const body: any` 应使用类型化接口
- 无 API 超时，无重试逻辑

#### ❌ 失败项
- **MEDIUM: 无 JSON 错误处理** - `resp.json()` 在非 JSON 响应时抛出异常

---

### 4. index.ts (173 行)

#### ✅ 通过项
- 关注点分离清晰
- LLM 初始化带优雅降级
- `runSkill()` 验证技能存在性和 LLM 配置

#### ⚠️ 警告项
- `sessions` Map 无限增长，无清理/TTL

#### ❌ 失败项
- **HIGH: 会话内存泄漏** - 无机制清理过期会话
- **MEDIUM: 技能加载错误未处理** - `loadAllSkills()` 无 try/catch

---

### 5. cli.ts (205 行)

#### ✅ 通过项
- 全面的命令集：run/list/search/info/chat/config
- 交互式聊天模式带 /exit 和 /clear 命令
- 有用的帮助信息

#### ⚠️ 警告项
- Line 131: `require('readline')` 使用 CommonJS 而非 ES 模块导入
- 无 Ctrl+C 处理器

#### ❌ 失败项
- **MEDIUM: ES 模块不兼容** - `require('readline')` 在 ES 模块中可能失败

---

### 6. tool-router.ts (170 行)

#### ✅ 通过项
- 完整的 12 工具 TOOL_SCHEMAS
- 正确的允许列表执行
- 参数验证

#### ⚠️ 警告项
- 未使用的 Task 工具
- WebFetch 未使用 `format` 参数

#### ❌ 失败项
- **CRITICAL: WebSearch 参数名不匹配** - Schema 定义 `numResults` 但 executor 期望 `count`
- **HIGH: 数组类型验证破坏** - `typeof [] === 'object'` 不是 `'array'`
- **MEDIUM: Task 工具已注册但未实现**

---

### 7. config.ts (87 行)

#### ✅ 通过项
- 合理的默认值
- `resolveSkillsDir()` 检查环境变量和多个候选目录
- 验证日志级别和内存存储类型

#### ⚠️ 警告项
- 无数字验证（NaN 可能）
- 允许的工具未修剪空格

#### ❌ 失败项
- **CRITICAL: CommonJS-only 路径解析** - `require.main?.filename` 在 ES 模块中失败
- **HIGH: 无效数字环境变量** - NaN 值导致 API 错误

---

## 跨领域问题

### ✅ 通过
- 无硬编码密钥或 API 密钥
- 一致的 2 空格缩进和分号
- 结构化错误返回

### ⚠️ 警告
- 日志级别未强制执行
- ES 模块 vs CommonJS 不一致
- 未使用的 Task 工具

### ❌ 失败
- **CRITICAL: 多个命令注入/路径穿越漏洞**
- **HIGH: 类型安全被忽略**
- **HIGH: Schema-executor 不匹配**
- **MEDIUM: 内存泄漏**

---

## 优先级修复建议

1. **安全**: 消毒 Bash 命令，为文件工具添加路径穿越检查
2. **正确性**: 修复 Grep 正则、WebSearch 参数名不匹配、TodoWrite 数组验证
3. **兼容性**: 替换 CommonJS require 为 ES 模块导入
4. **类型安全**: 移除 `any` 类型，添加工具参数运行时验证
5. **可靠性**: 添加 LLM API 超时/重试，清理过期会话，处理数组类型验证
