/**
 * Genie Agent SDK Types
 */
export declare const HOOK_EVENTS: readonly ["PreToolUse", "PostToolUse", "PostToolUseFailure", "Notification", "UserPromptSubmit", "SessionStart", "SessionEnd", "Stop", "SubagentStart", "SubagentStop", "PreCompact", "PermissionRequest"];
export declare const EXIT_REASONS: readonly ["user_exit", "interrupt", "error", "end_turn", "max_turns", "max_budget_usd"];
export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'delegate' | 'dontAsk';
export type PermissionBehavior = 'allow' | 'deny' | 'ask';
export type PermissionUpdate = {
    type: 'addRules';
    rules: PermissionRuleValue[];
    behavior: PermissionBehavior;
    destination: PermissionUpdateDestination;
} | {
    type: 'replaceRules';
    rules: PermissionRuleValue[];
    behavior: PermissionBehavior;
    destination: PermissionUpdateDestination;
} | {
    type: 'removeRules';
    rules: PermissionRuleValue[];
    behavior: PermissionBehavior;
    destination: PermissionUpdateDestination;
} | {
    type: 'setMode';
    mode: PermissionMode;
    destination: PermissionUpdateDestination;
} | {
    type: 'addDirectories';
    directories: string[];
    destination: PermissionUpdateDestination;
} | {
    type: 'removeDirectories';
    directories: string[];
    destination: PermissionUpdateDestination;
};
export type PermissionUpdateDestination = 'userSettings' | 'projectSettings' | 'localSettings' | 'session' | 'cliArg';
export interface PermissionRuleValue {
    toolName: string;
    ruleContent?: string;
}
export type PermissionResult = {
    behavior: 'allow';
    updatedInput?: Record<string, unknown>;
    updatedPermissions?: PermissionUpdate[];
    toolUseID?: string;
} | {
    behavior: 'deny';
    message: string;
    interrupt?: boolean;
    toolUseID?: string;
};
export interface CanUseToolOptions {
    signal: AbortSignal;
    suggestions?: PermissionUpdate[];
    blockedPath?: string;
    decisionReason?: string;
    toolUseID: string;
    agentID?: string;
}
/**
 * Permission callback type.
 *
 * Use AskUserQuestionInput for type-safe access to AskUserQuestion tool input:
 * ```ts
 * const handler: CanUseTool = async (toolName, input, options) => {
 *     if (toolName === 'AskUserQuestion') {
 *         const askInput = input as AskUserQuestionInput;
 *         askInput.questions; // typed
 *     }
 * };
 * ```
 */
export type CanUseTool = (toolName: string, input: Record<string, unknown>, options: CanUseToolOptions) => Promise<PermissionResult>;
export type HookEvent = (typeof HOOK_EVENTS)[number];
export type ExitReason = (typeof EXIT_REASONS)[number];
export type HookCallback = (input: HookInput, toolUseID: string | undefined, options: {
    signal: AbortSignal;
}) => Promise<HookJSONOutput>;
export interface HookCallbackMatcher {
    matcher?: string;
    hooks: HookCallback[];
    timeout?: number;
}
export interface BaseHookInput {
    session_id: string;
    transcript_path: string;
    cwd: string;
    permission_mode?: string;
}
export type PreToolUseHookInput = BaseHookInput & {
    hook_event_name: 'PreToolUse';
    tool_name: string;
    tool_input: unknown;
    tool_use_id: string;
};
export type PostToolUseHookInput = BaseHookInput & {
    hook_event_name: 'PostToolUse';
    tool_name: string;
    tool_input: unknown;
    tool_response: unknown;
    tool_use_id: string;
};
export type PostToolUseFailureHookInput = BaseHookInput & {
    hook_event_name: 'PostToolUseFailure';
    tool_name: string;
    tool_input: unknown;
    tool_use_id: string;
    error: string;
    is_interrupt?: boolean;
};
export type NotificationHookInput = BaseHookInput & {
    hook_event_name: 'Notification';
    message: string;
    title?: string;
    notification_type: string;
};
export type UserPromptSubmitHookInput = BaseHookInput & {
    hook_event_name: 'UserPromptSubmit';
    prompt: string;
};
export type SessionStartHookInput = BaseHookInput & {
    hook_event_name: 'SessionStart';
    source: 'startup' | 'resume' | 'clear' | 'compact';
};
export type SessionEndHookInput = BaseHookInput & {
    hook_event_name: 'SessionEnd';
    reason: ExitReason;
};
export type StopHookInput = BaseHookInput & {
    hook_event_name: 'Stop';
    stop_hook_active: boolean;
};
export type SubagentStartHookInput = BaseHookInput & {
    hook_event_name: 'SubagentStart';
    agent_id: string;
    agent_type: string;
};
export type SubagentStopHookInput = BaseHookInput & {
    hook_event_name: 'SubagentStop';
    stop_hook_active: boolean;
    agent_id: string;
    agent_transcript_path: string;
};
export type PreCompactHookInput = BaseHookInput & {
    hook_event_name: 'PreCompact';
    trigger: 'manual' | 'auto';
    custom_instructions: string | null;
};
export type PermissionRequestHookInput = BaseHookInput & {
    hook_event_name: 'PermissionRequest';
    tool_name: string;
    tool_input: unknown;
    permission_suggestions?: PermissionUpdate[];
};
export type HookInput = PreToolUseHookInput | PostToolUseHookInput | PostToolUseFailureHookInput | NotificationHookInput | UserPromptSubmitHookInput | SessionStartHookInput | SessionEndHookInput | StopHookInput | SubagentStartHookInput | SubagentStopHookInput | PreCompactHookInput | PermissionRequestHookInput;
export interface AsyncHookJSONOutput {
    async: true;
    asyncTimeout?: number;
}
export interface SyncHookJSONOutput {
    continue?: boolean;
    suppressOutput?: boolean;
    stopReason?: string;
    decision?: 'approve' | 'block';
    systemMessage?: string;
    reason?: string;
    hookSpecificOutput?: Record<string, unknown>;
}
export type HookJSONOutput = AsyncHookJSONOutput | SyncHookJSONOutput;
export type ThinkingConfig = {
    type: 'adaptive';
} | {
    type: 'enabled';
    budgetTokens?: number;
} | {
    type: 'disabled';
};
/** Effort level for model reasoning. */
export type Effort = 'low' | 'medium' | 'high' | 'xhigh';
export type OutputFormatType = 'json_schema';
export interface JsonSchemaOutputFormat {
    type: 'json_schema';
    schema: Record<string, unknown>;
}
export type OutputFormat = JsonSchemaOutputFormat;
export interface McpStdioServerConfig {
    type?: 'stdio';
    command: string;
    args?: string[];
    env?: Record<string, string>;
}
export interface McpSSEServerConfig {
    type: 'sse';
    url: string;
    headers?: Record<string, string>;
}
export interface McpHttpServerConfig {
    type: 'http';
    url: string;
    headers?: Record<string, string>;
}
/**
 * SDK MCP Server config - for servers running within the SDK process.
 * Created via createSdkMcpServer().
 */
