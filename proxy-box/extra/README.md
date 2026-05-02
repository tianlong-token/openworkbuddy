# Webhook 测试服务

本目录包含用于测试 webhook 推送的本地服务器。

## 文件说明

- `webhook-server.js` - 本地 webhook 测试服务器
- `test-webhook.js` - webhook 服务器功能测试脚本
- `README.md` - 使用说明文档

## 使用方法

### 启动 webhook 测试服务器

```bash
# 在 box 目录下启动
node test/webhook-server.js

# 或者在构建后的 dist/box 目录下启动
cd dist/box
node test/webhook-server.js
```

### 服务器配置

- **监听地址**: `127.0.0.1:5000` (仅本地访问)
- **Webhook 端点**: `http://127.0.0.1:5000/webhook` 或 `http://127.0.0.1:5000/`
- **健康检查**: `http://127.0.0.1:5000/health`

### 日志输出

服务器会将接收到的 webhook 请求同时输出到：

1. **控制台** - 实时查看
2. **日志文件** - 持久化存储
   - 开发环境: `../logs/box-webhook.log`
   - 生产环境: `/var/logs/backagent/box-webhook.log`

### 日志格式

```
================================================================================
Received Webhook - 2026-01-12T08:18:24.123Z
--------------------------------------------------------------------------------
Method: POST
URL: /webhook
Remote Address: 127.0.0.1
----------------------------------------
Headers:
  content-type: application/json
  x-timestamp: 1705046304
  x-agent-id: test-agent
  x-webhook-signature: abc123...
  traceparent: 00-trace123-span456-01
----------------------------------------
Body:
{
  "sessionId": "test-session-123",
  "event": "UserPromptSubmit",
  "data": {...},
  "timestamp": 1705046304123
}
================================================================================
```

### 响应格式

服务器对成功的 webhook 请求返回：

```json
{
  "code": 0,
  "message": "success",
  "requestId": "webhook-1705046304123",
  "timestamp": "2026-01-12T08:18:24.123Z"
}
```

### 测试 webhook 推送

#### 方法 1: 使用测试脚本

```bash
# 1. 启动 webhook 服务器（终端 1）
node test/webhook-server.js

# 2. 运行测试脚本（终端 2）
node test/test-webhook.js
```

#### 方法 2: 手动配置测试

1. 启动 webhook 测试服务器
2. 配置 box 服务的 webhook URL 为 `http://127.0.0.1:5000/webhook`
3. 触发需要推送的事件
4. 查看控制台输出或日志文件确认接收到推送

#### 方法 3: 使用 curl 测试

```bash
# 测试健康检查
curl http://127.0.0.1:5000/health

# 测试 webhook 推送
curl -X POST http://127.0.0.1:5000/webhook \
  -H "Content-Type: application/json" \
  -H "x-timestamp: $(date +%s)" \
  -H "x-agent-id: test-agent" \
  -d '{
    "sessionId": "test-session",
    "event": "UserPromptSubmit",
    "data": {"test": "data"},
    "timestamp": '$(date +%s000)'
  }'
```

### 注意事项

- 服务器仅监听本地地址 `127.0.0.1`，外部无法访问
- 支持 CORS，方便前端测试
- 自动处理 JSON 格式化输出
- 包含优雅关闭和错误处理机制
- 日志文件会持续追加，注意定期清理