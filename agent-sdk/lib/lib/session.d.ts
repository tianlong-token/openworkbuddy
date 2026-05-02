/**
 * V2 Session API
 *
 * Multi-turn conversation support.
 */
import type { AvailableCommand, CanUseTool, ControlNotificationMessage, HookCallbackMatcher, HookEvent, Message, PermissionMode, RawLanguageModel, ResultMessage, SessionOptions, UserMessage } from './types';
/**
 * Create a new session for multi-turn conversations.
 */
export declare function createSession(options: SessionOptions): SessionImpl;
/**
 * Resume an existing session by ID.
 */
export declare function resumeSession(sessionId: string, options: SessionOptions): SessionImpl;
/**
 * One-shot convenience function for single prompts.
 */
export declare function prompt(message: string, options: SessionOptions): Promise<ResultMessage>;
/**
 * Session class for multi-turn conversations.
 */
export declare class SessionImpl {
    private options;
    private _transport;
    private _sessionId;
    private _initialized;
    private _initPromise;
    private closed;
    private messageIterator;
    private abortController;
    private hookCallbacks;
    private registeredHooks?;
    private _currentPermissionMode;
    private _currentModel;
    private lockedSessionId;
    private isResumeSession;
    private resumeSessionId?;
    private hasSentMessage;
    private historyConsumed;
    private overriddenCanUseTool?;
    constructor(options: SessionOptions, resumeSessionId?: string);
    /**
     * The session ID. Always available immediately after session creation.
     * The ID is either user-provided via options.sessionId, or auto-generated.
     */
    get sessionId(): string;
    /**
     * Get the session ID for control requests.
     * Prefers session_id captured from CLI messages, falls back to options.
     */
    private getSessionIdForControl;
    /**
     * Send a message to the agent.
     */
    send(message: string | UserMessage): Promise<void>;
    /**
     * Stream messages from the agent.
     *
     * In resume mode, the first call to stream() without a prior send() will
     * return historical messages from the session. Subsequent calls after
     * send() will return only new responses.
     */
    stream(): AsyncGenerator<Message, void>;
    /**
     * Close the session.
     */
    close(): void;
    /**
     * Async disposal support.
     */
    [Symbol.asyncDispose](): Promise<void>;
    /**
     * Interrupt the current prompt execution.
     * Aborts the local abort controller and sends an interrupt control request to the CLI.
     */
    interrupt(): Promise<void>;
    /**
     * Set the permission mode for the session.
     * - Before connect(): modifies transport options (will be passed as CLI argument)
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
     * - Before connect(): modifies transport options (will be passed as CLI argument)
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
     * This removes the handler from receiving future notifications.
     * Note: This does not send an unsubscribe request to CLI, it only removes the local handler.
     * @param handler - The handler to remove
     */
    unsubscribeFromCommands(handler: (notification: ControlNotificationMessage) => void): void;
    /**
     * Explicitly connect and initialize the session.
     * This is called automatically when send() or stream() is called,
     * but can be called manually for prewarming.
     *
     * **Important**: Set mode/model BEFORE calling connect() for best results:
     * ```typescript
     * const session = createSession({ cwd: '.' });
     * await session.setPermissionMode('bypassPermissions');  // Modifies transport options
     * await session.setModel('claude-sonnet-4-20250514');    // Modifies transport options
     * await session.connect();  // CLI starts with --permission-mode and --model args
     * await session.send('hello');
     * ```
     *
     * If you call setMode/setModel after connect(), they will send control
     * requests to CLI instead (awaits response).
     */
    connect(): Promise<void>;
    /**
     * Get a ready-to-use transport.
     * Ensures connection and initialization are complete before returning.
     * This method is idempotent - multiple calls return the same promise until ready.
     */
    private transport;
    /**
     * Perform actual initialization (called once by transport()).
     */
    private doInitialize;
    private handleControlRequest;
    private handlePermissionRequest;
    private registerHooks;
    private buildHooksConfig;
    private handleHookCallback;
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
     * Returns true only if:
     * - Session was created with resumeSession
     * - No messages have been sent yet (send() not called)
     * - History hasn't been consumed yet
     *
     * When true, calling stream() directly (without send()) will yield
     * historical messages from the resumed session.
     */
    hasPendingHistory(): boolean;
}
//# sourceMappingURL=session.d.ts.map