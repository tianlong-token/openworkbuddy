#!/bin/bash

# Figma API 调用封装脚本
# 用法: ./figma_api.sh <method> <endpoint> [options]
# 示例:
#   ./figma_api.sh GET "/v1/files/ABC12345"
#   ./figma_api.sh POST "/v1/files/ABC12345/comments" -d '{"message":"Hello"}'

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# API 配置
FIGMA_API_BASE="https://api.figma.com"

# 重试配置
MAX_RETRIES=3
RETRY_DELAY=2
CONNECT_TIMEOUT=10
MAX_TIME=60

# 检查 Token
check_token() {
    if [ -z "$FIGMA_TOKEN" ]; then
        # 尝试从 .env 文件加载
        if [ -f ".env" ]; then
            local token_line
            token_line=$(grep -E '^FIGMA_TOKEN=' .env 2>/dev/null | head -n1)
            if [ -n "$token_line" ]; then
                FIGMA_TOKEN=$(echo "$token_line" | cut -d'=' -f2-)
            fi
        fi
    fi

    if [ -z "$FIGMA_TOKEN" ]; then
        echo -e "${RED}错误: 未找到 FIGMA_TOKEN${NC}"
        echo "请设置环境变量或在 .env 文件中配置 FIGMA_TOKEN"
        echo ""
        echo "获取方法:"
        echo "  1. 登录 Figma > Settings > Account > Personal Access Tokens"
        echo "  2. 创建新 token 并设置环境变量"
        echo "  export FIGMA_TOKEN=your_token"
        exit 1
    fi
}

# 显示使用帮助
show_usage() {
    cat << EOF
用法: $0 <method> <endpoint> [options]

参数:
  method     必填，HTTP 方法: GET, POST, PUT, DELETE
  endpoint   必填，API 端点，如 /v1/files/ABC12345

选项:
  -d <data>  请求体数据（JSON 格式）
  -q <query> 查询参数（如 ids=node1,node2）
  -v         显示详细信息（verbose）

常用端点:
  GET    /v1/me                                     获取用户信息
  GET    /v1/files/{file_key}                       获取文件
  GET    /v1/files/{file_key}/nodes                 获取节点
  GET    /v1/images/{file_key}                      渲染图片
  GET    /v1/files/{file_key}/comments              获取评论
  POST   /v1/files/{file_key}/comments              创建评论
  GET    /v1/teams/{team_id}/projects               获取团队项目
  GET    /v1/teams/{team_id}/components             获取团队组件
  GET    /v1/files/{file_key}/variables/local      获取本地变量
  GET    /v2/webhooks                               获取 webhook 列表
  POST   /v2/webhooks                               创建 webhook

示例:
  $0 GET "/v1/me"
  $0 GET "/v1/files/ABC12345"
  $0 GET "/v1/images/ABC12345" -q "ids=node1&scale=2&format=png"
  $0 POST "/v1/files/ABC12345/comments" -d '{"message":"Great!"}'

EOF
    exit 1
}

# 验证 HTTP 方法
validate_method() {
    local method="$1"
    case "$method" in
        GET|POST|PUT|DELETE|PATCH)
            return 0
            ;;
        *)
            echo -e "${RED}错误: 不支持的 HTTP 方法 '$method'${NC}"
            echo "支持的方法: GET, POST, PUT, DELETE, PATCH"
            exit 1
            ;;
    esac
}

# 执行请求（带重试）
do_request() {
    local method="$1"
    local url="$2"
    local data="$3"
    local verbose="$4"
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        local response
        local http_code
        
        # 构建 curl 参数数组
        local curl_args=(
            -s
            -w '\n%{http_code}'
            -X "$method"
            -H "X-Figma-Token: $FIGMA_TOKEN"
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
        handle_response "$http_code" "$body" "$verbose"
        return $?
    done
    
    echo -e "${RED}错误: 请求失败，已达到最大重试次数${NC}" >&2
    return 1
}

# 处理响应
handle_response() {
    local http_code="$1"
    local body="$2"
    local verbose="$3"
    
    case "$http_code" in
        200|201|202|204)
            if [ "$verbose" = "true" ]; then
                echo -e "${GREEN}✓ 成功 (HTTP ${http_code})${NC}" >&2
            fi
            echo "$body"
            return 0
            ;;
        400)
            echo -e "${RED}✗ 请求参数错误 (HTTP 400)${NC}" >&2
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
    if [ $# -lt 2 ]; then
        show_usage
    fi
    
    if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
        show_usage
    fi
    
    local method="$1"
    local endpoint="$2"
    
    # 解析选项
    local data=""
    local query=""
    local verbose="false"
    
    shift 2
    while [ $# -gt 0 ]; do
        case "$1" in
            -d)
                data="$2"
                shift 2
                ;;
            -q)
                query="$2"
                shift 2
                ;;
            -v)
                verbose="true"
                shift
                ;;
            *)
                echo -e "${RED}错误: 未知选项 $1${NC}"
                show_usage
                ;;
        esac
    done
    
    # 验证方法
    validate_method "$method"
    
    # 检查 Token
    check_token
    
    # 构建完整 URL
    local url="${FIGMA_API_BASE}${endpoint}"
    
    # 添加查询参数
    if [ -n "$query" ]; then
        url="${url}?${query}"
    fi
    
    # 显示详细信息
    if [ "$verbose" = "true" ]; then
        echo -e "${YELLOW}请求信息:${NC}" >&2
        echo "  方法: ${method}" >&2
        echo "  URL: ${url}" >&2
        if [ -n "$data" ]; then
            echo "  请求体: ${data}" >&2
        fi
        echo "" >&2
    fi
    
    # 执行请求
    do_request "$method" "$url" "$data" "$verbose"
}

main "$@"
