"use strict";
/**
 * SDK Control Server Transport
 *
 * Custom transport implementation that bridges SDK MCP servers to CLI process.
 * This transport forwards MCP messages through the control protocol.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SdkControlServerTransport = void 0;
/**
 * SdkControlServerTransport - bridges MCP servers to CLI via control messages.
 *
 * This transport implements the MCP Transport interface and forwards all
 * messages through a callback function that wraps them in control_request
 * messages for the CLI.
 */
class SdkControlServerTransport {
    /**
     * Create a new SDK Control Server Transport.
     *
     * @param sendMcpMessage - Callback function to forward MCP messages to CLI
     */
    constructor(sendMcpMessage) {
        this.isClosed = false;
        this.sendMcpMessage = sendMcpMessage;
    }
    /**
     * Start the transport.
     * No-op since connection is already established via stdio.
     */
    async start() {
        // No-op: connection is already established via stdio
    }
    /**
     * Send a message to the CLI via control_request.
     *
     * @param message - The JSON-RPC message to send
     */
    async send(message) {
        if (this.isClosed) {
            throw new Error('Transport is closed');
        }
        // Forward message to CLI via control_request
        this.sendMcpMessage(message);
    }
    /**
     * Close the transport.
     */
    async close() {
        var _a;
        if (this.isClosed) {
            return;
        }
        this.isClosed = true;
        (_a = this.onclose) === null || _a === void 0 ? void 0 : _a.call(this);
    }
    /**
     * Check if the transport is closed.
     */
    get closed() {
        return this.isClosed;
    }
    /**
     * Handle incoming message from CLI.
     * This method should be called when the CLI sends a message to this server.
     *
     * @param message - The JSON-RPC message from CLI
     */
    handleIncomingMessage(message) {
        var _a;
        if (this.isClosed) {
            return;
        }
        (_a = this.onmessage) === null || _a === void 0 ? void 0 : _a.call(this, message);
    }
}
exports.SdkControlServerTransport = SdkControlServerTransport;
//# sourceMappingURL=sdk-control-server-transport.js.map