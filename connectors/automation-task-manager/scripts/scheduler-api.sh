#!/bin/bash
#
# Automation Task Manager - HTTP API Client
# 用于调用 scheduler API 进行任务管理
#
# 使用方法: ./scheduler-api.sh <action> [options]
# Actions: create | list | get | update | delete
#

set -e

# 默认配置
DEFAULT_TIMEZONE="Asia/Shanghai"
DEFAULT_TIMEOUT_SEC=300
DEFAULT_RETRY_COUNT=3
DEFAULT_PAGE_SIZE=20

# 打印帮助信息
print_help() {
    cat << 'EOF'
Usage: scheduler-api.sh <action> [options]

Actions:
  create    创建新任务 (必填: --name, --cron, --prompt, --frequency-type)
  list      获取任务列表 (可选: --page, --page-size, --status, --keyword)
  get       获取任务详情 (必填: --id)
  update    更新任务 (必填: --id, 可选: --name, --cron, --prompt, --status 等)
  delete    删除任务 (必填: --id)

Frequency Types:
  daily     每天执行 (每天X点、工作日、周末、每周X)
  interval  按间隔执行 (每X分钟、每X小时)
  once      单次执行 (指定日期时间只执行一次)

Examples:
  scheduler-api.sh create --name "日报提醒" --cron "0 0 21 * * *" --prompt "提醒写日报" --frequency-type daily
  scheduler-api.sh create --name "状态检查" --cron "0 0 * * * *" --prompt "检查服务状态" --frequency-type interval
  scheduler-api.sh list --status 1
  scheduler-api.sh update --id 123 --status 0
  scheduler-api.sh delete --id 123
EOF
}

# 默认 API 地址
DEFAULT_SCHEDULER_API_BASE_URL="http://auth.proxy/codebuddy"

# 检查环境变量，自动从 ACC_PRODUCT_CONFIG_V3 读取
check_env() {
    if [ -z "$SCHEDULER_API_BASE_URL" ]; then
        if [ -n "$ACC_PRODUCT_CONFIG_V3" ] && command -v jq &> /dev/null; then
            SCHEDULER_API_BASE_URL=$(echo "$ACC_PRODUCT_CONFIG_V3" | jq -r '.endpoint // empty')
        fi
    fi

    # 如果仍然为空，使用默认值
    if [ -z "$SCHEDULER_API_BASE_URL" ]; then
        SCHEDULER_API_BASE_URL="$DEFAULT_SCHEDULER_API_BASE_URL"
    fi

    export SCHEDULER_API_BASE_URL
}

# 格式化 JSON 输出
format_json() {
    if command -v jq &> /dev/null; then
        jq '.'
    else
        cat
    fi
}

# 校验 Cron 秒位必须为 0
validate_cron_seconds() {
    local cron_expr="$1"
    local cron_sec
    cron_sec=$(echo "$cron_expr" | awk '{print $1}')
    if [ "$cron_sec" != "0" ]; then
        echo "ERROR: 不允许秒级定时任务，Cron 秒位必须为 0（当前: $cron_sec）" >&2
        exit 1
    fi
}

# 发送 HTTP 请求并处理响应
do_request() {
    local method="$1"
    local url="$2"
    local data="$3"

    local curl_args=(-s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json")
    if [ -n "$data" ]; then
        curl_args+=(-d "$data")
    fi

    local response
    response=$(curl "${curl_args[@]}" "$url")

    local http_code
    http_code=$(echo "$response" | tail -n 1)
    local body
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo "$body" | format_json
    else
        echo "FAILED (HTTP $http_code)" >&2
        echo "$body" | format_json >&2
        exit 1
    fi
}

# 创建任务
create_task() {
    local name="" description="" cron_expr="" prompt=""
    local timezone="$DEFAULT_TIMEZONE" timeout_sec="$DEFAULT_TIMEOUT_SEC" retry_count="$DEFAULT_RETRY_COUNT"
    local frequency_type="" effective_start="" effective_end=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --name) name="$2"; shift 2 ;;
            --description) description="$2"; shift 2 ;;
            --cron) cron_expr="$2"; shift 2 ;;
            --prompt) prompt="$2"; shift 2 ;;
            --timezone) timezone="$2"; shift 2 ;;
            --timeout) timeout_sec="$2"; shift 2 ;;
            --retry-count) retry_count="$2"; shift 2 ;;
            --frequency-type) frequency_type="$2"; shift 2 ;;
            --effective-start) effective_start="$2"; shift 2 ;;
            --effective-end) effective_end="$2"; shift 2 ;;
            *) echo "ERROR: Unknown option: $1" >&2; exit 1 ;;
        esac
    done

    # 验证必填字段
    [ -z "$name" ] && { echo "ERROR: --name is required" >&2; exit 1; }
    [ -z "$cron_expr" ] && { echo "ERROR: --cron is required" >&2; exit 1; }
    [ -z "$prompt" ] && { echo "ERROR: --prompt is required" >&2; exit 1; }
    [ -z "$frequency_type" ] && { echo "ERROR: --frequency-type is required (daily/interval/once)" >&2; exit 1; }

    # 验证 frequency_type 值
    case "$frequency_type" in
        daily|interval|once) ;;
        *) echo "ERROR: --frequency-type must be one of: daily, interval, once" >&2; exit 1 ;;
    esac

    validate_cron_seconds "$cron_expr"

    # 构建 JSON
    local json_body
    json_body=$(jq -n \
        --arg name "$name" \
        --arg description "$description" \
        --arg cronExpr "$cron_expr" \
        --arg timezone "$timezone" \
        --arg prompt "$prompt" \
        --arg frequencyType "$frequency_type" \
        --argjson timeoutSec "$timeout_sec" \
        --argjson retryCount "$retry_count" \
        '{name: $name, description: $description, cronExpr: $cronExpr, timezone: $timezone, frequencyType: $frequencyType, agentConfig: {prompt: $prompt}, timeoutSec: $timeoutSec, retryCount: $retryCount}')

    [ -n "$effective_start" ] && json_body=$(echo "$json_body" | jq --arg v "$effective_start" '. + {effectiveStart: $v}')
    [ -n "$effective_end" ] && json_body=$(echo "$json_body" | jq --arg v "$effective_end" '. + {effectiveEnd: $v}')

    do_request POST "$SCHEDULER_API_BASE_URL/v2/as/scheduler/tasks" "$json_body"
}

