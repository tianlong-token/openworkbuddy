/**
 * 本地 Webhook 测试服务器
 * 
 * 用于开发环境下接收和打印 webhook 消息到日志文件
 * 
 * 启动方式: node test/webhook-server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const HOST = '127.0.0.1'; // 只允许本地访问

// 获取日志目录路径
const IS_DEV = true;
const LOG_DIR = IS_DEV ? path.join(__dirname, '..', 'logs') : '/var/logs/backagent';
const WEBHOOK_LOG_FILE = path.join(LOG_DIR, 'box-webhook.log');

/**
 * 确保日志目录存在
 */
function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
        console.log(`Created log directory: ${LOG_DIR}`);
    }
}

/**
 * 写入日志到文件
 */
function writeLog(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;

    try {
        fs.appendFileSync(WEBHOOK_LOG_FILE, logEntry, 'utf8');
    } catch (error) {
        console.error('Failed to write to log file:', error);
    }
}

/**
 * 格式化请求信息
 */
function formatRequest(req, body) {
    const timestamp = new Date().toISOString();
    const lines = [];

    lines.push('='.repeat(80));
    lines.push(`Received Webhook - ${timestamp}`);
    lines.push('-'.repeat(80));

    // 请求信息
    lines.push(`Method: ${req.method}`);
    lines.push(`URL: ${req.url}`);
    lines.push(`Remote Address: ${req.connection.remoteAddress}`);

    lines.push('-'.repeat(40));
    lines.push('Headers:');
    Object.entries(req.headers).forEach(([key, value]) => {
        lines.push(`  ${key}: ${value}`);
    });

    lines.push('-'.repeat(40));
    lines.push('Body:');
    try {
        const parsed = JSON.parse(body);
        lines.push(JSON.stringify(parsed, null, 2));
    } catch (e) {
        lines.push(body || '(empty)');
    }

    lines.push('='.repeat(80));

    return lines.join('\n');
}

// 确保日志目录存在
ensureLogDir();

const server = http.createServer((req, res) => {
    // 只处理 POST 请求到 /webhook 或 /
    const isWebhookRequest = req.method === 'POST' && (req.url === '/webhook' || req.url === '/');

    if (isWebhookRequest) {
        let body = '';

        req.on('data', (chunk) => {
            body += chunk.toString();
        });

        req.on('end', () => {
            // 格式化并记录请求
            const formattedLog = formatRequest(req, body);

            // 同时输出到控制台和日志文件
            console.log('\n' + formattedLog + '\n');
            writeLog(formattedLog);

            // 返回成功响应
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, x-timestamp, x-agent-id, x-webhook-signature, traceparent'
            });
            res.end(JSON.stringify({
                code: 0,
                message: 'success',
                requestId: req.headers['x-request-id'] || `webhook-${Date.now()}`,
                timestamp: new Date().toISOString()
            }));
        });
    } else if (req.method === 'OPTIONS') {
        // 处理 CORS 预检请求
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-timestamp, x-agent-id, x-webhook-signature, traceparent'
        });
        res.end();
    } else if (req.method === 'GET' && req.url === '/health') {
        // 健康检查端点
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            service: 'webhook-test-server',
            timestamp: new Date().toISOString(),
            logFile: WEBHOOK_LOG_FILE
        }));
    } else {
        // 其他请求返回 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            code: 404,
            message: 'Not Found',
            hint: 'POST to /webhook or /; GET /health for status'
        }));
    }
});

server.listen(PORT, HOST, () => {
    const startupMessage = [
        '='.repeat(80),
        '  Local Webhook Test Server',
        '='.repeat(80),
        `  Listening on: http://${HOST}:${PORT}/webhook`,
        `  Health check: http://${HOST}:${PORT}/health`,
        `  Log file: ${WEBHOOK_LOG_FILE}`,
        `  Log directory: ${LOG_DIR}`,
        '  Press Ctrl+C to stop',
        '='.repeat(80)
    ].join('\n');

    console.log(startupMessage + '\n');
    writeLog('Webhook test server started');
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\nShutting down webhook test server...');
    writeLog('Webhook test server stopped');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    writeLog(`Uncaught Exception: ${error.message}\n${error.stack}`);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    writeLog(`Unhandled Rejection: ${reason}`);
});
