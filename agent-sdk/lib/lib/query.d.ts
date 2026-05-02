/**
 * Query Implementation
 */
import type { AccountInfo, McpServerStatus, Message, ModelInfo, Options, PermissionMode, SlashCommand, UserMessage } from './types';
/**
 * Create a query for interacting with the agent.
 *
 * When `prompt` is omitted and `options.resume` is provided, the query will
 * return historical messages from the resumed session without triggering
 * a new agent response.
 */
export declare function query(params: {
    prompt?: string | AsyncIterable<UserMessage>;
    options?: Options;
}): Query;
/**
 * Query class - an AsyncGenerator that yields messages.
 */
export declare class Query implements AsyncGenerator<Message, void> {
    private prompt;
    private options?;
    private transport;
    private initialized;
    private abortController;
    private hookCallbacks;
    private iterator;
    private connectPromise;
    private lockedSessionId;
    private _sessionId;
    private _initialPermissionMode;
    private _initialModel;
    private _currentPermissionMode;
    private _currentModel;
    constructor(prompt: string | AsyncIterable<UserMessage> | undefined, options?: Options | undefined);
    [Symbol.asyncIterator](): AsyncGenerator<Message, void>;
    next(): Promise<IteratorResult<Message, void>>;
    return(): Promise<IteratorResult<Message, void>>;
    throw(e: Error): Promise<IteratorResult<Message, void>>;
    /**
     * Explicitly connect and initialize the query.
     * This is called automatically when iterating, but can be called
     * manually if you want to ensure the CLI is ready before iterating.
     *
     * Note: The constructor already triggers auto-connection, so this
     * method is mainly useful if you want to await the connection completion.
     *
     * @example
     * ```typescript
     * const q = query({ prompt: 'Hello' });
     * await q.connect();  // Wait for CLI process to be ready
     * for await (const msg of q) {
     *   // First message arrives faster
     * }
     * ```
     */
    connect(): Promise<void>;
    /**
     * Get the session ID to use for control requests.
     * Prefers the session_id captured from CLI messages, falls back to options.
     */
    private getSessionId;
    interrupt(): Promise<void>;
    /**
     * Set the permission mode for the query.
     * - Before iteration starts: only updates local state
     * - After iteration starts: sends fire-and-forget control request
     */
    setPermissionMode(mode: PermissionMode): Promise<void>;
    /**
     * Get the current permission mode.
     */
    getPermissionMode(): PermissionMode;
    /**
     * Set the model for the query.
     * - Before iteration starts: only updates local state
     * - After iteration starts: sends fire-and-forget control request
     */
    setModel(model?: string): Promise<void>;
    /**
     * Get the current model.
     */
    getModel(): string | undefined;
    setMaxThinkingTokens(maxThinkingTokens: number | null): Promise<void>;
    supportedCommands(): Promise<SlashCommand[]>;
    supportedModels(): Promise<ModelInfo[]>;
    mcpServerStatus(): Promise<McpServerStatus[]>;
    accountInfo(): Promise<AccountInfo>;
    streamInput(stream: AsyncIterable<UserMessage>): Promise<void>;
    private createIterator;
    private initialize;
    private sendPrompt;
    private handleControlRequest;
    private handlePermissionRequest;
    private handleHookCallback;
    private registeredHooks?;
    private registerHooks;
    private buildHooksConfig;
    /**
     * Cleanup all resources.
     */
    private cleanup;
}
//# sourceMappingURL=query.d.ts.map