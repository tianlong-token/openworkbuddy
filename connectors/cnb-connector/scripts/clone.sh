#!/bin/bash

# CNB 代码克隆脚本
# 用法: ./clone.sh <repo_url> [target_dir]
# 示例:
#   ./clone.sh https://cnb.woa.com/user/repo
#   ./clone.sh https://cnb.woa.com/user/repo my-project
#   ./clone.sh user/repo
#   ./clone.sh user/repo -v

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 日志级别: 0=quiet, 1=normal, 2=verbose
LOG_LEVEL=1

# 日志函数
log_debug() {
    if [ $LOG_LEVEL -ge 2 ]; then
        echo -e "${GRAY}[DEBUG] $(date '+%H:%M:%S') $1${NC}" >&2
    fi
}

log_info() {
    if [ $LOG_LEVEL -ge 1 ]; then
        echo -e "${BLUE}[INFO]  $(date '+%H:%M:%S') $1${NC}"
    fi
}

log_step() {
    if [ $LOG_LEVEL -ge 1 ]; then
        echo -e "${CYAN}[STEP]  $(date '+%H:%M:%S') $1${NC}"
    fi
}

log_success() {
    if [ $LOG_LEVEL -ge 1 ]; then
        echo -e "${GREEN}[OK]    $(date '+%H:%M:%S') $1${NC}"
    fi
}

log_warn() {
    echo -e "${YELLOW}[WARN]  $(date '+%H:%M:%S') $1${NC}" >&2
}

log_error() {
    echo -e "${RED}[ERROR] $(date '+%H:%M:%S') $1${NC}" >&2
}

log_separator() {
    if [ $LOG_LEVEL -ge 1 ]; then
        echo -e "${GRAY}────────────────────────────────────────────────${NC}"
    fi
}

# 显示使用帮助
show_usage() {
    echo "CNB 代码克隆工具"
    echo ""
    echo "用法: $0 <repo_url> [target_dir] [选项]"
    echo ""
    echo "参数:"
    echo "  repo_url      仓库地址，支持以下格式:"
    echo "                  - https://cnb.woa.com/user/repo"
    echo "                  - cnb.woa.com/user/repo"
    echo "                  - user/repo"
    echo "  target_dir    可选，克隆目标目录"
    echo ""
    echo "选项:"
    echo "  -v, --verbose 显示详细日志"
    echo "  -q, --quiet   安静模式"
    echo "  -h, --help    显示帮助"
    echo ""
    echo "示例:"
    echo "  $0 user/repo"
    echo "  $0 https://cnb.woa.com/user/repo my-project"
    echo "  $0 user/repo -v"
    exit 1
}

# 解析参数
REPO_URL=""
TARGET_DIR=""
POSITIONAL_ARGS=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        -v|--verbose)
            LOG_LEVEL=2
            shift
            ;;
        -q|--quiet)
            LOG_LEVEL=0
            shift
            ;;
        -h|--help)
            show_usage
            ;;
        -*)
            log_error "未知选项: $1"
            show_usage
            ;;
        *)
            POSITIONAL_ARGS+=("$1")
            shift
            ;;
    esac
done

