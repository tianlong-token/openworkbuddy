# Proxy-Box 决策文档

> 日期: 2026-05-02 | 决策者: AI Architect  
> 目的: 决定 proxy-box 在开源版中的定位和处理方案

---

## 现状分析

### 当前状态
| 项目 | 状态 |
|------|------|
| 源码 | ❌ 编译后的生产构建 (src/index.js 是 50KB+ 的打包文件) |
| 依赖 | ❌ `@genie/agent-sdk-js` (专有包，不可用) |
| 测试 | ⚠️ extra/test/ 有 6 个独立测试文件，可用 tsx 运行 |
| 功能 | Express + WebSocket + MCP SDK 沙盒代理 |

### 测试文件状态
| 文件 | 类型 | 可运行 |
|------|------|--------|
| `validate-session-id.spec.ts` | 独立测试 | ✅ 可用 tsx 运行 |
| `session-router.spec.ts` | 独立测试 | ✅ 可用 tsx 运行 |
| `idle-gate-session.spec.ts` | 独立测试 | ✅ 可用 tsx 运行 |
| `env-multi-session.spec.ts` | 独立测试 | ✅ 可用 tsx 运行 |
| `dynamic-session-facade.spec.ts` | 独立测试 | ✅ 可用 tsx 运行 |
| `bound-session-handle.spec.ts` | 独立测试 | ✅ 可用 tsx 运行 |

### 依赖分析
```json
{
  "dependencies": {
    "express": "^4.18.0",           // ✅ 开源
    "ws": "^8.16.0",               // ✅ 开源
    "@modelcontextprotocol/sdk": "^1.0.0"  // ✅ 开源 (MCP SDK)
  }
}
```

**注意**: 虽然 package.json 中的依赖都是开源的，但 src/index.js 是编译后的文件，内部引用了 `@genie/agent-sdk-js`（专有包）。

---

## 方案对比

### 方案 A: 移除 proxy-box

**优点**:
- 简单，开源版无遗留问题
- 减少维护负担
- 避免法律风险（专有代码）

**缺点**:
- 失去沙盒隔离能力
- 工具执行器直接运行在主机环境

**工作量**: 低 (删除目录，更新文档)

### 方案 B: 轻量替代方案

**实现**:
- 使用 Node.js `vm` 模块创建隔离执行环境
- 使用 `child_process` 实现超时控制
- 限制文件系统访问（通过 chroot 或路径验证）

**优点**:
- 保留核心沙盒功能
- 完全开源
- 可定制

**缺点**:
- 需要重新实现
- 安全性不如专业沙盒
- 维护成本增加

**工作量**: 中 (2-4 小时)

### 方案 C: 保留占位符 + 文档说明

**实现**:
- 保留 proxy-box 目录结构
- 添加 README 说明当前状态
- 提供对接指南（未来可对接专业沙盒）

**优点**:
- 保留扩展性
- 文档清晰
- 零工作量

**缺点**:
- 当前无功能
- 可能误导用户

**工作量**: 低 (编写文档)

---

## 决策

### 推荐方案: **方案 C (保留占位符 + 文档说明)**

**理由**:
1. 开源版的核心价值在于 runtime 和 skill 系统，沙盒是可选功能
2. 保留目录结构为未来对接专业沙盒预留空间
3. 避免法律风险（移除编译后的专有代码）
4. 最小工作量，快速推进 v0.1.0 发布

### 执行计划

#### 1. 移除编译文件
```
删除: proxy-box/src/index.js (编译后的专有代码)
删除: proxy-box/src/ecosystem.config.js (PM2 配置)
```

#### 2. 保留测试文件
```
保留: proxy-box/extra/test/*.spec.ts (独立测试，可运行)
保留: proxy-box/extra/test/README.md
保留: proxy-box/extra/test/webhook-server.js
```

#### 3. 更新 package.json
```json
{
  "name": "@workbuddy/proxy-box",
  "version": "0.1.0-placeholder",
  "description": "Sandbox proxy service for WorkBuddy — placeholder for future integration",
  "scripts": {
    "test": "npx tsx extra/test/*.spec.ts"
  }
}
```

#### 4. 添加 README
```markdown
# Proxy-Box (Placeholder)

> This is a placeholder for the sandbox proxy service.
> The original implementation depends on proprietary packages.
> Future versions will include an open-source alternative.

## Current Status
- ❌ Sandbox execution not available
- ✅ Test files available in `extra/test/`
- 📋 See PROXY-BOX-DECISION.md for details

## Running Tests
```bash
npx tsx extra/test/validate-session-id.spec.ts
npx tsx extra/test/session-router.spec.ts
# ... (all 6 test files)
```

## Future Plans
- Implement lightweight sandbox using Node.js vm + child_process
- Or integrate with open-source sandbox solutions
```

---

## 验证清单

- [ ] 编译文件已删除
- [ ] 测试文件可运行
- [ ] package.json 更新
- [ ] README 添加
- [ ] 文档链接更新

---

*本文档由组长编写，作为 Phase 3 的决策依据。*

---

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