export interface McpSdkServerConfig {
    type: 'sdk';
    name: string;
    instance: unknown;
}
export type McpServerConfig = McpStdioServerConfig | McpSSEServerConfig | McpHttpServerConfig | McpSdkServerConfig;
export interface AskUserQuestionOption {
    /** The display text for this option (1-5 words) */
    label: string;
    /** Explanation of what this option means */
    description: string;
}
export interface AskUserQuestionQuestion {
    /** The complete question to ask (should end with ?) */
    question: string;
    /** Very short label displayed as a chip/tag (max 12 chars) */
    header: string;
    /** Available choices (2-4 options) */
    options: AskUserQuestionOption[];
    /** Allow multiple selections (default: false) */
    multiSelect: boolean;
}
export interface AskUserQuestionInput {
    /** Questions to ask the user (1-4 questions) */
    questions: AskUserQuestionQuestion[];
    /** User answers collected by the permission component */
    answers?: Record<string, string>;
    /** Index signature for Record<string, unknown> compatibility */
    [key: string]: unknown;
}
/**
 * Maps tool names to their input types.
 * Extend this interface to add type-safe handling for additional tools.
 */
export interface ToolInputMap {
    AskUserQuestion: AskUserQuestionInput;
}
/** Known tool names with typed inputs */
export type KnownToolName = keyof ToolInputMap;
export interface AgentDefinition {
    description: string;
    tools?: string[];
    disallowedTools?: string[];
    prompt: string;
    model?: string;
}
export interface SandboxSettings {
    enabled?: boolean;
    autoAllowBashIfSandboxed?: boolean;
    network?: {
        allowLocalBinding?: boolean;
        allowUnixSockets?: string[];
    };
}
/**
 * Information about an available skill (invoked via /command syntax).
 */
export interface SlashCommand {
    /** Skill name (without the leading slash) */
    name: string;
    /** Description of what the skill does */
    description: string;
    /** Hint for skill arguments (e.g., "<file>") */
    argumentHint: string;
}
export interface ModelInfo {
    value: string;
    displayName: string;
    description: string;
}
export interface AccountInfo {
    email?: string;
    organization?: string;
    subscriptionType?: string;
    tokenSource?: string;
    apiKeySource?: string;
}
export interface McpServerStatus {
    name: string;
    status: 'connected' | 'failed' | 'needs-auth' | 'pending';
    serverInfo?: {
        name: string;
        version: string;
    };
}
export interface TextContentBlock {
    type: 'text';
    text: string;
}
export interface ToolUseContentBlock {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
}
export interface ToolResultContentBlock {
    type: 'tool_result';
    tool_use_id: string;
    content?: string | ContentBlock[];
    is_error?: boolean;
}
/** Supported image media types */
export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
/** Base64-encoded image source */
export interface Base64ImageSource {
    type: 'base64';
    media_type: ImageMediaType;
    /** Base64-encoded image data */
    data: string;
}
/** URL-based image source */
export interface UrlImageSource {
    type: 'url';
    /** URL of the image */
    url: string;
}
/** Image content block for sending images in messages */
export interface ImageContentBlock {
    type: 'image';
    source: Base64ImageSource | UrlImageSource;
}
/**
 * Thinking content block containing the model's extended thinking process.
 * Only appears when extended thinking is enabled.
 * Field order matches official BetaThinkingBlock.
 */
