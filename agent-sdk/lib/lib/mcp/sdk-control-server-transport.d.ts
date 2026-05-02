/**
 * SDK Control Server Transport
 *
 * Custom transport implementation that bridges SDK MCP servers to CLI process.
 * This transport forwards MCP messages through the control protocol.
 */
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage as McpJSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
export type { McpJSONRPCMessage };
/**
 * Callback function type for sending MCP messages to CLI.
 */
export type SendMcpMessageCallback = (message: McpJSONRPCMessage) => void;
/**
 * SdkControlServerTransport - bridges MCP servers to CLI via control messages.
 *
 * This transport implements the MCP Transport interface and forwards all
 * messages through a callback function that wraps them in control_request
 * messages for the CLI.
 */
export declare class SdkControlServerTransport implements Transport {
    private sendMcpMessage;
    private isClosed;
    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: (message: McpJSONRPCMessage) => void;
    /**
     * Create a new SDK Control Server Transport.
     *
     * @param sendMcpMessage - Callback function to forward MCP messages to CLI
     */
    constructor(sendMcpMessage: SendMcpMessageCallback);
    /**
     * Start the transport.
     * No-op since connection is already established via stdio.
     */
    start(): Promise<void>;
    /**
     * Send a message to the CLI via control_request.
     *
     * @param message - The JSON-RPC message to send
     */
    send(message: McpJSONRPCMessage): Promise<void>;
    /**
     * Close the transport.
     */
    close(): Promise<void>;
    /**
     * Check if the transport is closed.
     */
    get closed(): boolean;
    /**
     * Handle incoming message from CLI.
     * This method should be called when the CLI sends a message to this server.
     *
     * @param message - The JSON-RPC message from CLI
     */
    handleIncomingMessage(message: McpJSONRPCMessage): void;
}
//# sourceMappingURL=sdk-control-server-transport.d.ts.map