# 处理位置参数
if [ ${#POSITIONAL_ARGS[@]} -ge 1 ]; then
    REPO_URL="${POSITIONAL_ARGS[0]}"
fi
if [ ${#POSITIONAL_ARGS[@]} -ge 2 ]; then
    TARGET_DIR="${POSITIONAL_ARGS[1]}"
fi

# 检查仓库地址
if [ -z "$REPO_URL" ]; then
    log_error "请指定仓库地址"
    show_usage
fi

# 开始执行
log_separator
log_info "CNB 代码克隆工具启动"
log_separator

# 步骤 1: 解析仓库地址
log_step "步骤 1/3: 解析仓库地址"

# 标准化仓库地址
ORIGINAL_URL="$REPO_URL"

# 移除协议前缀
REPO_URL="${REPO_URL#https://}"
REPO_URL="${REPO_URL#http://}"

# 移除 cnb.woa.com 前缀
REPO_URL="${REPO_URL#cnb.woa.com/}"

# 移除 .git 后缀
REPO_URL="${REPO_URL%.git}"

# 移除开头的斜杠
REPO_URL="${REPO_URL#/}"

log_debug "原始地址: $ORIGINAL_URL"
log_debug "解析后路径: $REPO_URL"

# 验证格式 (至少包含一个斜杠)
if [[ ! "$REPO_URL" =~ / ]]; then
    log_error "无效的仓库地址格式: $ORIGINAL_URL"
    log_error "期望格式: user/repo 或 https://cnb.woa.com/user/repo"
    exit 1
fi

# 提取仓库名作为默认目录
if [ -z "$TARGET_DIR" ]; then
    TARGET_DIR=$(basename "$REPO_URL")
fi

log_success "仓库路径: $REPO_URL"
log_success "目标目录: $TARGET_DIR"

# 步骤 2: 获取 Token
log_step "步骤 2/3: 获取 CNB Token"

GET_TOKEN_SCRIPT="$SCRIPT_DIR/get_token.sh"

if [ ! -f "$GET_TOKEN_SCRIPT" ]; then
    log_error "找不到 get_token.sh 脚本: $GET_TOKEN_SCRIPT"
    exit 1
fi

if [ ! -x "$GET_TOKEN_SCRIPT" ]; then
    log_debug "添加执行权限到 get_token.sh"
    chmod +x "$GET_TOKEN_SCRIPT"
fi

log_info "正在获取 Token..."

# 获取 token (安静模式，只获取 token 值)
# 使用子 shell 捕获输出，stderr 重定向到 /dev/null 隐藏日志
CNB_TOKEN=$("$GET_TOKEN_SCRIPT" cnb -q 2>/dev/null)
TOKEN_STATUS=$?

if [ $TOKEN_STATUS -ne 0 ] || [ -z "$CNB_TOKEN" ]; then
    log_error "获取 Token 失败"
    log_error "请检查网络连接或授权状态"
    exit 1
fi

# Token 脱敏显示
TOKEN_LEN=${#CNB_TOKEN}
if [ $TOKEN_LEN -gt 12 ]; then
    TOKEN_MASKED="${CNB_TOKEN:0:4}****${CNB_TOKEN: -4}"
else
    TOKEN_MASKED="****"
fi
log_success "Token 获取成功: $TOKEN_MASKED"

# 步骤 3: 克隆仓库
log_step "步骤 3/3: 克隆仓库"

# 检查目标目录是否已存在
if [ -d "$TARGET_DIR" ]; then
    log_error "目标目录已存在: $TARGET_DIR"
    exit 1
fi

# 构建带认证的 URL (token 不会显示在日志中)
AUTH_URL="https://oauth2:${CNB_TOKEN}@cnb.woa.com/${REPO_URL}.git"
DISPLAY_URL="https://cnb.woa.com/${REPO_URL}.git"

log_info "正在克隆: $DISPLAY_URL"
log_debug "目标目录: $TARGET_DIR"

# 执行克隆 (隐藏包含 token 的输出)
# 使用 GIT_TERMINAL_PROMPT=0 禁用交互式提示
export GIT_TERMINAL_PROMPT=0

# 克隆时捕获输出，过滤掉可能包含 token 的内容
if git clone "$AUTH_URL" "$TARGET_DIR" 2>&1 | grep -v "$CNB_TOKEN"; then
    CLONE_STATUS=0
else
    CLONE_STATUS=${PIPESTATUS[0]}
fi

# 清除 token 变量
unset CNB_TOKEN
unset AUTH_URL

if [ $CLONE_STATUS -ne 0 ]; then
    log_error "克隆失败"
    exit 1
fi

# 验证克隆结果
if [ ! -d "$TARGET_DIR/.git" ]; then
    log_error "克隆验证失败: 目标目录不是有效的 git 仓库"
    exit 1
fi

# 完成
log_separator
log_success "克隆完成!"
echo ""
echo -e "${GREEN}✓ 仓库: ${DISPLAY_URL}${NC}"
echo -e "${GREEN}✓ 目录: $(pwd)/${TARGET_DIR}${NC}"
echo ""
log_separator

# 显示仓库信息
if [ $LOG_LEVEL -ge 1 ]; then
    echo -e "${CYAN}仓库信息:${NC}"
    cd "$TARGET_DIR"
    
    # 显示最近一次提交
    LAST_COMMIT=$(git log -1 --format="%h %s" 2>/dev/null || echo "无提交记录")
    echo -e "  最近提交: ${LAST_COMMIT}"
    
    # 显示分支
    BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    echo -e "  当前分支: ${BRANCH}"
    
    # 显示文件数量
    FILE_COUNT=$(git ls-files | wc -l | tr -d ' ')
    echo -e "  文件数量: ${FILE_COUNT}"
    
    log_separator
fi
