@echo off
echo ========================================
echo   WorkBuddy - Open-source AI Assistant
echo ========================================
echo.

if not exist .env (
    echo [!] 未找到 .env 文件
    echo [!] 请先复制 .env.example 为 .env 并填入 API Key
    echo.
    echo 按任意键退出...
    pause > nul
    exit /b 1
)

echo [+] 安装依赖...
call npm install

echo [+] 构建项目...
call npm run build
if %errorlevel% neq 0 (
    echo [!] 构建失败
    pause
    exit /b 1
)

echo [+] 技能加载完成！
node runtime\dist\cli.js list

echo.
echo ========================================
echo   构建完成！使用以下命令开始：
echo   node runtime\dist\cli.js list
echo   node runtime\dist\cli.js search ^<query^>
echo   node runtime\dist\cli.js info ^<skill^>
echo   node runtime\dist\cli.js chat ^<skill^>
echo   node runtime\dist\cli.js run ^<skill^> [message]
echo   node runtime\dist\cli.js sessions
echo   node runtime\dist\cli.js todos list
echo ========================================
pause