export interface ThinkingContentBlock {
    type: 'thinking';
    /** Cryptographic signature for verification */
    signature: string;
    /** The model's thinking/reasoning content */
    thinking: string;
}
/**
 * Redacted thinking content block - contains encrypted thinking data.
 * Used when thinking content cannot be displayed (e.g., for safety reasons).
 */
export interface RedactedThinkingContentBlock {
    type: 'redacted_thinking';
    /** Encrypted/redacted thinking data */
    data: string;
}
export type ContentBlock = TextContentBlock | ToolUseContentBlock | ToolResultContentBlock | ImageContentBlock | ThinkingContentBlock | RedactedThinkingContentBlock;
export interface Usage {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
}
export type StopReason = 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | 'pause_turn' | 'refusal';
export interface MessageStartEvent {
    type: 'message_start';
    message: {
        id: string;
        type: 'message';
        role: 'assistant';
        model: string;
        content: ContentBlock[];
        stop_reason: StopReason | null;
        stop_sequence: string | null;
        usage: Usage;
    };
}
export interface ContentBlockStartEvent {
    type: 'content_block_start';
    index: number;
    content_block: {
        type: 'text';
        text: string;
        citations?: Array<unknown> | null;
    } | {
        type: 'tool_use';
        id: string;
        name: string;
        input: Record<string, unknown>;
    } | {
        type: 'thinking';
        thinking: string;
        signature: string;
    } | {
        type: 'redacted_thinking';
        data: string;
    };
}
export interface ThinkingDelta {
    type: 'thinking_delta';
    thinking: string;
}
export interface SignatureDelta {
    type: 'signature_delta';
    signature: string;
}
export interface ContentBlockDeltaEvent {
    type: 'content_block_delta';
    index: number;
    delta: {
        type: 'text_delta';
        text: string;
    } | {
        type: 'input_json_delta';
        partial_json: string;
    } | ThinkingDelta | SignatureDelta;
}
export interface ContentBlockStopEvent {
    type: 'content_block_stop';
    index: number;
}
export interface MessageDeltaEvent {
    type: 'message_delta';
    delta: {
        stop_reason: StopReason | null;
        stop_sequence: string | null;
    };
    usage?: {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
    };
}
export interface MessageStopEvent {
    type: 'message_stop';
}
export type RawMessageStreamEvent = MessageStartEvent | ContentBlockStartEvent | ContentBlockDeltaEvent | ContentBlockStopEvent | MessageDeltaEvent | MessageStopEvent;
export interface PermissionDenial {
    tool_name: string;
    tool_use_id: string;
    tool_input: Record<string, unknown>;
}
export interface SystemMessage {
    type: 'system';
    subtype: 'init';
    uuid: string;
    session_id: string;
    apiKeySource?: string;
    cwd?: string;
    tools: string[];
    mcp_servers?: Array<{
        name: string;
        status: string;
    }>;
    model: string;
    permissionMode: PermissionMode;
    slash_commands?: string[];
    output_style?: string;
    codebuddy_code_version?: string;
    skills?: string[];
    plugins?: Array<{
        name: string;
        path: string;
    }>;
}
export interface UserMessage {
    type: 'user';
    uuid?: string;
    session_id: string;
    message: {
        role: 'user';
        content: string | ContentBlock[];
    };
    parent_tool_use_id: string | null;
    isSynthetic?: boolean;
    tool_use_result?: unknown;
    trace_id?: string;
    parent_span_id?: string;
}
export interface AssistantMessage {
    type: 'assistant';
    uuid: string;
    session_id: string;
    message: {
        id: string;
        type: 'message';
        role: 'assistant';
        model: string;
        content: ContentBlock[];
        stop_reason: StopReason | null;
        stop_sequence: string | null;
        usage: Usage;
    };
    parent_tool_use_id: string | null;
    error?: string;
}
export interface PartialAssistantMessage {
    type: 'stream_event';
    event: RawMessageStreamEvent;
    parent_tool_use_id: string | null;
    uuid: string;
    session_id: string;
}
export type ResultMessage = {
    type: 'result';
    subtype: 'success';
    uuid: string;
    session_id: string;
    duration_ms: number;
    duration_api_ms: number;
    is_error: boolean;
    num_turns: number;
    result: string;
    total_cost_usd: number;
    usage: Usage;
    permission_denials: PermissionDenial[];
    structured_output?: unknown;
} | {
    type: 'result';
    subtype: 'error_during_execution' | 'error_max_turns' | 'error_max_budget_usd';
    uuid: string;
    session_id: string;
    duration_ms: number;
    duration_api_ms: number;
    is_error: boolean;
    num_turns: number;
    total_cost_usd: number;
    usage: Usage;
    permission_denials: PermissionDenial[];
    errors?: string[];
};
export interface CompactBoundaryMessage {
    type: 'system';
    subtype: 'compact_boundary';
    uuid: string;
    session_id: string;
    compact_metadata: {
        trigger: 'manual' | 'auto';
        pre_tokens: number;
    };
}
export interface StatusMessage {
    type: 'system';
    subtype: 'status';
    status: 'compacting' | null;
    uuid: string;
    session_id: string;
}
export interface ToolProgressMessage {
    type: 'tool_progress';
    tool_use_id: string;
    tool_name: string;
    parent_tool_use_id: string | null;
    elapsed_time_seconds: number;
    uuid: string;
    session_id: string;
}
export interface ErrorMessage {
    type: 'error';
    error: string;
    session_id?: string;
}
/**
 * Topic message for session title/topic updates.
 * Used to update the session's human-readable title.
 */
