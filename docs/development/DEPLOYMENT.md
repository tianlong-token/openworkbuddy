# WorkBuddy 部署文档

> 版本: v0.2.0-alpha | 更新: 2026-05-02

---

## 一、快速开始

### Windows
```bash
# 1. 安装 Node.js（推荐 v22）
# 从 https://nodejs.org 下载安装

# 2. 克隆项目
git clone <repo-url> workbuddy
cd workbuddy

# 3. 配置环境
copy .env.example .env
# 编辑 .env 填入 API Key

# 4. 一键启动
start.bat
```

### macOS / Linux
```bash
# 1. 安装 Node.js
brew install node  # macOS
# 或从 https://nodejs.org 下载

# 2. 克隆项目
git clone <repo-url> workbuddy
cd workbuddy

# 3. 配置环境
cp .env.example .env
# 编辑 .env 填入 API Key

# 4. 一键启动
chmod +x start.sh
./start.sh
```

---

## 二、环境变量配置

### 基本配置（必填）
```bash
# LLM API（二选一）

# 选项 A：DeepSeek（推荐，价格低）
WORKBUDDY_LLM_API_URL=https://api.deepseek.com/v1/chat/completions
WORKBUDDY_LLM_API_KEY=sk-your-deepseek-key
WORKBUDDY_LLM_MODEL=deepseek-chat

# 选项 B：OpenAI
# WORKBUDDY_LLM_API_URL=https://api.openai.com/v1/chat/completions
# WORKBUDDY_LLM_API_KEY=sk-your-openai-key
# WORKBUDDY_LLM_MODEL=gpt-4o
```

### 可选配置
```bash
# 技能目录（默认 ./skills）
WORKBUDDY_SKILLS_DIR=./skills

# 记忆存储类型：memory|file|api（默认 memory）
WORKBUDDY_MEMORY_STORE=file

# 日志级别：debug|info|warn|error（默认 info）
WORKBUDDY_LOG_LEVEL=info

# 允许的工具列表
WORKBUDDY_ALLOWED_TOOLS=Read,Write,Edit,Bash,Glob,Grep,WebFetch,WebSearch

# LLM 参数
WORKBUDDY_LLM_MAX_TOKENS=4096
WORKBUDDY_LLM_TEMPERATURE=0.1

# 技能执行超时（毫秒，默认 120000）
WORKBUDDY_TIMEOUT=120000
```

### 配置加载优先级
1. 环境变量（最高，运行时设置）
2. `.env` 文件（项目根目录）
3. 默认值（代码内置）

---

## 三、手动部署

```bash
# 1. 安装依赖
npm install

# 2. 构建
npm run build

# 3. 验证
node runtime/dist/cli.js list
# 预期输出：148 个技能列表

# 4. 测试配置
node runtime/dist/cli.js config
# 预期输出：LLM API URL 和 Model 已正确读取

# 5. 端到端测试
node runtime/dist/cli.js run deep-research "用一句话介绍你自己"
# 预期输出：LLM 响应

# 6. 多轮对话
node runtime/dist/cli.js chat deep-research
```

---

## 四、环境要求

| 要求 | 最低 | 推荐 |
|------|------|------|
| Node.js | 18.x | 22.x |
| npm | 9.x | 10.x |
| 内存 | 256MB | 1GB |
| 磁盘 | 100MB | 500MB |
| 网络 | 需要访问 LLM API | 宽带连接 |
| OS | Windows 10 / Ubuntu 20.04 / macOS 12 | 最新版本 |

---

## 五、数据持久化

WorkBuddy 在运行时会在工作目录下创建以下数据目录：

```
.workbuddy/
├── memory/               # FileMemoryStore 记忆文件
│   └── mem_*.json
├── sessions/             # SessionManager 会话文件
│   └── <session-id>.json
└── todos/                # TodoWrite 待办文件
    └── todos.json
```

**备份这些目录即可恢复运行状态。**

---

## 六、常见问题

### Q: 启动后报 "LLM not configured"
A: 未设置 API Key。请创建 `.env` 文件并填入有效的 Key。

### Q: 构建失败 "import.meta.url"
A: 确认 tsconfig.json 的 module 设置为 "NodeNext"，且运行时为 Node.js 18+。

### Q: 搜索不到技能
A: 确认 WORKBUDDY_SKILLS_DIR 指向正确的技能目录。默认加载项目根目录的 `skills/`。

### Q: 运行技能超时
A: 使用 `--timeout=30000` 增加超时时间，或在 `.env` 中设置 `WORKBUDDY_TIMEOUT=30000`。

### Q: Windows 上 Bash 工具无法使用
A: 需要安装 Git Bash 或 WSL。或者通过 WASI 运行时使用原生 Windows 命令。

---

## 七、升级指南

```bash
# 备份数据
cp -r .workbuddy .workbuddy.backup

# 拉取最新代码
git pull

# 重新安装依赖
npm install

# 重新构建
npm run build

# 验证
node runtime/dist/cli.js list
node runtime/dist/cli.js config
```

---

*本文档由执行者编写，供运维人员参考。*
