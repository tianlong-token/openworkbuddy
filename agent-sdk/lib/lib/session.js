"use strict";
/**
 * V2 Session API
 *
 * Multi-turn conversation support.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionImpl = void 0;
exports.createSession = createSession;
exports.resumeSession = resumeSession;
exports.prompt = prompt;
const crypto_1 = require("crypto");
const connect_1 = require("./connect");
const errors_1 = require("./errors");
const transport_1 = require("./transport");
const utils_1 = require("./utils");
/**
 * Create a new session for multi-turn conversations.
 */
function createSession(options) {
    return new SessionImpl(options);
}
/**
 * Resume an existing session by ID.
 */
function resumeSession(sessionId, options) {
    return new SessionImpl(options, sessionId);
}
/**
 * One-shot convenience function for single prompts.
 */
async function prompt(message, options) {
    const session = createSession(options);
    try {
        await session.send(message);
        for await (const msg of session.stream()) {
            if (msg.type === 'result') {
                return msg;
            }
        }
        throw new Error('No result message received');
    }
    finally {
        session.close();
    }
}
/**
 * Session class for multi-turn conversations.
 */
class SessionImpl {
    constructor(options, resumeSessionId) {
        var _a, _b;
        this.options = options;
        this._initialized = false;
        this._initPromise = null;
        this.closed = false;
        this.messageIterator = null;
        this.hookCallbacks = new Map();
        // Session lock tracking
        this.lockedSessionId = null;
        this.hasSentMessage = false; // Whether send() has been called
        this.historyConsumed = false; // Whether history messages have been consumed
        // Track if this is a resume session for history filtering
        this.isResumeSession = !!resumeSessionId;
        // Save resumeSessionId for delayed lock acquisition in initialize()
        this.resumeSessionId = resumeSessionId;
        // Note: Session lock is now acquired in initialize() to reduce lock leak risk
        // (only acquire when actually used)
        // Validate sessionId format
        if (options.sessionId) {
            const sessionIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9\-_:]*$/;
            if (!sessionIdPattern.test(options.sessionId)) {
                throw new Error(`Invalid session ID format: "${options.sessionId}". ` +
                    'Session IDs support numbers, letters, hyphens, underscores, and colons, ' +
                    'but must start with a letter or number.');
            }
        }
        // Generate sessionId early so it's immediately available
        // Priority: resumeSessionId > options.sessionId > auto-generated UUID
        this._sessionId = (_a = resumeSessionId !== null && resumeSessionId !== void 0 ? resumeSessionId : options.sessionId) !== null && _a !== void 0 ? _a : (0, crypto_1.randomUUID)();
        // Parse systemPrompt options for transport
        const systemPrompt = typeof options.systemPrompt === 'string'
            ? options.systemPrompt
            : undefined;
        const appendSystemPrompt = typeof options.systemPrompt === 'object'
            ? options.systemPrompt.append
            : undefined;
        // Build transport options (transport handles SDK MCP server extraction)
        const transportOptions = {
            executablePath: options.pathToCodebuddyCode,
            executable: options.executable,
            executableArgs: options.executableArgs,
            cwd: options.cwd,
            env: options.env,
            model: options.model,
            mcpServers: options.mcpServers,
            strictMcpConfig: options.strictMcpConfig,
            sessionId: this._sessionId, // Use the generated sessionId
            resume: resumeSessionId,
            // Tool options
            allowedTools: options.allowedTools,
            disallowedTools: options.disallowedTools,
            tools: options.tools,
            // Permission mode
            permissionMode: options.permissionMode,
            // Max turns
            maxTurns: options.maxTurns,
            // Include partial messages for streaming
            includePartialMessages: options.includePartialMessages,
            // Settings sources (enables loading user/project hooks)
            settingSources: options.settingSources,
            // Thinking & effort
            maxThinkingTokens: options.maxThinkingTokens,
            thinking: options.thinking,
            effort: options.effort,
            // Extra CLI arguments
            extraArgs: options.extraArgs,
            // System prompt options
            systemPrompt,
            appendSystemPrompt,
            // Transport control request timeout
            requestTimeoutMs: options.requestTimeoutMs,
        };
        // Create transport (does not connect yet)
        // User can call setModel()/setPermissionMode() before connect()
        this._transport = (0, transport_1.createTransport)(transportOptions);
        // Note: this._sessionId is already set above (before transport creation)
        this.abortController = new AbortController();
        // Initialize current state from options
        this._currentPermissionMode = (_b = options.permissionMode) !== null && _b !== void 0 ? _b : 'default';
        this._currentModel = options.model;
        this.registerHooks(options.hooks);
        // Register control request handler on transport so control requests
        // (can_use_tool, hook_callback) are dispatched directly in handleLine(),
        // bypassing the message queue. This ensures they are always processed
        // even when the message consumer (for-await loop) has been cancelled.
        this._transport.onControlRequest(request => {
            // eslint-disable-next-line no-void
            void this.handleControlRequest(request).catch(() => {
                // Individual control request errors shouldn't affect the session
            });
        });
    }
    /**
     * The session ID. Always available immediately after session creation.
     * The ID is either user-provided via options.sessionId, or auto-generated.
     */
    get sessionId() {
        return this._sessionId;
    }
    /**
     * Get the session ID for control requests.
     * Prefers session_id captured from CLI messages, falls back to options.
     */
    getSessionIdForControl() {
        return this._sessionId || undefined;
    }
    /**
     * Send a message to the agent.
     */
    async send(message) {
        if (this.closed) {
            throw new Error('Session is closed');
        }
        // Reset abortController if it was previously aborted (e.g., by interrupt())
        // This allows continuing to send messages after an interrupt
        if (this.abortController.signal.aborted) {
            this.abortController = new AbortController();
        }
        // Reset messageIterator if the underlying stream was closed
        // When a for-await loop exits early (e.g., due to cancel), it calls return() on the iterator,
        // which sets messageStream.isDone = true. This causes subsequent stream() calls to exit
        // immediately without waiting for messages. By resetting messageIterator, we ensure the
        // next stream() call creates a fresh iterator that properly waits for new messages.
        this.messageIterator = null;
        // Mark that a message has been sent BEFORE transport initialization
        // This ensures doInitialize() sees hasSentMessage=true and sets hasPrompt=true
        this.hasSentMessage = true;
        const t = await this.transport();
        t.sendUserMessage(message);
    }
    /**
     * Stream messages from the agent.
     *
     * In resume mode, the first call to stream() without a prior send() will
     * return historical messages from the session. Subsequent calls after
     * send() will return only new responses.
     */
    async *stream() {
        if (this.closed) {
            return;
        }
        const t = await this.transport();
        // Note: In resume mode, CLI automatically triggers history return
        // when started with --resume flag (see cli-executor.ts:103-118)
        // No need to send empty message from SDK side
        // Reuse the same iterator across multiple receive() calls
        if (!this.messageIterator) {
            this.messageIterator = t.messages();
        }
        while (true) {
            const { value: message, done } = await this.messageIterator.next();
            if (done || this.closed) {
                break;
            }
            // Note: Control requests (can_use_tool, hook_callback) are handled
            // directly by the transport via onControlRequest() and never appear here.
            if ((0, utils_1.isMessage)(message)) {
                // Check for execution error BEFORE yielding
                if (message.type === 'result') {
                    // Mark history as consumed (for normal history consumption flow)
                    this.historyConsumed = true;
                    if (message.is_error && 'errors' in message && message.errors && message.errors.length > 0) {
                        throw new errors_1.ExecutionError(message.errors, message.subtype);
                    }
                    yield message;
                    break;
                }
                yield message;
                // Stop on error message (end of turn)
                if (message.type === 'error') {
                    break;
                }
            }
        }
    }
    /**
     * Close the session.
     */
    close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        // Release session lock if held
        if (this.lockedSessionId) {
            (0, connect_1.releaseSessionLock)(this.lockedSessionId);
            this.lockedSessionId = null;
        }
        this._transport.close();
    }
    /**
     * Async disposal support.
     */
    async [Symbol.asyncDispose]() {
        this.close();
    }
    /**
     * Interrupt the current prompt execution.
     * Aborts the local abort controller and sends an interrupt control request to the CLI.
     */
    async interrupt() {
        if (this.closed) {
            return;
        }
        // Abort local controller to signal cancellation to canUseTool and hook callbacks
        this.abortController.abort();
        try {
            const t = await this.transport();
            await t.sendControlRequest({
                subtype: 'interrupt',
                session_id: this._sessionId,
                reason: 'Interrupted by user',
            });
        }
        catch (_a) {
            // Ignore errors during interrupt
        }
    }
    // ============= Permission Mode Methods =============
    /**
     * Set the permission mode for the session.
     * - Before connect(): modifies transport options (will be passed as CLI argument)
     * - After connect(): sends control request to CLI
     */
    async setPermissionMode(mode) {
        if (this.closed) {
            throw new Error('Session is closed');
        }
        this._currentPermissionMode = mode;
        // If transport not yet connected, modify options (will be passed as CLI argument)
        // If already connected, send control request
        if (!this._transport.isReady()) {
            this._transport.setPermissionMode(mode);
        }
        else if (this._sessionId) {
            const request = {
                subtype: 'set_permission_mode',
                session_id: this._sessionId,
                mode,
            };
            await this._transport.sendControlRequest(request);
        }
    }
    /**
     * Get the current permission mode of the session.
     */
    getPermissionMode() {
        return this._currentPermissionMode;
    }
    /**
     * Get the current model of the session.
     */
    getModel() {
        return this._currentModel;
    }
    /**
     * Set the model for the session.
     * - Before connect(): modifies transport options (will be passed as CLI argument)
     * - After connect(): sends control request to CLI
     */
    async setModel(model) {
        if (this.closed) {
            throw new Error('Session is closed');
        }
        this._currentModel = model;
        // If transport not yet connected, modify options (will be passed as CLI argument)
        // If already connected, send control request
        if (!this._transport.isReady()) {
            this._transport.setModel(model);
        }
        else if (this._sessionId) {
            const request = {
                subtype: 'set_model',
                session_id: this._sessionId,
                model,
            };
            await this._transport.sendControlRequest(request);
        }
    }
    /**
     * Set configuration key-value pairs for the session.
     * Sends a set_config control request to CLI to update settings dynamically.
     * Only works after connect() (requires active CLI process).
     */
    async setConfig(config) {
        if (this.closed) {
            throw new Error('Session is closed');
        }
        if (Object.keys(config).length === 0) {
            return;
        }
        const t = await this.transport();
        const request = {
            subtype: 'set_config',
            session_id: this._sessionId,
            config,
        };
        await t.sendControlRequest(request);
    }
    /**
     * Get available permission modes from the CLI.
     * @experimental This requires CLI support for 'get_available_modes' control request.
     */
    async getAvailableModes() {
        if (this.closed) {
            throw new Error('Session is closed');
        }
        const t = await this.transport();
        const request = {
            subtype: 'get_available_modes',
            session_id: this.getSessionIdForControl(),
        };
        const response = await t.sendControlRequest(request);
        return response.availableModes;
    }
    /**
     * Get available models from the CLI (simplified format).
     * @experimental This requires CLI support for 'get_available_models' control request.
     */
    async getAvailableModels() {
        if (this.closed) {
            throw new Error('Session is closed');
        }
        const t = await this.transport();
        const request = {
            subtype: 'get_available_models',
        };
        const response = await t.sendControlRequest(request);
        return response.availableModels;
    }
    /**
     * Get available models from the CLI with full configuration details.
     * Returns complete model information including capabilities, token limits, etc.
     * @experimental This requires CLI support for 'get_available_models' control request.
     */
    async getAvailableModelsRaw() {
        var _a;
        if (this.closed) {
            throw new Error('Session is closed');
        }
        const t = await this.transport();
        const request = {
            subtype: 'get_available_models',
        };
        const response = await t.sendControlRequest(request);
        return (_a = response.rawModels) !== null && _a !== void 0 ? _a : [];
    }
    /**
     * Get available commands from the CLI.
     * Subscribes to the commands channel and returns the current list of available commands.
     * @experimental This requires CLI support for commands channel subscription.
     */
    async getAvailableCommands() {
        if (this.closed) {
            throw new Error('Session is closed');
        }
        const t = await this.transport();
        // Create a promise that will resolve when we receive the commands notification
        const commandsPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                t.offNotification('commands', handler);
                reject(new Error('Timeout waiting for commands notification'));
            }, 10000); // 10 second timeout
            const handler = (notification) => {
                clearTimeout(timeout);
                t.offNotification('commands', handler);
                const data = notification.data;
                const commands = data.commands.map(cmd => {
                    const result = {
                        // Remove leading '/' from command name if present
                        name: cmd.name.startsWith('/') ? cmd.name.substring(1) : cmd.name,
                        description: cmd.description || '',
                    };
                    if (cmd.argumentHint) {
                        result.input = { hint: cmd.argumentHint };
                    }
                    return result;
                });
                resolve(commands);
            };
            t.onNotification('commands', handler);
        });
        // Subscribe to commands channel - this will trigger immediate push
        const subscribeRequest = {
            subtype: 'subscribe',
            channel: 'commands',
        };
        await t.sendControlRequest(subscribeRequest);
        // Wait for and return the commands
        return commandsPromise;
    }
    /**
     * Subscribe to commands channel and receive all command updates via callback.
     * The handler will be called for every commands notification from CLI.
     * Use this for persistent listening to command changes instead of one-shot getAvailableCommands().
     * @experimental This requires CLI support for commands channel subscription.
     */
    async subscribeToCommands(handler) {
        if (this.closed) {
            throw new Error('Session is closed');
        }
        const t = await this.transport();
        // Register persistent handler
        t.onNotification('commands', handler);
        // Subscribe to commands channel - this will trigger immediate push
        const subscribeRequest = {
            subtype: 'subscribe',
            channel: 'commands',
        };
        await t.sendControlRequest(subscribeRequest);
    }
    /**
     * Unsubscribe a handler from the commands channel.
     * This removes the handler from receiving future notifications.
     * Note: This does not send an unsubscribe request to CLI, it only removes the local handler.
     * @param handler - The handler to remove
     */
    unsubscribeFromCommands(handler) {
        if (this._initialized && this._transport) {
            this._transport.offNotification('commands', handler);
        }
    }
    // ============= Connection Methods =============
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
    async connect() {
        await this.transport();
    }
    // ============= Private Methods =============
    /**
     * Get a ready-to-use transport.
     * Ensures connection and initialization are complete before returning.
     * This method is idempotent - multiple calls return the same promise until ready.
     */
    async transport() {
        // Already initialized - return transport directly
        if (this._initialized) {
            return this._transport;
        }
        // Initialization in progress - wait for it
        if (this._initPromise) {
            await this._initPromise;
            return this._transport;
        }
        // Start initialization
        this._initPromise = this.doInitialize();
        await this._initPromise;
        return this._transport;
    }
    /**
     * Perform actual initialization (called once by transport()).
     */
    async doInitialize() {
        // Delayed lock acquisition: acquire lock when actually used to reduce leak risk
        if (this.resumeSessionId) {
            if (!(0, connect_1.acquireSessionLock)(this.resumeSessionId)) {
                throw new Error(`Session ${this.resumeSessionId} is already in use`);
            }
            this.lockedSessionId = this.resumeSessionId;
        }
        // Ensure transport is ready (CLI process started and first output received)
        await this._transport.ensureReady();
        // Parse systemPrompt options
        const systemPrompt = typeof this.options.systemPrompt === 'string'
            ? this.options.systemPrompt
            : undefined;
        const appendSystemPrompt = typeof this.options.systemPrompt === 'object'
            ? this.options.systemPrompt.append
            : undefined;
        // Get SDK MCP server names from transport
        const sdkMcpServerNames = this._transport.sdkMcpServerNames;
        const initRequest = {
            subtype: 'initialize',
            hooks: this.buildHooksConfig(),
            systemPrompt,
            appendSystemPrompt,
            agents: this.options.agents,
            // Include SDK MCP server names from transport
            sdkMcpServers: sdkMcpServerNames.length > 0 ? sdkMcpServerNames : undefined,
            // Pass environment/endpoint for selfhosted environment resolution
            environment: this.options.environment,
            endpoint: this.options.endpoint,
            // Declare SDK capabilities for tool enablement
            capabilities: {
                // SDK supports handling AskUserQuestion via canUseTool callback
                askUserQuestion: true,
            },
            // Tell CLI whether prompt will follow (for resume history decision)
            // If send() was called before stream(), hasSentMessage=true means hasPrompt=true
            hasPrompt: this.hasSentMessage,
        };
        const response = await this._transport.sendControlRequest(initRequest);
        this._initialized = true;
        // Update model from CLI response if not set locally
        if (!this._currentModel && response.currentModelId) {
            this._currentModel = response.currentModelId;
        }
    }
    async handleControlRequest(request) {
        const { subtype } = request.request;
        if (subtype === 'hook_callback') {
            await this.handleHookCallback(request);
        }
        else if (subtype === 'can_use_tool') {
            await this.handlePermissionRequest(request);
        }
        // Note: mcp_message is handled at the transport level
    }
    async handlePermissionRequest(request) {
        var _a;
        const permRequest = request.request;
        const { tool_name, input, tool_use_id, agent_id, permission_suggestions, blocked_path, decision_reason, } = permRequest;
        // Use overridden handler if available, otherwise fall back to options
        const canUseTool = (_a = this.overriddenCanUseTool) !== null && _a !== void 0 ? _a : this.options.canUseTool;
        // If no canUseTool callback provided, deny by default
        if (!canUseTool) {
            this._transport.sendControlResponse(request.request_id, {
                allowed: false,
                reason: 'No permission handler provided',
                tool_use_id,
            });
            return;
        }
        try {
            const result = await canUseTool(tool_name, input, {
                signal: this.abortController.signal,
                suggestions: permission_suggestions,
                blockedPath: blocked_path,
                decisionReason: decision_reason,
                toolUseID: tool_use_id,
                agentID: agent_id,
            });
            if (result.behavior === 'allow') {
                this._transport.sendControlResponse(request.request_id, {
                    allowed: true,
                    updatedInput: result.updatedInput,
                    tool_use_id,
                });
            }
            else {
                this._transport.sendControlResponse(request.request_id, {
                    allowed: false,
                    reason: result.message,
                    interrupt: result.interrupt,
                    tool_use_id,
                });
            }
        }
        catch (error) {
            this._transport.sendControlResponse(request.request_id, {
                allowed: false,
                reason: error instanceof Error ? error.message : String(error),
                tool_use_id,
            });
        }
    }
    // ============= Hook Methods =============
    registerHooks(hooks) {
        if (!hooks) {
            return;
        }
        this.registeredHooks = hooks;
        // Build callback ID mapping for each hook - must match buildHooksConfig
        for (const [event, matchers] of Object.entries(hooks)) {
            if (!matchers) {
                continue;
            }
            matchers.forEach((matcher, matcherIndex) => {
                matcher.hooks.forEach((hook, hookIndex) => {
                    const callbackId = `hook_${event}_${matcherIndex}_${hookIndex}`;
                    this.hookCallbacks.set(callbackId, hook);
                });
            });
        }
    }
    buildHooksConfig() {
        if (!this.registeredHooks) {
            return undefined;
        }
        const config = {};
        for (const [event, matchers] of Object.entries(this.registeredHooks)) {
            if (!matchers) {
                continue;
            }
            const hookEvent = event;
            config[hookEvent] = matchers.map((matcher, matcherIndex) => ({
                matcher: matcher.matcher,
                hookCallbackIds: matcher.hooks.map((_, hookIndex) => `hook_${event}_${matcherIndex}_${hookIndex}`),
                timeout: matcher.timeout,
            }));
        }
        return Object.keys(config).length > 0 ? config : undefined;
    }
    async handleHookCallback(request) {
        const { callback_id, input, tool_use_id } = request.request;
        const callback = this.hookCallbacks.get(callback_id);
        let response = { continue: true };
        if (callback) {
            try {
                response = await callback(input, tool_use_id, { signal: this.abortController.signal });
            }
            catch (error) {
                response = {
                    continue: false,
                    stopReason: error instanceof Error ? error.message : String(error),
                };
            }
        }
        this._transport.sendControlResponse(request.request_id, response);
    }
    // ============= Hook Update =============
    /**
     * Update hook callbacks without sending a control request to CLI.
     * The hook event structure (events, matchers) was established during initialize().
     * This just replaces the callback functions for existing hook IDs.
     */
    setHooks(hooks) {
        this.hookCallbacks.clear();
        this.registeredHooks = undefined;
        this.registerHooks(hooks);
    }
    // ============= Permission Handler Override =============
    /**
     * Set the permission handler for tool usage.
     * Can be called to override or wrap the existing canUseTool handler.
     *
     * @param handler - The permission handler function
     */
    setCanUseTool(handler) {
        this.overriddenCanUseTool = handler;
    }
    /**
     * Get the current permission handler for tool usage.
     * Returns the overridden handler if set, otherwise the original from options.
     * Returns undefined if no handler is configured.
     */
    getCanUseTool() {
        var _a;
        return (_a = this.overriddenCanUseTool) !== null && _a !== void 0 ? _a : this.options.canUseTool;
    }
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
    hasPendingHistory() {
        return this.isResumeSession && !this.hasSentMessage && !this.historyConsumed;
    }
}
exports.SessionImpl = SessionImpl;
//# sourceMappingURL=session.js.map