export interface TopicMessage {
    type: 'topic';
    topic: string;
    session_id: string;
}
/**
 * File history snapshot message.
 * Contains tracked file backup information for checkpoint diff computation.
 */
export interface FileHistorySnapshotMessage {
    type: 'file-history-snapshot';
    timestamp: number;
    isSnapshotUpdate: boolean;
    snapshot: {
        messageId: string;
        trackedFileBackups: Record<string, {
            backupFileName?: string;
            version: number;
            backupTime: number;
        }>;
    };
    id?: string;
    parentId?: string;
}
/**
 * @experimental _requestId is an experimental field that may change in future versions.
 */
export type Message = (SystemMessage | UserMessage | AssistantMessage | PartialAssistantMessage | ResultMessage | CompactBoundaryMessage | StatusMessage | ToolProgressMessage | ErrorMessage | TopicMessage | FileHistorySnapshotMessage) & {
    /** @experimental */
    _requestId?: string;
};
/**
 * Predefined authentication environments.
 * @experimental This API is unstable and may change in future versions.
 */
export type AuthEnvironment = 'external' | 'internal' | 'ioa' | 'cloudhosted';
/**
 * Authentication state containing the login URL.
 * @experimental This API is unstable and may change in future versions.
 */
export interface AuthState {
    /** Authentication state ID */
    state: string;
    /** Login URL to open in browser */
    authUrl: string;
}
/**
 * User information after successful authentication.
 * @experimental This API is unstable and may change in future versions.
 */
export interface Userinfo {
    userId: string;
    userName: string;
    userNickname: string;
    token: string;
    enterpriseId?: string;
    enterprise?: string;
}
/**
 * Parameters for the authenticate method.
 * @experimental This API is unstable and may change in future versions.
 */
export interface AuthenticateParams {
    /** Predefined environment (mutually exclusive with endpoint) */
    environment?: AuthEnvironment;
    /** Custom endpoint URL for selfhosted environment (mutually exclusive with environment) */
    endpoint?: string;
    /** Authentication method ID (default: 'external') */
    methodId?: string;
    /** Callback invoked when a login URL is ready - open this URL in browser */
    onAuthUrl: (authState: AuthState) => void | Promise<void>;
    /** Timeout in milliseconds (default: 5 minutes) */
    timeout?: number;
}
/**
 * Response from successful authentication.
 * @experimental This API is unstable and may change in future versions.
 */
export interface AuthenticateResponse {
    userinfo: Userinfo;
}
/**
 * Authentication error types.
 * @experimental This API is unstable and may change in future versions.
 */
