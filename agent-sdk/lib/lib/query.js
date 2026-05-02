"use strict";
/**
 * Query Implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Query = void 0;
exports.query = query;
const connect_1 = require("./connect");
const errors_1 = require("./errors");
const transport_1 = require("./transport");
const utils_1 = require("./utils");
/**
 * Create a query for interacting with the agent.
 *
 * When `prompt` is omitted and `options.resume` is provided, the query will
 * return historical messages from the resumed session without triggering
 * a new agent response.
 */
function query(params) {
    return new Query(params.prompt, params.options);
}
/**
 * Query class - an AsyncGenerator that yields messages.
 */
class Query {
    constructor(prompt, options) {
        // Note: Session lock is now acquired in initialize() to:
        // 1. Reduce lock leak risk (only acquire when actually used)
        // 2. Allow fork operations which don't need locks
        var _a, _b;
        this.prompt = prompt;
        this.options = options;
        this.initialized = false;
        this.hookCallbacks = new Map();
        this.iterator = null;
        this.connectPromise = null;
        // Session lock tracking
        this.lockedSessionId = null;
        // Session ID captured from CLI messages
        this._sessionId = null;
        // Validate sessionId format
        if (options === null || options === void 0 ? void 0 : options.sessionId) {
            const sessionIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9\-_:]*$/;
            if (!sessionIdPattern.test(options.sessionId)) {
                throw new Error(`Invalid session ID format: "${options.sessionId}". ` +
                    'Session IDs support numbers, letters, hyphens, underscores, and colons, ' +
                    'but must start with a letter or number.');
            }
        }
        // Parse systemPrompt options
        const systemPrompt = typeof (options === null || options === void 0 ? void 0 : options.systemPrompt) === 'string'
            ? options.systemPrompt
            : undefined;
        const appendSystemPrompt = typeof (options === null || options === void 0 ? void 0 : options.systemPrompt) === 'object'
            ? options.systemPrompt.append
            : undefined;
        // Build transport options (transport handles SDK MCP server extraction)
        const transportOptions = {
            executablePath: options === null || options === void 0 ? void 0 : options.pathToCodebuddyCode,
            executable: options === null || options === void 0 ? void 0 : options.executable,
            executableArgs: options === null || options === void 0 ? void 0 : options.executableArgs,
            cwd: options === null || options === void 0 ? void 0 : options.cwd,
            env: options === null || options === void 0 ? void 0 : options.env,
            permissionMode: options === null || options === void 0 ? void 0 : options.permissionMode,
            // Model options
            model: options === null || options === void 0 ? void 0 : options.model,
            fallbackModel: options === null || options === void 0 ? void 0 : options.fallbackModel,
            maxTurns: options === null || options === void 0 ? void 0 : options.maxTurns,
            // Tool options
            allowedTools: options === null || options === void 0 ? void 0 : options.allowedTools,
            disallowedTools: options === null || options === void 0 ? void 0 : options.disallowedTools,
            tools: options === null || options === void 0 ? void 0 : options.tools,
            // Session options
            sessionId: options === null || options === void 0 ? void 0 : options.sessionId,
            continue: options === null || options === void 0 ? void 0 : options.continue,
            resume: options === null || options === void 0 ? void 0 : options.resume,
            forkSession: options === null || options === void 0 ? void 0 : options.forkSession,
            // MCP options (transport extracts SDK servers automatically)
            mcpServers: options === null || options === void 0 ? void 0 : options.mcpServers,
            strictMcpConfig: options === null || options === void 0 ? void 0 : options.strictMcpConfig,
            // Settings
            settingSources: options === null || options === void 0 ? void 0 : options.settingSources,
            additionalDirectories: options === null || options === void 0 ? void 0 : options.additionalDirectories,
            // Output options
            includePartialMessages: options === null || options === void 0 ? void 0 : options.includePartialMessages,
            // System prompt options
            systemPrompt,
            appendSystemPrompt,
            // Thinking & effort
            maxThinkingTokens: options === null || options === void 0 ? void 0 : options.maxThinkingTokens,
            thinking: options === null || options === void 0 ? void 0 : options.thinking,
            effort: options === null || options === void 0 ? void 0 : options.effort,
            // Extra args
            extraArgs: options === null || options === void 0 ? void 0 : options.extraArgs,
            stderr: options === null || options === void 0 ? void 0 : options.stderr,
            // Transport control request timeout
            requestTimeoutMs: options === null || options === void 0 ? void 0 : options.requestTimeoutMs,
        };
        this.transport = (0, transport_1.createTransport)(transportOptions);
        // Register control request handler on transport so control requests
        // are dispatched directly in handleLine(), bypassing the message queue.
        this.transport.onControlRequest(request => {
            // eslint-disable-next-line no-void
            void this.handleControlRequest(request).catch(() => {
                // Individual control request errors shouldn't affect the query
            });
        });
        // Auto-connect: start CLI process immediately (non-blocking)
        // This reduces latency for the first message
        this.connectPromise = this.transport.connect().catch(() => {
            // Ignore connection errors - they'll be reported when iteration starts
        });
        this.abortController = (_a = options === null || options === void 0 ? void 0 : options.abortController) !== null && _a !== void 0 ? _a : new AbortController();
        this.registerHooks(options === null || options === void 0 ? void 0 : options.hooks);
        // Track initial values (passed to CLI via command line args)
        this._initialPermissionMode = (_b = options === null || options === void 0 ? void 0 : options.permissionMode) !== null && _b !== void 0 ? _b : 'default';
        this._initialModel = options === null || options === void 0 ? void 0 : options.model;
        // Current state starts same as initial
        this._currentPermissionMode = this._initialPermissionMode;
        this._currentModel = this._initialModel;
    }
    // ============= AsyncGenerator Implementation =============
    [Symbol.asyncIterator]() {
        if (!this.iterator) {
            this.iterator = this.createIterator();
        }
        return this.iterator;
    }
    async next() {
        return this[Symbol.asyncIterator]().next();
    }
    async return() {
        await this.interrupt();
        return { done: true, value: undefined };
    }
    async throw(e) {
        await this.interrupt();
        throw e;
    }
    // ============= Connection Methods =============
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
    async connect() {
        await this.transport.connect();
        await this.initialize();
    }
    // ============= Control Methods =============
    /**
     * Get the session ID to use for control requests.
     * Prefers the session_id captured from CLI messages, falls back to options.
     */
    getSessionId() {
        var _a, _b;
        return this._sessionId || ((_a = this.options) === null || _a === void 0 ? void 0 : _a.sessionId) || ((_b = this.options) === null || _b === void 0 ? void 0 : _b.resume) || undefined;
    }
    async interrupt() {
        try {
            await this.transport.sendControlRequest({
                subtype: 'interrupt',
                session_id: this.getSessionId(),
                reason: 'User interrupt',
            });
        }
        catch (_a) {
            // Ignore errors during interrupt
        }
        // Don't close transport - let the iterator continue to receive
        // the result message and close naturally
    }
    /**
     * Set the permission mode for the query.
     * - Before iteration starts: only updates local state
     * - After iteration starts: sends fire-and-forget control request
     */
    async setPermissionMode(mode) {
        this._currentPermissionMode = mode;
        // Only sync to CLI if session is established (has session ID)
        if (this._sessionId) {
            this.transport.sendControlRequest({
                subtype: 'set_permission_mode',
                session_id: this._sessionId,
                mode,
            }).catch(() => { });
        }
    }
    /**
     * Get the current permission mode.
     */
    getPermissionMode() {
        return this._currentPermissionMode;
    }
    /**
     * Set the model for the query.
     * - Before iteration starts: only updates local state
     * - After iteration starts: sends fire-and-forget control request
     */
    async setModel(model) {
        this._currentModel = model;
        // Only sync to CLI if session is established (has session ID)
        if (this._sessionId) {
            this.transport.sendControlRequest({
                subtype: 'set_model',
                session_id: this._sessionId,
                model,
            }).catch(() => { });
        }
    }
    /**
     * Get the current model.
     */
    getModel() {
        return this._currentModel;
    }
    async setMaxThinkingTokens(maxThinkingTokens) {
        await this.transport.sendControlRequest({
            subtype: 'set_max_thinking_tokens',
            session_id: this.getSessionId(),
            max_thinking_tokens: maxThinkingTokens,
        });
    }
    // ============= Query Methods =============
    async supportedCommands() {
        var _a;
        const response = await this.transport.sendControlRequest({
            subtype: 'initialize',
        });
        return (_a = response.commands) !== null && _a !== void 0 ? _a : [];
    }
    async supportedModels() {
        var _a;
        const response = await this.transport.sendControlRequest({
            subtype: 'initialize',
        });
        return (_a = response.models) !== null && _a !== void 0 ? _a : [];
    }
    async mcpServerStatus() {
        var _a;
        const response = await this.transport.sendControlRequest({
            subtype: 'mcp_status',
        });
        return (_a = response.mcp_servers) !== null && _a !== void 0 ? _a : [];
    }
    async accountInfo() {
        var _a;
        const response = await this.transport.sendControlRequest({
            subtype: 'initialize',
        });
        return (_a = response.account) !== null && _a !== void 0 ? _a : {};
    }
    async streamInput(stream) {
        for await (const message of stream) {
            this.transport.sendUserMessage(message);
        }
    }
    // ============= Private Methods =============
    async *createIterator() {
        var _a;
        try {
            // Wait for connection to complete (if in progress)
            if (this.connectPromise) {
                await this.connectPromise;
            }
            await this.initialize();
            // Send prompt (CLI decides whether to replay history based on hasPrompt in initialize)
            await this.sendPrompt();
            // Note: Control requests (can_use_tool, hook_callback) are handled
            // directly by the transport via onControlRequest() and never appear here.
            for await (const message of this.transport.messages()) {
                if (this.abortController.signal.aborted) {
                    break;
                }
                if ((0, utils_1.isMessage)(message)) {
                    // Capture session_id from CLI messages for use in control requests
                    if (!this._sessionId && 'session_id' in message && message.session_id) {
                        this._sessionId = message.session_id;
                        // Send pending permission mode change (if set before iteration)
                        if (this._currentPermissionMode !== this._initialPermissionMode) {
                            this.transport.sendControlRequest({
                                subtype: 'set_permission_mode',
                                session_id: this._sessionId,
                                mode: this._currentPermissionMode,
                            }).catch(() => { });
                        }
                        // Send pending model change (if set before iteration)
                        if (this._currentModel !== this._initialModel) {
                            this.transport.sendControlRequest({
                                subtype: 'set_model',
                                session_id: this._sessionId,
                                model: this._currentModel,
                            }).catch(() => { });
                        }
                    }
                    if (message.type === 'stream_event' &&
                        !((_a = this.options) === null || _a === void 0 ? void 0 : _a.includePartialMessages)) {
                        continue;
                    }
                    // Check for execution error BEFORE yielding
                    // This ensures the exception is thrown even if caller breaks after receiving result
                    if (message.type === 'result') {
                        if (message.is_error && 'errors' in message && message.errors && message.errors.length > 0) {
                            throw new errors_1.ExecutionError(message.errors, message.subtype);
                        }
                        yield message;
                        break;
                    }
                    yield message;
                }
            }
        }
        finally {
            this.cleanup();
        }
    }
    async initialize() {
        var _a, _b, _c, _d, _e, _f, _g;
        if (this.initialized) {
            return;
        }
        // Delayed lock acquisition: acquire lock when actually used to reduce leak risk
        // Fork operations don't need locks since they create independent copies
        if (((_a = this.options) === null || _a === void 0 ? void 0 : _a.resume) && !((_b = this.options) === null || _b === void 0 ? void 0 : _b.forkSession)) {
            if (!(0, connect_1.acquireSessionLock)(this.options.resume)) {
                throw new Error(`Session ${this.options.resume} is already in use`);
            }
            this.lockedSessionId = this.options.resume;
        }
        const systemPrompt = typeof ((_c = this.options) === null || _c === void 0 ? void 0 : _c.systemPrompt) === 'string'
            ? this.options.systemPrompt
            : undefined;
        const appendSystemPrompt = typeof ((_d = this.options) === null || _d === void 0 ? void 0 : _d.systemPrompt) === 'object'
            ? this.options.systemPrompt.append
            : undefined;
        // Get SDK MCP server names from transport
        const sdkMcpServerNames = this.transport.sdkMcpServerNames;
        const initRequest = {
            subtype: 'initialize',
            hooks: this.buildHooksConfig(),
            systemPrompt,
            appendSystemPrompt,
            agents: (_e = this.options) === null || _e === void 0 ? void 0 : _e.agents,
            // Include SDK MCP server names from transport
            sdkMcpServers: sdkMcpServerNames.length > 0 ? sdkMcpServerNames : undefined,
            // Pass environment/endpoint for selfhosted environment resolution
            environment: (_f = this.options) === null || _f === void 0 ? void 0 : _f.environment,
            endpoint: (_g = this.options) === null || _g === void 0 ? void 0 : _g.endpoint,
            // Declare SDK capabilities for tool enablement
            capabilities: {
                // SDK supports handling AskUserQuestion via canUseTool callback
                askUserQuestion: true,
            },
            // Tell CLI whether prompt will follow (for resume history decision)
            // hasPrompt=true means CLI should NOT replay history
            hasPrompt: this.prompt !== undefined && this.prompt !== '',
        };
        const response = await this.transport.sendControlRequest(initRequest);
        this.initialized = true;
        // Update model from CLI response if not set locally.
        // Also update _initialModel so the "pending change" detection at iteration
        // start doesn't treat the CLI-reported model as a user-initiated change.
        if (!this._currentModel && response.currentModelId) {
            this._currentModel = response.currentModelId;
            this._initialModel = response.currentModelId;
        }
    }
    async sendPrompt() {
        var _a, _b, _c, _d;
        // If no prompt is provided (e.g., resume mode to get history only),
        // don't send any message. CLI will return history when no prompt is sent.
        if (this.prompt === undefined) {
            return;
        }
        if (typeof this.prompt === 'string') {
            // Empty string also triggers history-only mode
            if (this.prompt.trim() === '') {
                return;
            }
            this.transport.sendUserMessage(this.prompt, (_a = this.options) === null || _a === void 0 ? void 0 : _a.traceId, (_b = this.options) === null || _b === void 0 ? void 0 : _b.parentSpanId);
        }
        else {
            for await (const message of this.prompt) {
                if (!message.trace_id && ((_c = this.options) === null || _c === void 0 ? void 0 : _c.traceId)) {
                    message.trace_id = this.options.traceId;
                }
                if (!message.parent_span_id && ((_d = this.options) === null || _d === void 0 ? void 0 : _d.parentSpanId)) {
                    message.parent_span_id = this.options.parentSpanId;
                }
                this.transport.sendUserMessage(message);
            }
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
        const canUseTool = (_a = this.options) === null || _a === void 0 ? void 0 : _a.canUseTool;
        // If no canUseTool callback provided, deny by default
        if (!canUseTool) {
            this.transport.sendControlResponse(request.request_id, {
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
                this.transport.sendControlResponse(request.request_id, {
                    allowed: true,
                    updatedInput: result.updatedInput,
                    tool_use_id,
                });
            }
            else {
                this.transport.sendControlResponse(request.request_id, {
                    allowed: false,
                    reason: result.message,
                    interrupt: result.interrupt,
                    tool_use_id,
                });
            }
        }
        catch (error) {
            this.transport.sendControlResponse(request.request_id, {
                allowed: false,
                reason: error instanceof Error ? error.message : String(error),
                tool_use_id,
            });
        }
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
        this.transport.sendControlResponse(request.request_id, response);
    }
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
    /**
     * Cleanup all resources.
     */
    cleanup() {
        // Release session lock if held
        if (this.lockedSessionId) {
            (0, connect_1.releaseSessionLock)(this.lockedSessionId);
            this.lockedSessionId = null;
        }
        // Close main transport (handles SDK MCP cleanup internally)
        this.transport.close();
    }
}
exports.Query = Query;
//# sourceMappingURL=query.js.map