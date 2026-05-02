# Contributing to WorkBuddy

欢迎为 WorkBuddy 做贡献！以下是一些指南，帮助你快速上手。

## 开发环境

```bash
# 1. 克隆仓库
git clone https://github.com/your-org/workbuddy.git
cd workbuddy

# 2. 安装依赖
npm install

# 3. 构建
npm run build

# 4. 运行测试
npm test
```

## 贡献技能

### 新增技能

1. 在 `skills/` 下创建以技能 slug 命名的目录
2. 创建 `SKILL.md`，遵循 [SKILL_SPEC.md](SKILL_SPEC.md) 中的格式规范
3. 如有脚本或参考文档，放入 `scripts/` 或 `references/` 子目录
4. 运行 `npm run validate-skills` 校验格式
5. 提交 PR

### 修改现有技能

1. 编辑 `skills/<slug>/SKILL.md`
2. 确保版本号按 semver 规则更新
3. 提交 PR，描述变更内容

## 贡献代码

### 运行时引擎

- 代码位于 `runtime/src/`
- 使用 TypeScript 编写
- 提交前运行 `npm run lint` 和 `npm test`

### Proxy Box

- 代码位于 `proxy-box/src/`
- 使用 Node.js (JavaScript) 编写
- 提交前运行 `npm test`

## Commit 规范

我们使用 Conventional Commits 规范：

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

类型包括：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具/依赖

## 报告问题

请在 GitHub Issues 中报告问题，包含：
- 问题描述
- 复现步骤
- 预期行为
- 实际行为
- 环境信息（Node.js 版本、操作系统）

## License

提交代码即表示你同意以 MIT 许可证分发你的贡献。