export type AuthenticationErrorType = 'timeout' | 'cancelled' | 'network_error' | 'invalid_method' | 'auth_failed';
export interface Query extends AsyncGenerator<Message, void> {
    interrupt(): Promise<void>;
    setPermissionMode(mode: PermissionMode): Promise<void>;
    setModel(model?: string): Promise<void>;
    setMaxThinkingTokens(maxThinkingTokens: number | null): Promise<void>;
    /**
     * Get the list of available skills for the current session.
     * @returns Array of available skills with their names and descriptions
     */
    supportedCommands(): Promise<SlashCommand[]>;
    supportedModels(): Promise<ModelInfo[]>;
    mcpServerStatus(): Promise<McpServerStatus[]>;
    accountInfo(): Promise<AccountInfo>;
    streamInput(stream: AsyncIterable<UserMessage>): Promise<void>;
}
export type SettingSource = 'user' | 'project' | 'local';
export interface Options {
    /** Controller for cancelling the query */
    abortController?: AbortController;
    /** Additional directories Claude can access */
    additionalDirectories?: string[];
    /** Predefined environment for authentication */
    environment?: AuthEnvironment;
    /** Custom endpoint URL for selfhosted environment */
    endpoint?: string;
    /** Custom subagent definitions */
    agents?: Record<string, AgentDefinition>;
    /**
     * List of tool names that are auto-allowed without prompting for permission.
     * These tools will execute automatically without asking the user for approval.
     * To restrict which tools are available, use the `tools` option instead.
     */
    allowedTools?: string[];
    /** Custom permission handler */
    canUseTool?: CanUseTool;
    /** Continue the most recent conversation */
    continue?: boolean;
    /** Current working directory */
    cwd?: string;
    /**
     * List of tool names that are disallowed. When the model attempts to use
     * these tools, the request will be denied. MCP tools matching this list
     * are also filtered from the model's context.
     */
    disallowedTools?: string[];
    /** Environment variables */
    env?: Record<string, string | undefined>;
    /** JavaScript runtime */
    executable?: 'bun' | 'deno' | 'node';
    /** Additional runtime arguments */
    executableArgs?: string[];
    /** Additional CLI arguments */
    extraArgs?: Record<string, string | null>;
    /** Fallback model */
    fallbackModel?: string;
    /** Enable file checkpointing */
    enableFileCheckpointing?: boolean;
    /** Fork session when resuming */
    forkSession?: boolean;
    /** Hook callbacks */
    hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
    /** Include partial/streaming messages for real-time text rendering */
    includePartialMessages?: boolean;
    /** Disable session persistence */
    persistSession?: boolean;
    /**
     * Maximum thinking tokens.
     * @deprecated Use `thinking` instead.
     */
    maxThinkingTokens?: number;
    /**
     * Thinking configuration for the model.
     *
     * - `{ type: 'adaptive' }`: Adaptive thinking (up to 32,000 tokens)
     * - `{ type: 'enabled', budgetTokens: N }`: Fixed token budget
     * - `{ type: 'disabled' }`: Disable thinking
     */
    thinking?: ThinkingConfig;
    /** Effort level for model reasoning. */
    effort?: Effort;
    /** Maximum conversation turns */
    maxTurns?: number;
    /** Maximum budget in USD */
    maxBudgetUsd?: number;
    /** MCP server configurations (object or file path string) */
    mcpServers?: Record<string, McpServerConfig> | string;
    /** Model to use */
    model?: string;
    /** Output format configuration */
    outputFormat?: OutputFormat;
    /** Path to CLI executable */
    pathToCodebuddyCode?: string;
    /** Request timeout for control requests (milliseconds) */
    requestTimeoutMs?: number;
    /** Permission mode */
    permissionMode?: PermissionMode;
    /** Require explicit flag for bypassPermissions */
    allowDangerouslySkipPermissions?: boolean;
    /** MCP tool name for permission prompts */
    permissionPromptToolName?: string;
    /** Session ID to resume */
    resume?: string;
    /** Custom session ID for creating new sessions */
    sessionId?: string;
    /** Resume at specific message ID */
    resumeSessionAt?: string;
    /** Sandbox settings */
    sandbox?: SandboxSettings;
    /** Settings sources to load */
    settingSources?: SettingSource[];
    /** Stderr callback */
    stderr?: (data: string) => void;
    /** Strict MCP config validation */
    strictMcpConfig?: boolean;
    /**
     * System prompt configuration.
     *
     * - `string`: Override the entire system prompt
     * - `{ append: string }`: Append to the default system prompt
     */
    systemPrompt?: string | {
        append: string;
    };
    /**
     * Restrict which built-in tools CodeBuddy can use (whitelist).
     * - undefined (default): Use all available built-in tools
     * - []: Disable all built-in tools
     * - ["Bash", "Read"]: Only specified built-in tools are available
     */
    tools?: string[];
    /** Trace ID for distributed tracing. Propagated to CLI and model requests. */
    traceId?: string;
    /** Parent span ID from upstream caller, used to link CLI trace as child of upstream span. */
    parentSpanId?: string;
}
export interface SessionOptions {
    /** Custom session ID for the conversation */
    sessionId?: string;
    /** Predefined environment for authentication */
    environment?: AuthEnvironment;
    /** Custom endpoint URL for selfhosted environment */
    endpoint?: string;
    /** Model to use */
    model?: string;
    /** Path to CLI executable */
    pathToCodebuddyCode?: string;
    /** Executable to use */
    executable?: 'node' | 'bun' | 'deno';
    /** Arguments to pass to executable */
    executableArgs?: string[];
    /** Working directory for the CLI process */
    cwd?: string;
    /** Environment variables */
    env?: Record<string, string | undefined>;
    /** Request timeout for control requests (milliseconds) */
    requestTimeoutMs?: number;
    /** MCP server configurations (object or file path string) */
    mcpServers?: Record<string, McpServerConfig> | string;
    /** Strict MCP config validation */
    strictMcpConfig?: boolean;
    /** Custom permission handler */
    canUseTool?: CanUseTool;
    /** Hook callbacks */
    hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
    /**
     * System prompt configuration.
     *
     * - `string`: Override the entire system prompt
     * - `{ append: string }`: Append to the default system prompt
     */
    systemPrompt?: string | {
        append: string;
    };
    /**
     * List of tool names that are auto-allowed without prompting for permission.
     * These tools will execute automatically without asking the user for approval.
     */
    allowedTools?: string[];
    /**
     * List of tool names that are disallowed. When the model attempts to use
     * these tools, the request will be denied.
     */
    disallowedTools?: string[];
    /** Permission mode */
    permissionMode?: PermissionMode;
    /** Maximum conversation turns */
    maxTurns?: number;
    /**
     * Include partial/streaming messages for real-time text rendering.
     * When enabled, receives PartialAssistantMessage events with fine-grained streaming data.
     */
    includePartialMessages?: boolean;
    /**
     * Callback invoked when the agent enters plan mode.
     * @param planFilePath - Path to the plan file being created
     * @param previousMode - The permission mode before entering plan mode
     */
    onPlanModeEnter?: (planFilePath: string, previousMode: PermissionMode) => void;
    /**
     * Callback invoked when the agent exits plan mode.
     * @param planFilePath - Path to the plan file
     * @param planContent - The content of the plan
     */
    onPlanModeExit?: (planFilePath: string, planContent: string) => void;
    /**
     * Restrict which built-in tools CodeBuddy can use (whitelist).
     * - undefined (default): Use all available built-in tools
     * - []: Disable all built-in tools
     * - ["Bash", "Read"]: Only specified built-in tools are available
     */
    tools?: string[];
    /**
     * Extra CLI arguments to pass to the CodeBuddy CLI.
     * Key is the flag name (without --), value is the flag value (or null for boolean flags).
     * Example: { 'replay-user-messages': null } adds --replay-user-messages
     */
    extraArgs?: Record<string, string | null>;
    /**
     * Settings sources to load from filesystem.
     * By default, SDK doesn't load any filesystem settings for clean environment isolation.
     * Set to ['user'] to load ~/.codebuddy/settings.json (enables user hooks).
     * Set to ['user', 'project'] to also load project-level settings.
     */
    settingSources?: SettingSource[];
    /** Custom subagent definitions */
    agents?: Record<string, AgentDefinition>;
    /**
     * Maximum thinking tokens.
     * @deprecated Use `thinking` instead.
     */
    maxThinkingTokens?: number;
    /**
     * Thinking configuration for the model.
     *
     * - `{ type: 'adaptive' }`: Adaptive thinking (up to 32,000 tokens)
     * - `{ type: 'enabled', budgetTokens: N }`: Fixed token budget
     * - `{ type: 'disabled' }`: Disable thinking
     */
    thinking?: ThinkingConfig;
    /** Effort level for model reasoning. */
    effort?: Effort;
}
export interface Session {
    readonly sessionId: string;
    /** Connect the session (must be called before send/stream) */
    connect(): Promise<void>;
    send(message: string | UserMessage): Promise<void>;
    /** Stream messages from the agent */
    stream(): AsyncGenerator<Message, void>;
    close(): void;
    [Symbol.asyncDispose](): Promise<void>;
    /**
     * Set the permission mode for the session.
     * - Before connect(): modifies transport options (passed as CLI argument)
     * - After connect(): sends control request to CLI
     */
    setPermissionMode(mode: PermissionMode): Promise<void>;
    /**
     * Get the current permission mode of the session.
     */
    getPermissionMode(): PermissionMode;
    /**
     * Get the current model of the session.
     */
    getModel(): string | undefined;
    /**
     * Set the model for the session.
     * - Before connect(): modifies transport options (passed as CLI argument)
     * - After connect(): sends control request to CLI
     */
    setModel(model: string): Promise<void>;
    /**
     * Set configuration key-value pairs for the session.
     * Sends a set_config control request to CLI to update settings dynamically.
     * Only works after connect() (requires active CLI process).
     */
    setConfig(config: Record<string, unknown>): Promise<void>;
    /**
     * Get available permission modes from the CLI.
     * @experimental This requires CLI support for 'get_available_modes' control request.
     */
    getAvailableModes(): Promise<Array<{
        id: string;
        name: string;
        description: string;
    }>>;
    /**
     * Get available models from the CLI (simplified format).
     * @experimental This requires CLI support for 'get_available_models' control request.
     */
    getAvailableModels(): Promise<Array<{
        modelId: string;
        name: string;
        description?: string;
    }>>;
    /**
     * Get available models from the CLI with full configuration details.
     * Returns complete model information including capabilities, token limits, etc.
     * @experimental This requires CLI support for 'get_available_models' control request.
     */
    getAvailableModelsRaw(): Promise<RawLanguageModel[]>;
    /**
     * Update hook callbacks without sending a control request to CLI.
     * The hook event structure (events, matchers) was established during initialize().
     * This just replaces the callback functions for existing hook IDs.
     */
    setHooks(hooks: Partial<Record<HookEvent, HookCallbackMatcher[]>>): void;
    /**
     * Set the permission handler for tool usage.
     * Can be called to override or wrap the existing canUseTool handler.
     *
     * @param handler - The permission handler function
     */
    setCanUseTool(handler: CanUseTool): void;
    /**
     * Get the current permission handler for tool usage.
     * Returns the overridden handler if set, otherwise the original from options.
     * Returns undefined if no handler is configured.
     */
    getCanUseTool(): CanUseTool | undefined;
    /**
     * Check if the session has pending history messages to consume.
     * Returns true if:
     * - Session was created with resumeSession
     * - No messages have been sent yet
     * - History hasn't been consumed yet
     *
     * This is used by AcpAgent to determine whether to stream history
     * during loadSession.
     */
    hasPendingHistory(): boolean;
    /**
     * Interrupt the current prompt execution.
     * Sends an interrupt control request to the CLI to stop processing.
     */
    interrupt(): Promise<void>;
    /**
     * Get available commands from the CLI.
     * Subscribes to the commands channel and returns the current list of available commands.
     * @experimental This requires CLI support for commands channel subscription.
     */
    getAvailableCommands(): Promise<AvailableCommand[]>;
    /**
     * Subscribe to commands channel and receive all command updates via callback.
     * The handler will be called for every commands notification from CLI.
     * Use this for persistent listening to command changes instead of one-shot getAvailableCommands().
     * @experimental This requires CLI support for commands channel subscription.
     */
    subscribeToCommands(handler: (notification: ControlNotificationMessage) => void): Promise<void>;
    /**
     * Unsubscribe a handler from the commands channel.
     * @param handler - The handler to remove
     * @experimental This requires CLI support for commands channel subscription.
     */
    unsubscribeFromCommands(handler: (notification: ControlNotificationMessage) => void): void;
}
/**
 * SDK Capabilities
 * Declares what capabilities the SDK supports
 */
