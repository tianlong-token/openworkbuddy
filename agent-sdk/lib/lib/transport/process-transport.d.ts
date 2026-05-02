/**
 * Process Transport
 *
 * Transport implementation that spawns CLI process and communicates via stdin/stdout.
 */
import type { ControlRequest, ControlRequestPayload, Message, SubscriptionChannel, UserMessage } from '../types';
import type { NotificationHandler, ProcessTransportOptions, Transport } from './index';
/**
 * ProcessTransport - communicates with CLI via spawned process.
 */
export declare class ProcessTransport implements Transport {
    private process;
    private rl;
    private options;
    private messageStream;
    private controlRequestHandler?;
    private pendingRequests;
    private requestIdCounter;
    private closed;
    private _closeReason;
    private _stderrBuffer;
    private readyPromise;
    private _isCliReady;
    private _writeQueue;
    private _draining;
    private sdkMcpTransports;
    private sdkMcpServerInstances;
    private pendingMcpResponses;
    private _sdkMcpServerNames;
    private _cliVersion;
    private notificationHandlers;
    constructor(options?: ProcessTransportOptions);
    /**
     * Get the list of SDK MCP server names.
     * Used by Query/Session to include in initialize request.
     */
    get sdkMcpServerNames(): string[];
    /**
     * Set the model before connecting.
     * Must be called before connect() - has no effect after CLI process starts.
     */
    setModel(model: string): void;
    /**
     * Get the current model setting.
     */
    getModel(): string | undefined;
    /**
     * Set the permission mode before connecting.
     * Must be called before connect() - has no effect after CLI process starts.
     */
    setPermissionMode(mode: string): void;
    /**
     * Get the current permission mode setting.
     */
    getPermissionMode(): string | undefined;
    /**
     * Ensure the transport is ready for communication.
     * This method is idempotent - multiple calls return the same promise.
     *
     * @returns A promise that resolves when the transport is ready (CLI process started).
     */
    ensureReady(): Promise<void>;
    /**
     * Wait for the process to be created.
     */
    private waitForProcess;
    /**
     * Connect the transport - start CLI process in advance.
     * This allows reducing latency for the first message by
     * pre-spawning the CLI process before it's needed.
     *
     * @returns A promise that resolves when the transport is ready.
     */
    connect(): Promise<void>;
    /**
     * Apply thinking configuration to environment variables.
     */
    private applyThinkingEnv;
    /**
     * Inject a setting into --settings CLI arg (merges with existing).
     */
    private static injectSetting;
    /**
     * Build CLI arguments from options.
     * Only includes options that are supported by the CLI.
     */
    private buildArgs;
    /**
     * Start the transport - spawns CLI process.
     */
    start(): void;
    /**
     * Async generator for incoming messages.
     */
    messages(): AsyncGenerator<Message, void, unknown>;
    /**
     * Register a handler for incoming control requests (can_use_tool, hook_callback).
     * Control requests are dispatched to this handler directly in handleLine(),
     * bypassing the messageStream queue. This ensures they are always processed
     * even when the message consumer (for-await loop) has been cancelled.
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
     * Returns true only when CLI has produced its first output.
     */
    isReady(): boolean;
    /**
     * Register a handler for control notifications from a specific channel.
     */
    onNotification(channel: SubscriptionChannel, handler: NotificationHandler): void;
    /**
     * Remove a notification handler for a specific channel.
     */
    offNotification(channel: SubscriptionChannel, handler: NotificationHandler): void;
    /**
     * Close the transport.
     */
    close(): void;
    private handleLine;
    private handleControlNotification;
    private handleControlResponse;
    private handleClose;
    private handleError;
    private handleProcessError;
    private handleProcessExit;
    private setCloseReason;
    private writeLine;
    private _flushWriteQueue;
    /**
     * Extract SDK MCP servers from the mcpServers config.
     * SDK servers are identified by having type: 'sdk'.
     */
    private extractMcpServers;
    /**
     * Connect an SDK MCP server.
     */
    private connectSdkMcpServer;
    /**
     * Send an MCP message from server to CLI.
     */
    private sendMcpServerMessageToCli;
    /**
     * Handle MCP message control request from CLI.
     */
    private handleMcpMessageRequest;
    /**
     * Handle MCP request and wait for response from MCP server.
     */
    private handleMcpControlRequest;
}
//# sourceMappingURL=process-transport.d.ts.map