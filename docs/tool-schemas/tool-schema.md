# CodeBuddy 工具 Schema 反向推导文档

> 从 `proxy/box/index.js` 及 `agent-sdk/lib/` 源码中反向推导而出

---

## 一、MCP 自定义工具（index.js 中注册）

这两个工具通过 `xT.createSdkMcpServer` 注册为 MCP 服务，名为 `custom_tools`。

### 1. conversation_search

**注册方式**: `xT.tool("conversation_search", ...)`

**描述**: Search through past user conversations to find relevant context and information.
This tool can retrieve both Fact memories and Conversational memories.

**调用时机**:
- 用户要求继续之前的工作
- 需要用户历史技术偏好
- 需要用户工作习惯、常规流程或决策历史
- 用户引用了之前的约束或承诺

**关键特性**: 工具对当前对话 ZERO 访问权限，query 必须自包含。

**参数 Schema**:

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| query | string | ✅ | 自包含的搜索查询，必须重述当前请求并指定需要什么历史信息 |
| start_date | string | ❌ | 起始日期过滤 (ISO 8601, e.g. "2026-03-01") |
| end_date | string | ❌ | 结束日期过滤 (ISO 8601, e.g. "2026-03-25") |
| limit | number | ❌ | 最大返回结果数，默认 5 |

**内部实现**:
- 请求地址: `{MEMORY_API_BASE_URL}/api/memory/search`
- 超时: 10 分钟 (`iNt = 10*60*1e3`)
- query 哈希: SHA256 取前16位
- 返回结构:
```json
{
  "type": "conversation_search_result",
  "success": true/false,
  "message": "...",
  "queryHash": "sha256前16位",
  "requestId": "后端请求ID",
  "count": 5,
  "results": [
    {
      "conversation_id": "",
      "summary": "",
      "score": 0.0,
      "updated_at": ""
    }
  ],
  "time_range": {}
}
```

**MEMORY_API_BASE_URL 解析逻辑**:
1. 优先读环境变量 `MEMORY_API_BASE_URL`
2. 否则从 `ACC_PRODUCT_CONFIG_V3` 环境变量的 JSON 中取 `endpoint`
3. 兜底: `http://auth.proxy/codebuddy`

---

### 2. open_result_view

**注册方式**: `xT.tool("open_result_view", ...)`

**描述**: 仅当两个条件同时满足时调用:
1. Agent 已完成当前任务的主要执行步骤
2. Agent 已实际产生或确认了用户可立即查看的结果

**调用约束**:
- 仅用于结果展示，不改变或阻塞正常对话回复流程
- 不要对不完整的结果或仅预期产生的结果调用

**参数 Schema**:

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| target_file | string | ✅ | 要显示的结果文件的绝对路径 |
| explanation | string | ❌ | 一句话解释为什么使用此工具，语言遵循系统提示词中的 response_language |

**返回**:
```json
{
  "status": "ok",
  "target_file": "...",
  "explanation": "..."
}
```

---

## 二、核心配置函数 Jn()

这是 Agent Session 的核心配置，从 `index.js` 提取：

```javascript
function Jn() {
  let t = nNt();  // 获取系统提示词
  return {
    env: {
      CODEBUDDY_INCLUDE_TOPIC_MESSAGE: "true",
      CODEBUDDY_CODE_EXPERIMENTAL_AGENT_TEAMS: "0",
      DISABLE_AUTOUPDATER: "1"
    },
    cwd: WORKDIR,
    settingSources: ["user", "project", "local"],
    permissionMode: "bypassPermissions",
    canUseTool: async (e, r, o) => ({
      behavior: "allow",
      updatedInput: r
    }),
    includePartialMessages: true,
    mcpServers: {
      custom_tools: lNt()  // 包含 conversation_search + open_result_view
    },
    ...(t ? { systemPrompt: t } : {})
  };
}
```

**关键发现**:
- `permissionMode: "bypassPermissions"` → 工具调用无需权限确认
- `canUseTool` 始终返回 `allow` → 所有工具自动放行
- `settingSources: ["user", "project", "local"]` → 三级配置优先级
- `CODEBUDDY_CODE_EXPERIMENTAL_AGENT_TEAMS: "0"` → 团队功能默认关闭

---

## 三、系统提示词构建逻辑 nNt()

```javascript
function nNt() {
  let t = SYSTEM_PROMPT_FILES;  // 候选文件路径列表
  for (let e of t) {
    if (fs.existsSync(e)) {
      let r = fs.readFileSync(e, "utf-8");
      let o = rNt(r);  // Go模板 → Nunjucks模板转换
      return o;
    }
  }
  return null;  // 没有找到任何系统提示词文件
}
```

**模板变量替换** (rNt函数):
| Go模板变量 | 替换为 |
|-----------|--------|
| `{{.EnvironmentLanguage}}` | 语言模板（中文/英文） |
| `{{.ArtifactPath}}` | `{sandboxDataPath("artifact","{{sessionId}}")}/` |
| `{{.SessionId}}` | `{{ sessionId }}` |

**语言模板** (tNt):
```jinja2
<response_language>
{%- if language %}
{{ language }}
{%- else %}
当前处于中文环境，使用简体中文回答 (Speak in Chinese).
{%- endif %}
</response_language>
```