export interface SdkCapabilities {
    /** SDK supports handling AskUserQuestion tool via canUseTool callback */
    askUserQuestion?: boolean;
}
export interface ControlInitializeRequest {
    subtype: 'initialize';
    hooks?: Partial<Record<HookEvent, Array<{
        matcher?: string;
        hookCallbackIds: string[];
        timeout?: number;
    }>>>;
    sdkMcpServers?: string[];
    jsonSchema?: Record<string, unknown>;
    systemPrompt?: string;
    appendSystemPrompt?: string;
    agents?: Record<string, unknown>;
    /** Predefined environment for authentication */
    environment?: AuthEnvironment;
    /** Custom endpoint URL for selfhosted environment */
    endpoint?: string;
    /** SDK capabilities declaration */
    capabilities?: SdkCapabilities;
    /** Whether a prompt will be sent after initialization (used for resume history decision) */
    hasPrompt?: boolean;
}
export interface ControlInitializeResponse {
    /** The current model ID resolved by CLI */
    currentModelId?: string;
}
export interface ControlInterruptRequest {
    subtype: 'interrupt';
    session_id?: string;
    reason?: string;
}
export interface ControlSetPermissionModeRequest {
    subtype: 'set_permission_mode';
    session_id?: string;
    mode: PermissionMode;
}
export interface ControlSetModelRequest {
    subtype: 'set_model';
    session_id?: string;
    model?: string;
}
/**
 * Set config request - batch set configuration key-value pairs.
 * Used by ACP session/set_config_option to dynamically update CLI settings.
 */
