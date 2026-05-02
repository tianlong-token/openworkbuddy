"use strict";
/**
 * Process Transport
 *
 * Transport implementation that spawns CLI process and communicates via stdin/stdout.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessTransport = void 0;
const node_child_process_1 = require("node:child_process");
const readline = __importStar(require("node:readline"));
const sdk_control_server_transport_1 = require("../mcp/sdk-control-server-transport");
const utils_1 = require("../utils");
const version_1 = require("../version");
function createDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}
/**
 * Resolve the runtime configuration for spawning CLI process.
 *
 * Priority:
 * 1. .exe files -> execute directly
 * 2. User-specified executable option -> use specified runtime
 * 3. Electron packaged app -> use process.execPath + ELECTRON_RUN_AS_NODE
 * 4. Deno environment -> use deno
 * 5. Bun environment -> use bun
 * 6. Default -> use node
 */
function resolveRuntime(executablePath, options) {
    var _a;
    // 1. .exe files: execute directly
    if (executablePath.endsWith('.exe')) {
        return { command: executablePath, args: [], directExecute: true };
    }
    // 2. User-specified executable
    if (options.executable) {
        const runtimeArgs = (_a = options.executableArgs) !== null && _a !== void 0 ? _a : [];
        if (options.executable === 'deno') {
            // Deno needs run --allow-all by default unless user specifies args
            return {
                command: 'deno',
                args: runtimeArgs.length > 0 ? runtimeArgs : ['run', '--allow-all'],
            };
        }
        return {
            command: options.executable,
            args: runtimeArgs,
        };
    }
    // 3. Electron packaged app
    const isElectron = !!(process.versions && process.versions.electron);
    const isPackaged = isElectron && !process.defaultApp;
    if (isPackaged) {
        return {
            command: process.execPath,
            args: [],
            env: { ELECTRON_RUN_AS_NODE: '1' },
        };
    }
    // 4. Deno environment
    if (typeof globalThis.Deno !== 'undefined' ||
        (process.versions && process.versions.deno)) {
        return { command: 'deno', args: ['run', '--allow-all'] };
    }
    // 5. Bun environment
    if (process.versions && process.versions.bun) {
        return { command: 'bun', args: [] };
    }
    // 6. Default: Node.js
    return { command: 'node', args: [] };
}
/**
 * ProcessTransport - communicates with CLI via spawned process.
 */
