# 测试框架

## 测试策略

### 单元测试

测试各个模块的核心逻辑：

- `skill-loader.spec.ts` — 技能加载、解析、验证
- `tool-router.spec.ts` — 工具路由、权限检查、参数验证
- `memory-manager.spec.ts` — 记忆增删查改
- `orchestrator.spec.ts` — 四种编排模式

### 集成测试

测试模块间的交互：

- 运行时初始化流程
- 技能执行端到端测试
- 跨会话记忆持久化

### 验证命令

```bash
# 校验所有技能格式
npm run validate-skills

# 重新生成技能索引
npm run generate-index

# 运行运行时（测试加载）
cd runtime && npm run dev
```

## 手动验证清单

- [ ] `workbuddy list` — 列出所有已加载技能
- [ ] `workbuddy search deep` — 搜索包含 "deep" 的技能
- [ ] `workbuddy info deep-research` — 查看技能详情
- [ ] `workbuddy run deep-research` — 试运行技能
- [ ] `workbuddy` — 查看帮助