export interface ControlSetConfigRequest {
    subtype: 'set_config';
    session_id?: string;
    config: Record<string, unknown>;
}
/**
 * Set config response.
 */
export interface ControlSetConfigResponse {
    session_id: string;
    updated: Record<string, unknown>;
    errors?: Record<string, string>;
}
/**
 * Get available permission modes request.
 * @experimental This API requires CLI support and may change in future versions.
 */
export interface ControlGetAvailableModesRequest {
    subtype: 'get_available_modes';
    session_id?: string;
}
/**
 * Get available permission modes response.
 * @experimental This API requires CLI support and may change in future versions.
 */
export interface ControlGetAvailableModesResponse {
    availableModes: Array<{
        id: string;
        name: string;
        description: string;
    }>;
}
/**
 * Get available models request.
 * @experimental This API requires CLI support and may change in future versions.
 */
export interface ControlGetAvailableModelsRequest {
    subtype: 'get_available_models';
}
/**
 * Raw language model configuration with full details.
 * Contains all model capabilities and settings (excludes sensitive fields like url/apiKey).
 * @experimental This API requires CLI support and may change in future versions.
 */
export interface RawLanguageModel {
    id: string;
    name?: string;
    vendor?: string;
    version?: string;
    family?: string;
    maxInputTokens?: number;
    maxOutputTokens?: number;
    description?: string;
    descriptionEn?: string;
    descriptionZh?: string;
    configurable?: boolean;
    configured?: boolean;
    supportsExtra?: boolean;
    supportsToolCall?: boolean;
    supportsImages?: boolean;
    supportsReasoning?: boolean;
    onlyReasoning?: boolean;
    maxAllowedSize?: number;
    tags?: string[];
    disabledMultimodal?: boolean;
    credits?: string;
    reasoning?: {
        effort?: 'minimal' | 'low' | 'medium' | 'high';
        summary?: 'auto' | 'concise' | 'detailed';
    };
    maxImageCount?: number;
    isDefault?: boolean;
    temperature?: number;
    iconUrl?: string;
    modelType?: 'enterprise' | 'built-in';
    trustLevel?: 'unverified' | 'custom' | 'certified';
    disabled?: boolean;
    disabledReason?: string;
    disabledAction?: {
        type: 'link' | 'applyGroup';
        text?: string;
        link?: string;
    };
    relatedModels?: Partial<Record<'lite' | 'reasoning' | 'vision' | 'longContext' | 'subagent', string>>;
}
/**
 * Get available models response.
 * @experimental This API requires CLI support and may change in future versions.
 */