---

## 四、Fork & Query 机制 (BEe函数)

用于子Agent的 fork 模式执行：

```javascript
async function BEe(t) {
  let { sdkSessionIdForResume, cwd, prompt, traceId, language } = t;
  
  let a = {};
  if (language) a.settings = JSON.stringify({ language });
  
  let c = query({
    prompt: prompt,
    options: {
      ...Jn(),           // 继承核心配置
      cwd: cwd || WORKDIR,
      maxTurns: 1,       // 只执行1轮
      disallowedTools: ["*"],  // 禁止所有工具（fork模式限制）
      resume: sdkSessionIdForResume,
      forkSession: true,
      ...a
    }
  });
  
  // 遍历结果流
  for await (let f of c) {
    if (f.type === "result") {
      // newSessionId, success, result
    }
  }
}
```

**关键发现**:
- Fork 模式 `maxTurns: 1` → 只执行一轮就返回
- Fork 模式 `disallowedTools: ["*"]` → **禁止调用任何工具**
- Fork 模式是纯推理，不执行外部操作

---

## 五、Suggestion Query 机制 (jEe函数)

用于生成建议/补全：

```javascript
async function jEe(t) {
  let { sdkSessionIdForResume, cwd, prompt, traceId, language } = t;
  let a = `suggestion-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  // ... 类似 BEe 但生成建议
}
```

---

## 六、内置工具注册表

从 `index.js` 中提取的已知工具名和函数位置：

| 工具名 | 位置 | 类型 |
|--------|------|------|
| `Read` | 1838464 | 内置 (agent-sdk) |
| `Write` | 1157338 | 内置 (agent-sdk) |
| `Edit` | 1180753 | 内置 (agent-sdk) |
| `EnterPlanMode` | 1181734 | 内置 (agent-sdk) |
| `ExitPlanMode` | 1182346 | 内置 (agent-sdk) |
| `AskUserQuestion` | 1127622 | 内置 (agent-sdk) |
| `Skill` | 1840635 | 内置 (agent-sdk) |
| `LSP` | 1840691 | 内置 (agent-sdk) |
| `TaskCreate` | 1841122 | 内置 (agent-sdk) |
| `TaskUpdate` | 1841149 | 内置 (agent-sdk) |
| `TaskList` | 1841176 | 内置 (agent-sdk) |
| `conversation_search` | 1107481 | MCP 自定义 |
| `open_result_view` | 1112080 | MCP 自定义 |

**未在 index.js 中找到（属于延迟工具/外部注册）**:
- MultiEdit, Bash, Glob, Grep
- WebSearch, WebFetch, Agent
- ToolSearch, DeferExecuteTool
- TaskGet, TaskOutput, TaskStop
- CronCreate, CronDelete, ImageGen
- EnterWorktree, LeaveWorktree
- TeamCreate, TeamDelete
- NotebookEdit, SendMessage

这些工具由 `@genie/agent-sdk-js` 在运行时注册，源码在 `agent-sdk` 的编译产物中。

---

## 七、工具调用拦截逻辑

### Write 拦截
```javascript
if (v === "Write" || v === "write") {
  let M = N?.file_path || N?.path;
  let P = N?.file_text || N?.content;
  if (M?.includes(`${USER_DA...`))  // 检查是否写入用户数据目录
}
```

### Edit 拦截
```javascript
if (a === "Edit") {
  let u = c.file_path;
  if (!u || !ZS(u)) return;  // ZS() 检查文件路径合法性
  // 对 brain file 做特殊处理
}
```

### EnterPlanMode 拦截
```javascript
if (a === "EnterPlanMode") {
  let l = u?.planFilePath;
  // 提取计划文件路径
}
```

### ExitPlanMode 拦截
```javascript
if (a === "ExitPlanMode") {
  let l = u?.planFilePath;
  let d = u?.plan;
  // 写入计划文件
}
```

---

## 八、TASK_TOOLS_WITH_PLAN

```javascript
static TASK_TOOLS_WITH_PLAN = new Set([
  "TaskCreate", "task_create",
  "TaskUpdate", "task_update",
  "TaskList", "task_list"
]);
```

这些任务工具会与计划模式联动。

---

## 九、fNt - 工具黑名单

```javascript
var fNt = ["AskUserQuestion"];
```

`AskUserQuestion` 在 session-status 检查时被特殊处理（不计入工具调用次数？）。

---

## 十、环境变量

从 Jn() 和 sNt() 中提取的关键环境变量：

| 环境变量 | 默认值 | 用途 |
|---------|--------|------|
| `MEMORY_API_BASE_URL` | - | 记忆搜索 API 地址 |
| `ACC_PRODUCT_CONFIG_V3` | - | 产品配置 JSON（含 endpoint） |
| `CODEBUDDY_INCLUDE_TOPIC_MESSAGE` | "true" | 包含主题消息 |
| `CODEBUDDY_CODE_EXPERIMENTAL_AGENT_TEAMS` | "0" | 实验性团队功能开关 |
| `DISABLE_AUTOUPDATER` | "1" | 禁用自动更新 |

---

*文档生成时间: 2025-04-27*
*源码版本: Build 20260423_235245*
