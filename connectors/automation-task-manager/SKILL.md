---
name: automation-task-manager
description: "自动化任务管理工具 - 帮助用户创建、编辑、删除和查询自动化定时任务。关键词：自动化任务、定时任务、创建任务、编辑任务、删除任务、任务列表"
version: "1.0.2"
author: "CodeBuddy AI"
created: "2026-04-01"
updated: "2026-04-15"
---

# Automation Task Manager

> **Goal**: 帮助用户通过自然语言管理自动化定时任务（创建、编辑、删除、查询），**通过 `scripts/scheduler-api.sh` 脚本调用 API 执行操作**。

## When to Use

**仅当用户主动要求对任务本身进行管理操作时**触发：
- 用户明确说"创建/新建一个定时任务"、"帮我设置一个自动化任务"、"某时间提醒我某件事"
- 用户要求"编辑/修改/暂停/恢复/删除某个任务"
- 用户要求"查看定时任务或自动化任务列表"或"查看某个任务详情"

## When NOT to Use（重要）

以下场景**严禁**加载或触发此 skill：
- **当 prompt 以 `[SCHEDULED_TASK]` 开始时** — 这是自动化调度系统触发的任务执行，绝对不能加载此 skill
- 用户 prompt 中只是提到"任务"、"提醒"等词但并非要管理调度定时任务（如"帮我完成这个任务"、"提醒我注意代码规范"）

## Core Principles

1. **必须使用脚本**：所有操作通过 `scripts/scheduler-api.sh` 执行，禁止只生成 JSON 请求体
2. **Cron 6 位格式**：`秒 分 时 日 月 周`，秒固定为 `0`
3. **严禁秒级任务**：最小间隔 **1 分钟**。用户要求秒级调度时**必须拒绝**，**严禁静默转换为分钟级**
4. **必填字段**：创建任务必须提供 `--name`、`--cron`、`--prompt`、`--frequency-type`
5. **默认值**：时区 `Asia/Shanghai`，超时 300 秒（范围 10-1800），重试 3 次（最大 10）
6. **环境变量自动读取**：`SCHEDULER_API_BASE_URL` 优先从 `ACC_PRODUCT_CONFIG_V3.endpoint` 读取，读取不到时使用默认值 `http://auth.proxy/codebuddy`

## Frequency Type 识别规则（必填）

`--frequency-type` 是**必填参数**，根据用户意图自动识别：

| 类型 | 值 | 识别特征 |
|------|-----|---------|
| **每天执行** | `daily` | 每天X点、每日、daily、工作日、周末、每周X |
| **按间隔执行** | `interval` | 每X分钟、每X小时、每隔、interval |
| **单次执行** | `once` | 只执行一次、某个具体日期时间、提醒我X号做Y |


### 判断优先级

1. 如果提到"只一次"、"只执行一次" → `once`
2. 如果提到具体日期（X月X日、明天、下周X） → `once`
3. 如果提到"每X分钟"、"每X小时"、"每隔" → `interval`
4. 如果提到"每天"、"每日"、"每周X"、"工作日"、"周末" → `daily`
5. 默认不确定时 → 询问用户是重复执行还是单次执行

## 脚本使用

脚本位置：`.codebuddy/skills/automation-task-manager/scripts/scheduler-api.sh`

### 创建任务

```bash
./scripts/scheduler-api.sh create \
  --name "任务名称" \
  --cron "0 0 9 * * *" \
  --prompt "任务执行指令" \
  --frequency-type "daily"
```

**必填参数**：`--name`、`--cron`、`--prompt`、`--frequency-type`（daily/interval/once）

**可选参数**：`--description`、`--timezone`、`--timeout`、`--retry-count`、`--effective-start`（YYYY-MM-DD）、`--effective-end`（YYYY-MM-DD）

### 查询任务列表

```bash
./scripts/scheduler-api.sh list
./scripts/scheduler-api.sh list --status 1 --keyword "日报"
```

**可选参数**：`--page`、`--page-size`、`--status`（1-启用/0-停用）、`--keyword`

### 获取任务详情

```bash
./scripts/scheduler-api.sh get --id 123
```

### 更新任务

```bash
./scripts/scheduler-api.sh update --id 123 --cron "0 0 20 * * *"
./scripts/scheduler-api.sh update --id 123 --status 0   # 暂停
./scripts/scheduler-api.sh update --id 123 --status 1   # 恢复
```

**可选参数**：`--name`、`--cron`、`--prompt`、`--status`、`--timeout`、`--retry-count`、`--description`、`--timezone`

### 删除任务

```bash
./scripts/scheduler-api.sh delete --id 123
```

## 示例

### 示例 1：每天执行（daily）

用户说："帮我创建一个每天晚上9点提醒写日报的任务"

```bash
./scripts/scheduler-api.sh create \
  --name "每日日报提醒" \
  --cron "0 0 21 * * *" \
  --prompt "提醒用户写日报。请帮助用户回顾今天的工作：1. 完成了哪些任务？2. 遇到了什么问题？3. 明天计划做什么？" \
  --frequency-type "daily"
```

### 示例 2：按间隔执行（interval）

用户说："每小时检查一次服务状态"

```bash
./scripts/scheduler-api.sh create \
  --name "服务状态检查" \
  --cron "0 0 * * * *" \
  --prompt "检查各服务的运行状态，如果发现异常请立即汇报" \
  --frequency-type "interval"
```

### 示例 3：单次执行（once）

用户说："明天下午3点提醒我提交周报"

```bash
./scripts/scheduler-api.sh create \
  --name "周报提交提醒" \
  --cron "0 0 15 2 4 *" \
  --prompt "提醒用户提交本周周报" \
  --frequency-type "once" \
  --effective-start "2026-04-02" \
  --effective-end "2026-04-02"
```

## 错误码

| 错误码 | 说明 |
|--------|------|
| INVALID_PARAM | 无效参数 |
| TASK_NOT_FOUND | 任务不存在 |
| TASK_LIMIT_EXCEEDED | 任务数量超限 (最多100个) |
| INVALID_CRON_EXPR | 无效的 Cron 表达式 |

## Cron 快速参考

格式：`秒 分 时 日 月 周`（秒固定为 0），详见 `references/cron_examples.md`。

| 描述 | 表达式 |
|------|--------|
| 每天早上9点 | `0 0 9 * * *` |
| 每小时 | `0 0 * * * *` |
| 每30分钟 | `0 */30 * * * *` |
| 工作日每天9点 | `0 0 9 * * 1-5` |
| 每周一早上9点 | `0 0 9 * * 1` |
| 每月1号早上9点 | `0 0 9 1 * *` |
