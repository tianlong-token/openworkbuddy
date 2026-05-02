#!/bin/bash
echo "========================================"
echo "  WorkBuddy - Open-source AI Assistant"
echo "========================================"
echo

if [ ! -f .env ]; then
    echo "[!] 未找到 .env 文件"
    echo "[!] 请先复制 .env.example 为 .env 并填入 API Key"
    exit 1
fi

echo "[+] 安装依赖..."
npm install || { echo "[!] 依赖安装失败"; exit 1; }

echo "[+] 构建项目..."
npm run build || { echo "[!] 构建失败"; exit 1; }

echo "[+] 加载技能..."
node runtime/dist/cli.js list

echo
echo "========================================"
echo "  构建完成！使用以下命令开始："
echo "  node runtime/dist/cli.js list"
echo "  node runtime/dist/cli.js search <query>"
echo "  node runtime/dist/cli.js info <skill>"
echo "  node runtime/dist/cli.js chat <skill>"
echo "  node runtime/dist/cli.js run <skill> [message]"
echo "  node runtime/dist/cli.js sessions"
echo "  node runtime/dist/cli.js todos list"
echo "========================================"
