#!/bin/bash

# 工蜂 API 调用脚本
# 用法: ./gongfeng_api.sh <method> <endpoint> <project_id> [data]
# 示例:
#   ./gongfeng_api.sh GET /repository/tree "123"
#   ./gongfeng_api.sh POST /repository/files "123" '{"file_path":"test.txt","content":"Hello"}'

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# API 基础 URL
GONGFENG_API_BASE="https://git.woa.com/api/v3"

# 重试配置
MAX_RETRIES=3
RETRY_DELAY=2
CONNECT_TIMEOUT=10
MAX_TIME=60

# 显示使用帮助
show_usage() {
    cat << EOF
用法: $0 <method> <endpoint> <project_id> [data]

参数:
  method     必填，HTTP 方法（GET/POST/PUT/DELETE/PATCH）
  endpoint   必填，API 路径（如 /repository/tree）
  project_id 必填，项目ID
  data       可选，请求体（JSON 格式）

常用端点:
  GET    /repository/tree              获取文件目录树
  GET    /repository/files             获取文件内容
  GET    /repository/branches          获取分支列表
  POST   /repository/branches          创建分支
  DELETE /repository/branches          删除分支
  POST   /repository/files             新增文件
  PUT    /repository/files             编辑文件
  DELETE /repository/files             删除文件
  POST   /repository/files/batch       批量提交文件
  GET    /repository/files/:path/blame 查看文件历史
  POST   /repository/locks             新增锁
  GET    /repository/locks             查看锁

示例:
  $0 GET /repository/tree "123"
  $0 GET "/repository/tree?ref_name=main" "123"
  $0 POST /repository/files "123" '{"file_path":"test.txt","branch_name":"main","content":"Hello","commit_message":"Add file"}'
  $0 POST /repository/branches "123" '{"branch_name":"feature","ref":"main"}'

EOF
    exit 1
}

# 检查 Token
check_token() {
    if [ -z "$GONGFENG_TOKEN" ]; then
        # 尝试从 .env 文件加载
        if [ -f ".env" ]; then
            local token_line
            token_line=$(grep -E '^GONGFENG_TOKEN=' .env 2>/dev/null | head -n1)
            if [ -n "$token_line" ]; then
                GONGFENG_TOKEN=$(echo "$token_line" | cut -d'=' -f2-)
            fi
        fi
    fi
    
    if [ -z "$GONGFENG_TOKEN" ]; then
        echo -e "${RED}错误: 未找到 GONGFENG_TOKEN${NC}"
        echo "请设置环境变量或在 .env 文件中配置 GONGFENG_TOKEN"
        echo ""
        echo "获取方法:"
        echo "  .codebuddy/skills/oauth-token-fetcher/scripts/gongfeng_token.sh"
        exit 1
    fi
}

# 验证 HTTP 方法
validate_method() {
    local method="$1"
    case "$method" in
        GET|POST|PUT|PATCH|DELETE)
            return 0
            ;;
        *)
            echo -e "${RED}错误: 不支持的 HTTP 方法 '$method'${NC}"
            echo "支持的方法: GET, POST, PUT, PATCH, DELETE"
            exit 1
            ;;
    esac
}

# 执行请求（带重试）
do_request() {
    local method="$1"
    local url="$2"
    local data="$3"
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        local response
        local http_code
        
        # 构建 curl 参数数组
        local curl_args=(
            -s
            -w '\n%{http_code}'
            -X "$method"
            -H "Authorization: Bearer $GONGFENG_TOKEN"
            -H "Content-Type: application/json"
            --connect-timeout "$CONNECT_TIMEOUT"
            --max-time "$MAX_TIME"
        )
        
        if [ -n "$data" ]; then
            curl_args+=(-d "$data")
        fi
        
        curl_args+=("$url")
        
        # 执行请求
        response=$(curl "${curl_args[@]}" 2>/dev/null) || {
            echo -e "${YELLOW}警告: 请求失败，正在重试 ($attempt/$MAX_RETRIES)...${NC}" >&2
            sleep $((RETRY_DELAY * attempt))
            attempt=$((attempt + 1))
            continue
        }
        
        # 分离响应体和状态码
        http_code=$(echo "$response" | tail -n1)
        local body
        body=$(echo "$response" | sed '$d')
        
        # 处理可重试的错误
        case "$http_code" in
            429|500|502|503|504)
                if [ $attempt -lt $MAX_RETRIES ]; then
                    echo -e "${YELLOW}警告: HTTP $http_code，正在重试 ($attempt/$MAX_RETRIES)...${NC}" >&2
                    sleep $((RETRY_DELAY * attempt))
                    attempt=$((attempt + 1))
                    continue
                fi
                ;;
        esac
        
        # 处理最终响应
        handle_response "$http_code" "$body"
        return $?
    done
    
    echo -e "${RED}错误: 请求失败，已达到最大重试次数${NC}" >&2
    return 1
}

# 处理响应
handle_response() {
    local http_code="$1"
    local body="$2"
    
    case "$http_code" in
        200|201|202|204)
            echo -e "${GREEN}✓ 成功 (HTTP ${http_code})${NC}" >&2
            echo "$body"
            return 0
            ;;
        401)
            echo -e "${RED}✗ 认证失败 (HTTP 401)${NC}" >&2
            echo "Token 无效或已过期，请重新获取" >&2
            echo "$body"
            return 1
            ;;
        403)
            echo -e "${RED}✗ 权限不足 (HTTP 403)${NC}" >&2
            echo "$body"
            return 1
            ;;
        404)
            echo -e "${RED}✗ 资源不存在 (HTTP 404)${NC}" >&2
            echo "请检查项目ID和路径是否正确" >&2
            echo "$body"
            return 1
            ;;
        422)
            echo -e "${RED}✗ 请求参数错误 (HTTP 422)${NC}" >&2
            echo "$body"
            return 1
            ;;
        429)
            echo -e "${YELLOW}⚠ 速率限制 (HTTP 429)${NC}" >&2
            echo "请稍后重试" >&2
            echo "$body"
            return 1
            ;;
        *)
            echo -e "${RED}✗ 请求失败 (HTTP ${http_code})${NC}" >&2
            echo "$body"
            return 1
            ;;
    esac
}

# 主函数
main() {
    # 检查参数
    if [ $# -lt 3 ]; then
        echo -e "${RED}错误: method、endpoint 和 project_id 为必填参数${NC}"
        echo ""
        show_usage
    fi
    
    if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
        show_usage
    fi
    
    local method="$1"
    local endpoint="$2"
    local project_id="$3"
    local data="$4"
    
    # 验证方法
    validate_method "$method"
    
    # 检查 Token
    check_token
    
    # 构建完整 URL
    local url="${GONGFENG_API_BASE}/projects/${project_id}${endpoint}"
    
    # 显示请求信息
    echo -e "${YELLOW}调用工蜂 API: ${method} ${url}${NC}" >&2
    
    # 执行请求
    do_request "$method" "$url" "$data"
}

main "$@"
