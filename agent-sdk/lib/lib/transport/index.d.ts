/**
 * Transport Layer
 *
 * Abstract interface for communication with CLI.
 */
import type { ControlNotificationMessage, ControlRequest, ControlRequestPayload, Effort, Message, SubscriptionChannel, ThinkingConfig, UserMessage } from '../types';
/**
 * Handler for control notifications from CLI.
 */
export type NotificationHandler = (notification: ControlNotificationMessage) => void;
/**
 * Transport interface - abstraction for CLI communication.
 */
export interface Transport {
    /**
     * Start the transport.
     */
    start(): void;
    /**
     * Ensure the transport is ready for communication.
     * This method is idempotent - multiple calls return the same promise.
     *
     * Implementation should:
     * 1. Return immediately if already ready
     * 2. Start connection if not started
     * 3. Wait for CLI to be truly ready (first output received)
     *
     * @returns A promise that resolves when the transport is ready.
     */
    ensureReady(): Promise<void>;
    /**
     * Connect the transport - start CLI process in advance.
     * This allows reducing latency for the first message by
     * pre-spawning the CLI process before it's needed.
     *
     * @returns A promise that resolves when the transport is ready.
     */
    connect(): Promise<void>;
    /**
     * Async generator for incoming messages.
     * Only yields regular messages — control requests are routed via onControlRequest().
     */
    messages(): AsyncGenerator<Message, void, unknown>;
    /**
     * Register a handler for incoming control requests (can_use_tool, hook_callback, etc.).
     * Control requests are dispatched to this handler directly in handleLine(),
     * so they are always processed regardless of whether the message consumer is active.
     * This prevents stale control requests when the consumer cancels mid-turn.
     */
    onControlRequest(handler: (request: ControlRequest) => void): void;
    /**
     * Send a user message to CLI.
     */
    sendUserMessage(content: string | UserMessage, traceId?: string, parentSpanId?: string): void;
    /**
     * Send a control request and wait for response.
     */
    sendControlRequest<T = Record<string, unknown>>(payload: ControlRequestPayload, timeoutMs?: number): Promise<T>;
    /**
     * Send a control request without waiting for response (fire-and-forget).
     * Use this when the response will be handled through other mechanisms (e.g., callbacks).
     */
    sendControlRequestNoWait(payload: ControlRequestPayload): void;
    /**
     * Send a control response.
     */
    sendControlResponse(requestId: string, response: Record<string, unknown>): void;
    /**
     * Send a control error response.
     */
    sendControlErrorResponse(requestId: string, error: string): void;
    /**
     * Check if transport is ready.
     */
    isReady(): boolean;
    /**
     * Close the transport.
     */
    close(): void;
    /**
     * Get the list of SDK MCP server names.
     * Used by Query/Session to include in initialize request.
     */
    readonly sdkMcpServerNames: string[];
    /**
     * Set the model before connecting.
     * Must be called before connect() - throws error after CLI process starts.
     */
    setModel(model: string): void;
    /**
     * Get the current model setting.
     */
    getModel(): string | undefined;
    /**
     * Set the permission mode before connecting.
     * Must be called before connect() - throws error after CLI process starts.
     */
    setPermissionMode(mode: string): void;
    /**
     * Get the current permission mode setting.
     */
    getPermissionMode(): string | undefined;
    /**
     * Register a handler for control notifications from a specific channel.
     * @param channel - The channel to listen to
     * @param handler - The handler function to call when notifications arrive
     */
    onNotification(channel: SubscriptionChannel, handler: NotificationHandler): void;
    /**
     * Remove a notification handler for a specific channel.
     * @param channel - The channel to stop listening to
     * @param handler - The handler function to remove
     */
    offNotification(channel: SubscriptionChannel, handler: NotificationHandler): void;
}
/**
 * Options for creating transports.
 */
export interface TransportOptions {
    /** Request timeout in milliseconds */
    requestTimeoutMs?: number;
}
/**
 * Options for ProcessTransport.
 * Only includes options that are supported by the CLI.
 */
export interface ProcessTransportOptions extends TransportOptions {
    /** Path to CLI executable */
    executablePath?: string;
    /** Working directory */
    cwd?: string;
    /** Environment variables */
    env?: Record<string, string | undefined>;
    /** Additional CLI arguments */
    args?: string[];
    /** Permission mode */
    permissionMode?: string;
    /** Additional directories (--add-dir) */
    additionalDirectories?: string[];
    /** Allowed tools (--allowedTools) */
    allowedTools?: string[];
    /** Disallowed tools (--disallowedTools) */
    disallowedTools?: string[];
    /** Built-in tools whitelist (--tools) */
    tools?: string[];
    /** Model (--model) */
    model?: string;
    /** Fallback model (--fallback-model) */
    fallbackModel?: string;
    /** Max turns (--max-turns) */
    maxTurns?: number;
    /** MCP servers config (--mcp-config), object or file path string */
    mcpServers?: Record<string, unknown> | string;
    /** Strict MCP config (--strict-mcp-config) */
    strictMcpConfig?: boolean;
    /** Setting sources (--setting-sources) */
    settingSources?: string[];
    /** Continue conversation (--continue) */
    continue?: boolean;
    /** Custom session ID (--session-id) */
    sessionId?: string;
    /** Resume session ID (--resume) */
    resume?: string;
    /** Fork session (--fork-session) */
    forkSession?: boolean;
    /** Dangerously skip permissions (-y) */
    dangerouslySkipPermissions?: boolean;
    /** Include partial messages (--include-partial-messages) */
    includePartialMessages?: boolean;
    /**
     * Maximum thinking tokens.
     * @deprecated Use `thinking` instead.
     */
    maxThinkingTokens?: number;
    /** Thinking configuration */
    thinking?: ThinkingConfig;
    /** Effort level for model reasoning */
    effort?: Effort;
    /** Extra args (custom flags) */
    extraArgs?: Record<string, string | null>;
    /** Stderr callback */
    stderr?: (data: string) => void;
    /** System prompt - override the entire system prompt */
    systemPrompt?: string;
    /** Append system prompt - append to the default system prompt */
    appendSystemPrompt?: string;
    /** JavaScript runtime to use (node, bun, deno) */
    executable?: 'node' | 'bun' | 'deno';
    /** Arguments to pass to the runtime */
    executableArgs?: string[];
}
/**
 * Create a transport that communicates with CLI via spawned process.
 */
export declare function createTransport(options?: ProcessTransportOptions): Transport;
export { ProcessTransport } from './process-transport';
//# sourceMappingURL=index.d.ts.map