class ProcessTransport {
    constructor(options = {}) {
        this.process = null;
        this.rl = null;
        this.messageStream = null;
        this.pendingRequests = new Map();
        this.requestIdCounter = 0;
        this.closed = false;
        this._closeReason = null;
        this._stderrBuffer = '';
        this.readyPromise = null;
        this._isCliReady = false;
        // Write queue for backpressure handling
        this._writeQueue = [];
        this._draining = false;
        // SDK MCP Server management
        this.sdkMcpTransports = new Map();
        this.sdkMcpServerInstances = new Map();
        this.pendingMcpResponses = new Map();
        this._sdkMcpServerNames = [];
        // Cached CLI version for UserAgent
        this._cliVersion = null;
        // Notification handlers by channel
        this.notificationHandlers = new Map();
        if (typeof options.mcpServers === 'string') {
            // File path string: pass through directly, no SDK servers to extract
            this.options = { ...options };
        }
        else {
            // Extract SDK MCP servers from mcpServers config
            const { sdkServers, regularServers } = this.extractMcpServers(options.mcpServers);
            // Store options with regularServers (SDK servers handled separately)
            this.options = {
                ...options,
                mcpServers: regularServers,
            };
            // Connect SDK MCP servers
            for (const [name, server] of sdkServers) {
                this.connectSdkMcpServer(name, server);
            }
        }
    }
    /**
     * Get the list of SDK MCP server names.
     * Used by Query/Session to include in initialize request.
     */
    get sdkMcpServerNames() {
        return this._sdkMcpServerNames;
    }
    /**
     * Set the model before connecting.
     * Must be called before connect() - has no effect after CLI process starts.
     */
    setModel(model) {
        if (this.process) {
            return;
        }
        this.options.model = model;
    }
    /**
     * Get the current model setting.
     */
    getModel() {
        return this.options.model;
    }
    /**
     * Set the permission mode before connecting.
     * Must be called before connect() - has no effect after CLI process starts.
     */
    setPermissionMode(mode) {
        if (this.process) {
            return;
        }
        this.options.permissionMode = mode;
    }
    /**
     * Get the current permission mode setting.
     */
    getPermissionMode() {
        return this.options.permissionMode;
    }
    /**
     * Ensure the transport is ready for communication.
     * This method is idempotent - multiple calls return the same promise.
     *
     * @returns A promise that resolves when the transport is ready (CLI process started).
     */
    async ensureReady() {
        var _a;
        // Already ready
        if (this._isCliReady) {
            return;
        }
        // Connection already in progress
        if (this.readyPromise) {
            return this.readyPromise;
        }
        // Pre-fetch CLI version asynchronously before starting the process
        if (this._cliVersion === null) {
            const executablePath = (_a = this.options.executablePath) !== null && _a !== void 0 ? _a : (0, utils_1.resolveCLIPath)();
            this._cliVersion = await (0, utils_1.resolveCLIVersion)(executablePath);
        }
        this.readyPromise = (async () => {
            // 1. Start CLI process
            this.start();
            // 2. Wait for process to be created
            await this.waitForProcess();
            this._isCliReady = true;
        })();
        return this.readyPromise;
    }
    /**
     * Wait for the process to be created.
     */
    waitForProcess() {
        return new Promise((resolve, reject) => {
            const checkProcess = () => {
                var _a;
                if (this.closed) {
                    reject(new Error((_a = this._closeReason) !== null && _a !== void 0 ? _a : 'Transport closed during connection'));
                    return;
                }
                if (this.process !== null) {
                    resolve();
                }
                else {
                    setTimeout(checkProcess, 5);
                }
            };
            checkProcess();
        });
    }
    /**
     * Connect the transport - start CLI process in advance.
     * This allows reducing latency for the first message by
     * pre-spawning the CLI process before it's needed.
     *
     * @returns A promise that resolves when the transport is ready.
     */
    async connect() {
        return this.ensureReady();
    }
    /**
     * Apply thinking configuration to environment variables.
     */
    applyThinkingEnv(env) {
        let resolvedThinking = this.options.maxThinkingTokens;
        const thinking = this.options.thinking;
        if (thinking) {
            if (thinking.type === 'enabled') {
                if (thinking.budgetTokens !== undefined) {
                    resolvedThinking = thinking.budgetTokens;
                }
                if (resolvedThinking !== undefined && resolvedThinking > 0) {
                    env.MAX_THINKING_TOKENS = String(resolvedThinking);
                }
            }
            // adaptive: handled in buildArgs via --settings
            // disabled: default behavior, no action needed
        }
        else if (resolvedThinking !== undefined && resolvedThinking > 0) {
            // Deprecated maxThinkingTokens fallback
            env.MAX_THINKING_TOKENS = String(resolvedThinking);
        }
    }
    /**
     * Inject a setting into --settings CLI arg (merges with existing).
     */
    static injectSetting(args, key, value) {
        const idx = args.indexOf('--settings');
        if (idx !== -1 && idx + 1 < args.length) {
            const settings = JSON.parse(args[idx + 1]);
            settings[key] = value;
            args[idx + 1] = JSON.stringify(settings);
        }
        else {
            args.push('--settings', JSON.stringify({ [key]: value }));
        }
    }
    /**
     * Build CLI arguments from options.
     * Only includes options that are supported by the CLI.
     */
    buildArgs() {
        var _a, _b;
        const args = [
            '--input-format=stream-json',
            '--output-format=stream-json',
            '--verbose'
        ];
        const opts = this.options;
        // Model options
        if (opts.model) {
            args.push('--model', opts.model);
        }
        if (opts.fallbackModel) {
            if (opts.model && opts.fallbackModel === opts.model) {
                throw new Error('Fallback model cannot be the same as the main model.');
            }
            args.push('--fallback-model', opts.fallbackModel);
        }
        // Turn limits
        if (opts.maxTurns !== undefined) {
            args.push('--max-turns', opts.maxTurns.toString());
        }
        // Request timeout (used by SDK transport and headless force-exit)
        if (opts.requestTimeoutMs !== undefined && Number.isFinite(opts.requestTimeoutMs) && opts.requestTimeoutMs > 0) {
            args.push('--request-timeout-ms', Math.floor(opts.requestTimeoutMs).toString());
        }
        // Permission options
        if (opts.permissionMode) {
            args.push('--permission-mode', opts.permissionMode);
        }
        if (opts.dangerouslySkipPermissions) {
            args.push('--dangerously-skip-permissions');
        }
        // Tool options
        if (opts.allowedTools && opts.allowedTools.length > 0) {
            args.push('--allowedTools', ...opts.allowedTools);
        }
        if (opts.disallowedTools && opts.disallowedTools.length > 0) {
            args.push('--disallowedTools', ...opts.disallowedTools);
        }
        if (opts.tools !== undefined) {
            args.push('--tools', opts.tools.join(','));
        }
        // Session options
        if (opts.sessionId) {
            args.push('--session-id', opts.sessionId);
        }
        if (opts.continue) {
            args.push('--continue');
        }
        if (opts.resume) {
            args.push('--resume', opts.resume);
        }
        if (opts.forkSession) {
            args.push('--fork-session');
        }
        // MCP options
        if (opts.mcpServers) {
            if (typeof opts.mcpServers === 'string') {
                // File path string: pass directly to CLI
                args.push('--mcp-config', opts.mcpServers);
            }
            else if (Object.keys(opts.mcpServers).length > 0) {
                args.push('--mcp-config', JSON.stringify({ mcpServers: opts.mcpServers }));
            }
        }
        if (opts.strictMcpConfig) {
            args.push('--strict-mcp-config');
        }
        // Settings
        // SDK default: don't load any filesystem settings for clean environment isolation
        // When settingSources is explicitly provided (including empty array), use it
        // When not provided (undefined), default to 'none' for SDK isolation
        if (opts.settingSources !== undefined) {
            const value = opts.settingSources.length === 0 ? 'none' : opts.settingSources.join(',');
            args.push('--setting-sources', value);
        }
        else {
            // SDK default behavior: no filesystem settings loaded
            args.push('--setting-sources', 'none');
        }
        // Additional directories
        if (opts.additionalDirectories) {
            for (const dir of opts.additionalDirectories) {
                args.push('--add-dir', dir);
            }
        }
        // Output options
        if (opts.includePartialMessages) {
            args.push('--include-partial-messages');
        }
        // System prompt options
        if (opts.systemPrompt) {
            args.push('--system-prompt', opts.systemPrompt);
        }
        if (opts.appendSystemPrompt) {
            args.push('--append-system-prompt', opts.appendSystemPrompt);
        }
        // Effort level
        if (opts.effort) {
            args.push('--effort', opts.effort);
        }
        // Thinking: adaptive/enabled → alwaysThinkingEnabled setting
        if (((_a = opts.thinking) === null || _a === void 0 ? void 0 : _a.type) === 'adaptive' || ((_b = opts.thinking) === null || _b === void 0 ? void 0 : _b.type) === 'enabled') {
            ProcessTransport.injectSetting(args, 'alwaysThinkingEnabled', true);
        }
        // Extra args (custom flags)
        if (opts.extraArgs) {
            for (const [flag, value] of Object.entries(opts.extraArgs)) {
                if (value === null) {
                    args.push(`--${flag}`);
                }
                else {
                    args.push(`--${flag}`, value);
                }
            }
        }
        // Additional args passed directly
        if (opts.args) {
            args.push(...opts.args);
        }
        return args;
    }
    /**
     * Start the transport - spawns CLI process.
     */
    start() {
        var _a, _b, _c, _d;
        if (this.process) {
            return;
        }
        // Create message stream with cleanup callback
        this.messageStream = new utils_1.Stream(() => {
            this.close();
        });
        const executablePath = (_a = this.options.executablePath) !== null && _a !== void 0 ? _a : (0, utils_1.resolveCLIPath)();
        const cwd = (_b = this.options.cwd) !== null && _b !== void 0 ? _b : process.cwd();
        const env = {
            ...process.env,
            ...this.options.env,
        };
        // Set SDK entrypoint
        if (!env.CODEBUDDY_CODE_ENTRYPOINT) {
            env.CODEBUDDY_CODE_ENTRYPOINT = 'sdk-ts';
        }
        // Disable CLI auto-update when spawned by the SDK — an update restarts
        // the CLI process mid-session, breaking the transport connection.
        env.DISABLE_AUTOUPDATER = '1';
        // Disable auto-memory when spawned by the SDK — the CLI's auto-memory
        // triggers tool_use (Write) which requires permission handling. SDK
        // callers without a canUseTool handler get tool rejections that corrupt
        // the conversation state and cause 400 API errors.
        if (!env.CODEBUDDY_DISABLE_AUTO_MEMORY) {
            env.CODEBUDDY_DISABLE_AUTO_MEMORY = '1';
        }
        // Thinking configuration → MAX_THINKING_TOKENS env var
        this.applyThinkingEnv(env);
        // Build SDK UserAgent and inject via CODEBUDDY_CUSTOM_HEADERS
        // Format: CodeBuddy Agent SDK/Version (Runtime/Version) CodeBuddy Code/Version
        // SDK UserAgent is placed first so user's headers can override it
        const nodeVersion = ((_c = process.versions) === null || _c === void 0 ? void 0 : _c.node) || 'unknown';
        const cliVersion = (_d = this._cliVersion) !== null && _d !== void 0 ? _d : 'unknown';
        const sdkUserAgent = `User-Agent: CodeBuddy Agent SDK/${version_1.SDK_VERSION} (Node.js/${nodeVersion}) CodeBuddy Code/${cliVersion}`;
        const existingHeaders = env.CODEBUDDY_CUSTOM_HEADERS || '';
        env.CODEBUDDY_CUSTOM_HEADERS = existingHeaders
            ? `${sdkUserAgent}\n${existingHeaders}`
            : sdkUserAgent;
        const args = this.buildArgs();
        // Resolve runtime configuration
        const runtime = resolveRuntime(executablePath, this.options);
        // Merge runtime-specific environment variables
        const finalEnv = { ...env, ...runtime.env };
        if (runtime.directExecute) {
            // .exe files: execute directly
            this.process = (0, node_child_process_1.spawn)(runtime.command, args, {
                cwd,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: finalEnv,
            });
        }
        else {
            // Use runtime to execute .js file
            // Convert bin/codebuddy to dist/codebuddy.js for non-shebang execution
            let cliJsPath = executablePath;
            if (executablePath.endsWith('/bin/codebuddy') || executablePath.endsWith('\\bin\\codebuddy')) {
                cliJsPath = executablePath.replace(/bin[/\\]codebuddy$/, 'dist/codebuddy-headless.js');
            }
            this.process = (0, node_child_process_1.spawn)(runtime.command, [...runtime.args, cliJsPath, ...args], {
                cwd,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: finalEnv,
            });
        }
        this.process.on('error', err => this.handleProcessError(err));
        this.process.on('exit', code => this.handleProcessExit(code));
        // Handle stderr — always capture for diagnostics, optionally forward to callback
        if (this.process.stderr) {
            this.process.stderr.on('data', (data) => {
                var _a, _b;
                const text = data.toString();
                // Keep last 4KB of stderr for close-reason diagnostics
                this._stderrBuffer += text;
                if (this._stderrBuffer.length > 4096) {
                    this._stderrBuffer = this._stderrBuffer.slice(-4096);
                }
                (_b = (_a = this.options).stderr) === null || _b === void 0 ? void 0 : _b.call(_a, text);
            });
        }
        // Set up readline for stdout
        this.rl = readline.createInterface({
            input: this.process.stdout,
            terminal: false,
            crlfDelay: Infinity, // Ensures \r\n on Windows is treated as a single line break
        });
        this.rl.on('line', line => this.handleLine(line));
        this.rl.on('close', () => this.handleClose());
        this.rl.on('error', err => this.handleError(err));
    }
    /**
     * Async generator for incoming messages.
     */
    async *messages() {
        this.start();
        if (!this.messageStream) {
            return;
        }
        // Reset stream for re-iteration after early exit (cancel/break).
        // Clears started flag (Stream throws on double-iteration) and
        // discards stale regular messages from the previous turn.
        if (this.messageStream.isStarted) {
            this.messageStream.reset();
        }
        yield* this.messageStream;
    }
    /**
     * Register a handler for incoming control requests (can_use_tool, hook_callback).
     * Control requests are dispatched to this handler directly in handleLine(),
     * bypassing the messageStream queue. This ensures they are always processed
     * even when the message consumer (for-await loop) has been cancelled.
     */
    onControlRequest(handler) {
        this.controlRequestHandler = handler;
    }
    /**
     * Send a user message to CLI.
     */
    sendUserMessage(content, traceId, parentSpanId) {
        // Ensure transport is started
        this.start();
        let message;
        if (typeof content === 'string') {
            message = {
                type: 'user',
                session_id: '',
                message: {
                    role: 'user',
                    content: content,
                },
                parent_tool_use_id: null,
                ...(traceId ? { trace_id: traceId } : {}),
                ...(parentSpanId ? { parent_span_id: parentSpanId } : {}),
            };
        }
        else {
            message = content;
            if (traceId && !message.trace_id) {
                message.trace_id = traceId;
            }
            if (parentSpanId && !message.parent_span_id) {
                message.parent_span_id = parentSpanId;
            }
        }
        this.writeLine(message);
    }
    /**
     * Send a control request and wait for response.
     */
    async sendControlRequest(payload, timeoutMs) {
        var _a;
        // Ensure transport is started
        this.start();
        const requestId = `sdk_${Date.now()}_${++this.requestIdCounter}`;
        const request = {
            type: 'control_request',
            request_id: requestId,
            request: payload,
        };
        const deferred = createDeferred();
        this.pendingRequests.set(requestId, deferred);
        // Set timeout
        const timeout = (_a = timeoutMs !== null && timeoutMs !== void 0 ? timeoutMs : this.options.requestTimeoutMs) !== null && _a !== void 0 ? _a : 60000;
        const timeoutId = setTimeout(() => {
            if (this.pendingRequests.has(requestId)) {
                this.pendingRequests.delete(requestId);
                deferred.reject(new Error(`Request timeout: ${payload.subtype}`));
            }
        }, timeout);
        // Clean up timeout on resolution.
        // The .catch() suppresses unhandled rejections on this branch —
        // the caller handles rejections on the main deferred.promise chain.
        deferred.promise.finally(() => clearTimeout(timeoutId)).catch(() => { });
        this.writeLine(request);
        return deferred.promise;
    }
    /**
     * Send a control request without waiting for response (fire-and-forget).
     * Use this when the response will be handled through other mechanisms (e.g., callbacks).
     */
    sendControlRequestNoWait(payload) {
        // Ensure transport is started
        this.start();
        const requestId = `sdk_${Date.now()}_${++this.requestIdCounter}`;
        const request = {
            type: 'control_request',
            request_id: requestId,
            request: payload,
        };
        // Just send without registering in pendingRequests
        this.writeLine(request);
    }
    /**
     * Send a control response.
     */
    sendControlResponse(requestId, response) {
        const controlResponse = {
            type: 'control_response',
            response: {
                subtype: 'success',
                request_id: requestId,
                response,
            },
        };
        this.writeLine(controlResponse);
    }
    /**
     * Send a control error response.
     */
    sendControlErrorResponse(requestId, error) {
        const controlResponse = {
            type: 'control_response',
            response: {
                subtype: 'error',
                request_id: requestId,
                error,
            },
        };
        this.writeLine(controlResponse);
    }
    /**
     * Check if transport is ready.
     * Returns true only when CLI has produced its first output.
     */
    isReady() {
        return !this.closed && this._isCliReady;
    }
    /**
     * Register a handler for control notifications from a specific channel.
     */
    onNotification(channel, handler) {
        let handlers = this.notificationHandlers.get(channel);
        if (!handlers) {
            handlers = new Set();
            this.notificationHandlers.set(channel, handlers);
        }
        handlers.add(handler);
    }
    /**
     * Remove a notification handler for a specific channel.
     */
    offNotification(channel, handler) {
        const handlers = this.notificationHandlers.get(channel);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.notificationHandlers.delete(channel);
            }
        }
    }
    /**
     * Close the transport.
     */
    close() {
        var _a;
        if (this.closed) {
            return;
        }
        this.closed = true;
        // Clear write queue
        this._writeQueue.length = 0;
        this._draining = false;
        if (this.rl) {
            this.rl.close();
            this.rl = null;
        }
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        const reason = (_a = this._closeReason) !== null && _a !== void 0 ? _a : 'Transport closed';
        // Reject all pending requests
        for (const [, deferred] of this.pendingRequests) {
            deferred.reject(new Error(reason));
        }
        this.pendingRequests.clear();
        // Clean up SDK MCP resources
        for (const [, pending] of this.pendingMcpResponses) {
            pending.reject(new Error(reason));
        }
        this.pendingMcpResponses.clear();
        for (const transport of this.sdkMcpTransports.values()) {
            transport.close().catch(() => {
                // Ignore errors during cleanup
            });
        }
        this.sdkMcpTransports.clear();
        this.sdkMcpServerInstances.clear();
        // Signal stream completion
        if (this.messageStream) {
            this.messageStream.done();
        }
    }
    // ============= Private Methods =============
    handleLine(line) {
        const trimmed = line.trim();
        if (!trimmed) {
            return;
        }
        try {
            const message = JSON.parse(trimmed);
            // Handle control responses for pending requests
            if (message.type === 'control_response') {
                this.handleControlResponse(message);
                return;
            }
            // Handle control notifications - dispatch to registered handlers
            if (message.type === 'control_notification') {
                this.handleControlNotification(message);
                return;
            }
            // Route control requests directly to registered handler (never queued)
            // This ensures control requests are always processed, even when the
            // message consumer (for-await loop) has been cancelled.
            if (message.type === 'control_request') {
                const controlRequest = message;
                if (controlRequest.request.subtype === 'mcp_message') {
                    this.handleMcpMessageRequest(controlRequest);
                }
                else if (this.controlRequestHandler) {
                    this.controlRequestHandler(controlRequest);
                }
                return;
            }
            // Only regular messages are enqueued for consumer iteration
            if (this.messageStream) {
                this.messageStream.enqueue(message);
            }
        }
        catch (_a) {
            // Ignore non-JSON lines (e.g., verbose output, debug messages)
        }
    }
    handleControlNotification(notification) {
        const handlers = this.notificationHandlers.get(notification.channel);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    handler(notification);
                }
                catch (_a) {
                    // Ignore handler errors
                }
            }
        }
    }
    handleControlResponse(message) {
        var _a;
        const { response } = message;
        const pending = this.pendingRequests.get(response.request_id);
        if (!pending) {
            return;
        }
        this.pendingRequests.delete(response.request_id);
        if (response.subtype === 'error') {
            pending.reject(new Error(response.error));
        }
        else {
            pending.resolve((_a = response.response) !== null && _a !== void 0 ? _a : {});
        }
    }
    handleClose() {
        // If exit event already fired, _closeReason has the real reason.
        // Otherwise use a generic message — no setTimeout needed since
        // exit fires synchronously before close in Node.js child_process.
        this.setCloseReason('CLI process stdout closed unexpectedly');
        this.close();
    }
    handleError(error) {
        this.setCloseReason(`CLI I/O error: ${error.message}`);
        this.close();
    }
    handleProcessError(error) {
        this.setCloseReason(`CLI process spawn error: ${error.message}`);
        this.close();
    }
    handleProcessExit(code) {
        const stderr = this._stderrBuffer.trim();
        const stderrSuffix = stderr ? ` | stderr: ${stderr.slice(-500)}` : '';
        this.setCloseReason(`CLI process exited with code ${code}${stderrSuffix}`);
        this.close();
    }
    setCloseReason(reason) {
        if (!this._closeReason) {
            this._closeReason = reason;
        }
        else if (!this._closeReason.includes(reason)) {
            // Append subsequent reasons for better diagnostics
            // e.g. "CLI process exited with code 1 | stderr: ... → CLI process stdout closed unexpectedly"
            this._closeReason += ` → ${reason}`;
        }
    }
    writeLine(data) {
        var _a;
        if (!((_a = this.process) === null || _a === void 0 ? void 0 : _a.stdin)) {
            throw new Error('Transport not started');
        }
        const line = JSON.stringify(data) + '\n';
        if (this._draining) {
            this._writeQueue.push(line);
            return;
        }
        const ok = this.process.stdin.write(line);
        if (!ok) {
            this._draining = true;
            this.process.stdin.once('drain', () => {
                this._draining = false;
                this._flushWriteQueue();
            });
        }
    }
    _flushWriteQueue() {
        var _a;
        let i = 0;
        while (i < this._writeQueue.length && !this._draining) {
            if (!((_a = this.process) === null || _a === void 0 ? void 0 : _a.stdin)) {
                this._writeQueue.length = 0;
                return;
            }
            const ok = this.process.stdin.write(this._writeQueue[i]);
            i++;
            if (!ok) {
                this._draining = true;
                this._writeQueue.splice(0, i);
                this.process.stdin.once('drain', () => {
                    this._draining = false;
                    this._flushWriteQueue();
                });
                return;
            }
        }
        this._writeQueue.length = 0;
    }
    // ============= SDK MCP Server Methods =============
    /**
     * Extract SDK MCP servers from the mcpServers config.
     * SDK servers are identified by having type: 'sdk'.
     */
    extractMcpServers(mcpServers) {
        if (!mcpServers) {
            return { sdkServers: new Map(), regularServers: undefined };
        }
        const sdkServers = new Map();
        const regularServers = {};
        for (const [name, config] of Object.entries(mcpServers)) {
            if (config && typeof config === 'object' && 'type' in config && config.type === 'sdk') {
                // SDK MCP server
                const sdkConfig = config;
                sdkServers.set(name, sdkConfig.instance);
                this._sdkMcpServerNames.push(name);
            }
            else {
                // Regular MCP server (stdio, sse, http)
                regularServers[name] = config;
            }
        }
        return {
            sdkServers,
            regularServers: Object.keys(regularServers).length > 0 ? regularServers : undefined,
        };
    }
    /**
     * Connect an SDK MCP server.
     */
    connectSdkMcpServer(name, server) {
        // Create custom transport that forwards to CLI
        const sdkTransport = new sdk_control_server_transport_1.SdkControlServerTransport(message => this.sendMcpServerMessageToCli(name, message));
        // Store transport and server instance
        this.sdkMcpTransports.set(name, sdkTransport);
        this.sdkMcpServerInstances.set(name, server);
        // Connect server to transport
        server.connect(sdkTransport);
    }
    /**
     * Send an MCP message from server to CLI.
     */
    sendMcpServerMessageToCli(serverName, message) {
        // Check if this is a response to a pending request
        if ('id' in message && message.id !== null && message.id !== undefined) {
            const key = `${serverName}:${message.id}`;
            const pending = this.pendingMcpResponses.get(key);
            if (pending) {
                // Resolve pending promise directly
                pending.resolve(message);
                this.pendingMcpResponses.delete(key);
                return;
            }
        }
        // Send as control_request to CLI
        const requestId = `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        const controlRequest = {
            type: 'control_request',
            request_id: requestId,
            request: {
                subtype: 'mcp_message',
                server_name: serverName,
                message,
            },
        };
        // Write directly to transport (will be JSON.stringify'd by transport)
        this.sendControlRequest(controlRequest.request).catch(() => {
            // Ignore errors for notifications
        });
    }
    /**
     * Handle MCP message control request from CLI.
     */
    async handleMcpMessageRequest(request) {
        const mcpRequest = request.request;
        const { server_name, message } = mcpRequest;
        const transport = this.sdkMcpTransports.get(server_name);
        if (!transport) {
            this.sendControlErrorResponse(request.request_id, `SDK MCP server not found: ${server_name}`);
            return;
        }
        try {
            // Check if this is a request (has method and id) or a notification
            if ('method' in message && 'id' in message && message.id !== null) {
                // Wait for response from MCP server
                const response = await this.handleMcpControlRequest(server_name, message, transport);
                this.sendControlResponse(request.request_id, {
                    mcp_response: response,
                });
            }
            else {
                // Notification - no response expected
                transport.handleIncomingMessage(message);
                this.sendControlResponse(request.request_id, {
                    mcp_response: { jsonrpc: '2.0', result: {}, id: 0 },
                });
            }
        }
        catch (error) {
            this.sendControlErrorResponse(request.request_id, error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Handle MCP request and wait for response from MCP server.
     */
    handleMcpControlRequest(serverName, message, transport) {
        const messageId = 'id' in message ? message.id : null;
        const key = `${serverName}:${messageId}`;
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                this.pendingMcpResponses.delete(key);
            };
            const resolveAndCleanup = (response) => {
                cleanup();
                resolve(response);
            };
            const rejectAndCleanup = (error) => {
                cleanup();
                reject(error);
            };
            // Store pending response handler
            this.pendingMcpResponses.set(key, {
                resolve: resolveAndCleanup,
                reject: rejectAndCleanup,
            });
            // Forward message to MCP server
            transport.handleIncomingMessage(message);
        });
    }
}
exports.ProcessTransport = ProcessTransport;
//# sourceMappingURL=process-transport.js.map