# 获取任务列表
list_tasks() {
    local page=1 page_size="$DEFAULT_PAGE_SIZE" status="" keyword=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --page) page="$2"; shift 2 ;;
            --page-size) page_size="$2"; shift 2 ;;
            --status) status="$2"; shift 2 ;;
            --keyword) keyword="$2"; shift 2 ;;
            *) echo "ERROR: Unknown option: $1" >&2; exit 1 ;;
        esac
    done

    local query="page=$page&pageSize=$page_size"
    [ -n "$status" ] && query="$query&status=$status"
    [ -n "$keyword" ] && query="$query&keyword=$keyword"

    do_request GET "$SCHEDULER_API_BASE_URL/v2/as/scheduler/tasks?$query"
}

# 获取任务详情
get_task() {
    local task_id=""
    while [[ $# -gt 0 ]]; do
        case $1 in
            --id) task_id="$2"; shift 2 ;;
            *) echo "ERROR: Unknown option: $1" >&2; exit 1 ;;
        esac
    done

    [ -z "$task_id" ] && { echo "ERROR: --id is required" >&2; exit 1; }

    do_request GET "$SCHEDULER_API_BASE_URL/v2/as/scheduler/tasks/$task_id"
}

# 更新任务
update_task() {
    local task_id="" name="" description="" cron_expr="" prompt=""
    local timezone="" timeout_sec="" retry_count="" status=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --id) task_id="$2"; shift 2 ;;
            --name) name="$2"; shift 2 ;;
            --description) description="$2"; shift 2 ;;
            --cron) cron_expr="$2"; shift 2 ;;
            --prompt) prompt="$2"; shift 2 ;;
            --timezone) timezone="$2"; shift 2 ;;
            --timeout) timeout_sec="$2"; shift 2 ;;
            --retry-count) retry_count="$2"; shift 2 ;;
            --status) status="$2"; shift 2 ;;
            *) echo "ERROR: Unknown option: $1" >&2; exit 1 ;;
        esac
    done

    [ -z "$task_id" ] && { echo "ERROR: --id is required" >&2; exit 1; }

    [ -n "$cron_expr" ] && validate_cron_seconds "$cron_expr"

    # 构建 JSON（增量添加非空字段）
    local json_body="{}"
    [ -n "$name" ] && json_body=$(echo "$json_body" | jq --arg v "$name" '. + {name: $v}')
    [ -n "$description" ] && json_body=$(echo "$json_body" | jq --arg v "$description" '. + {description: $v}')
    [ -n "$cron_expr" ] && json_body=$(echo "$json_body" | jq --arg v "$cron_expr" '. + {cronExpr: $v}')
    [ -n "$prompt" ] && json_body=$(echo "$json_body" | jq --arg v "$prompt" '. + {agentConfig: {prompt: $v}}')
    [ -n "$timezone" ] && json_body=$(echo "$json_body" | jq --arg v "$timezone" '. + {timezone: $v}')
    [ -n "$timeout_sec" ] && json_body=$(echo "$json_body" | jq --argjson v "$timeout_sec" '. + {timeoutSec: $v}')
    [ -n "$retry_count" ] && json_body=$(echo "$json_body" | jq --argjson v "$retry_count" '. + {retryCount: $v}')
    [ -n "$status" ] && json_body=$(echo "$json_body" | jq --argjson v "$status" '. + {status: $v}')

    if [ "$(echo "$json_body" | jq 'length')" -eq 0 ]; then
        echo "ERROR: No update fields provided" >&2
        exit 1
    fi

    do_request PUT "$SCHEDULER_API_BASE_URL/v2/as/scheduler/tasks/$task_id" "$json_body"
}

# 删除任务
delete_task() {
    local task_id=""
    while [[ $# -gt 0 ]]; do
        case $1 in
            --id) task_id="$2"; shift 2 ;;
            *) echo "ERROR: Unknown option: $1" >&2; exit 1 ;;
        esac
    done

    [ -z "$task_id" ] && { echo "ERROR: --id is required" >&2; exit 1; }

    do_request DELETE "$SCHEDULER_API_BASE_URL/v2/as/scheduler/tasks/$task_id"
}

# 主函数
main() {
    if [ $# -eq 0 ]; then
        print_help
        exit 0
    fi

    local action="$1"
    shift

    case "$action" in
        create) check_env; create_task "$@" ;;
        list)   check_env; list_tasks "$@" ;;
        get)    check_env; get_task "$@" ;;
        update) check_env; update_task "$@" ;;
        delete) check_env; delete_task "$@" ;;
        help|--help|-h) print_help ;;
        *) echo "ERROR: Unknown action: $action" >&2; print_help; exit 1 ;;
    esac
}

main "$@"