export interface ControlGetAvailableModelsResponse {
    /** Simplified model list (backward compatible) */
    availableModels: Array<{
        modelId: string;
        name: string;
        description?: string;
    }>;
    /** Full raw model configurations */
    rawModels?: RawLanguageModel[];
}
export interface ControlSetMaxThinkingTokensRequest {
    subtype: 'set_max_thinking_tokens';
    session_id?: string;
    max_thinking_tokens: number | null;
}
export interface ControlHookCallbackRequest {
    subtype: 'hook_callback';
    callback_id: string;
    input: HookInput;
    tool_use_id?: string;
}
export interface ControlPermissionRequest {
    subtype: 'can_use_tool';
    tool_name: string;
    input: Record<string, unknown>;
    permission_suggestions?: unknown[];
    blocked_path?: string;
    decision_reason?: string;
    tool_use_id: string;
    agent_id?: string;
}
/**
 * MCP message request - for forwarding MCP messages between SDK and CLI.
 */
export interface ControlMcpMessageRequest {
    subtype: 'mcp_message';
    server_name: string;
    message: JSONRPCMessage;
}
/**
 * JSON-RPC 2.0 message types for MCP communication.
 */
export type JSONRPCMessage = JSONRPCRequest | JSONRPCResponse | JSONRPCNotification;
export interface JSONRPCRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: unknown;
}
export interface JSONRPCResponse {
    jsonrpc: '2.0';
    id: string | number | null;
    result?: unknown;
    error?: JSONRPCError;
}
export interface JSONRPCNotification {
    jsonrpc: '2.0';
    method: string;
    params?: unknown;
}
export interface JSONRPCError {
    code: number;
    message: string;
    data?: unknown;
}
/**
 * Logout request - clears cached authentication token.
 * @experimental This API is unstable and may change in future versions.
 */
export interface ControlLogoutRequest {
    subtype: 'logout';
    environment?: AuthEnvironment;
    endpoint?: string;
}
/**
 * Supported subscription channels.
 */
export type SubscriptionChannel = 'commands';
/**
 * Subscribe request - subscribe to a channel for push notifications.
 */
export interface ControlSubscribeRequest {
    subtype: 'subscribe';
    channel: SubscriptionChannel;
}
/**
 * Subscribe response.
 */
export interface ControlSubscribeResponse {
    subscribed: boolean;
    channel: SubscriptionChannel;
}
/**
 * Unsubscribe request.
 */
export interface ControlUnsubscribeRequest {
    subtype: 'unsubscribe';
    channel: SubscriptionChannel;
}
/**
 * Unsubscribe response.
 */
export interface ControlUnsubscribeResponse {
    unsubscribed: boolean;
    channel: SubscriptionChannel;
}
/**
 * Control notification message - pushed from CLI to SDK.
 */
export interface ControlNotificationMessage {
    type: 'control_notification';
    channel: SubscriptionChannel;
    data: unknown;
}
/**
 * Available command for ACP protocol.
 * Represents a slash command that can be used in the session.
 */
export interface AvailableCommand {
    /** Command name without leading '/' */
    name: string;
    /** Description of what the command does */
    description: string;
    /** Optional input hint for command arguments */
    input?: {
        hint: string;
    };
}
/**
 * Commands notification data from the commands channel.
 */
export interface CommandsNotificationData {
    commands: Array<{
        name: string;
        description?: string;
        argumentHint?: string;
    }>;
    timestamp: number;
}
export type ControlRequestPayload = ControlInitializeRequest | ControlInterruptRequest | ControlSetPermissionModeRequest | ControlSetModelRequest | ControlSetConfigRequest | ControlGetAvailableModesRequest | ControlGetAvailableModelsRequest | ControlSetMaxThinkingTokensRequest | ControlHookCallbackRequest | ControlPermissionRequest | ControlMcpMessageRequest | ControlLogoutRequest | ControlSubscribeRequest | ControlUnsubscribeRequest;
export interface ControlRequest {
    type: 'control_request';
    request_id: string;
    request: ControlRequestPayload;
}
export interface ControlResponse {
    subtype: 'success';
    request_id: string;
    response?: Record<string, unknown>;
}
export interface ControlErrorResponse {
    subtype: 'error';
    request_id: string;
    error: string;
}
export interface ControlResponseMessage {
    type: 'control_response';
    response: ControlResponse | ControlErrorResponse;
}
export type ControlSignalMessage = ControlRequest | ControlResponseMessage;
//# sourceMappingURL=types.d.ts.map