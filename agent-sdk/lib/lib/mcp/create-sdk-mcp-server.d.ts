/**
 * createSdkMcpServer - Create an SDK MCP Server
 *
 * This function creates an MCP server that can be integrated into the SDK
 * and used with the CLI via the control protocol.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ZodRawShape } from 'zod';
interface ZodRawShapeV4 {
    [k: string]: any;
}
export type AnyZodRawShape = ZodRawShape | ZodRawShapeV4;
/**
 * Infer the output type from a Zod raw shape.
 * Works with both Zod 3 and Zod 4 schemas.
 */
export type InferShape<T extends AnyZodRawShape> = {
    [K in keyof T]: T[K] extends {
        _output: infer O;
    } ? O : never;
} & {};
/**
 * Tool handler function type.
 * This is a simplified version that works with our InferShape type.
 */
export type ToolHandler<Schema extends AnyZodRawShape> = (args: InferShape<Schema>, extra: unknown) => CallToolResult | Promise<CallToolResult>;
/**
 * Tool definition for SDK MCP Server.
 * Contains a handler function, so not serializable.
 * Supports both Zod 3 and Zod 4 schemas.
 */
export interface SdkMcpToolDefinition<Schema extends AnyZodRawShape = AnyZodRawShape> {
    /** Tool name */
    name: string;
    /** Tool description */
    description: string;
    /** Input schema as Zod shape */
    inputSchema: Schema;
    /** Handler function */
    handler: ToolHandler<Schema>;
}
/**
 * Options for creating an SDK MCP Server.
 */
export interface SdkMcpServerOptions {
    /** Server name (must be unique within the session) */
    name: string;
    /** Server version (defaults to "1.0.0") */
    version?: string;
    /** Tool definitions to register */
    tools?: Array<SdkMcpToolDefinition<any>>;
}
/**
 * Result type for createSdkMcpServer.
 */
export interface SdkMcpServerResult {
    /** Type discriminator - always "sdk" for SDK MCP servers */
    type: 'sdk';
    /** Server name */
    name: string;
    /** The MCP server instance */
    instance: McpServer;
}
/**
 * Helper function to define an MCP tool with type-safe schema and handler.
 *
 * This function provides a convenient way to create tool definitions that can be
 * passed to createSdkMcpServer(). It ensures type safety between the input schema
 * and the handler function parameters.
 *
 * @param name - The name of the tool (should be unique within the server)
 * @param description - A description of what the tool does
 * @param inputSchema - A Zod shape defining the input parameters
 * @param handler - The function that executes when the tool is called
 * @returns A tool definition object
 *
 * @example
 * ```typescript
 * import { tool, createSdkMcpServer } from '@tencent-ai/genie-agent-sdk';
 * import { z } from 'zod';
 *
 * const weatherTool = tool(
 *   'get_weather',
 *   'Get current weather for a location',
 *   {
 *     location: z.string().describe('City name or coordinates'),
 *     units: z.enum(['celsius', 'fahrenheit']).optional().describe('Temperature units')
 *   },
 *   async ({ location, units }) => {
 *     const weather = await fetchWeather(location, units);
 *     return {
 *       content: [
 *         { type: 'text', text: `Weather in ${location}: ${weather.temperature}°` }
 *       ]
 *     };
 *   }
 * );
 *
 * const server = createSdkMcpServer({
 *   name: 'weather-server',
 *   tools: [weatherTool]
 * });
 * ```
 */
export declare function tool<Schema extends AnyZodRawShape>(name: string, description: string, inputSchema: Schema, handler: ToolHandler<Schema>): SdkMcpToolDefinition<Schema>;
/**
 * Create an SDK MCP Server.
 *
 * This function creates an MCP server that can be passed to the query() function
 * via the mcpServers option. The server runs within the SDK process and
 * communicates with the CLI via the control protocol.
 *
 * @param options - Server configuration options
 * @returns SDK MCP server result that can be passed to query()
 *
 * @example
 * ```typescript
 * import { createSdkMcpServer, tool, query } from '@tencent-ai/genie-agent-sdk';
 * import { z } from 'zod';
 *
 * // Define tools using the tool() helper
 * const weatherTool = tool(
 *   'get_weather',
 *   'Get weather for a location',
 *   {
 *     location: z.string().describe('The location to get weather for'),
 *     units: z.enum(['celsius', 'fahrenheit']).optional()
 *   },
 *   async ({ location, units }) => {
 *     return {
 *       content: [
 *         { type: 'text', text: `Weather for ${location}: Sunny, 72°` }
 *       ]
 *     };
 *   }
 * );
 *
 * // Create server with tools
 * const myServer = createSdkMcpServer({
 *   name: 'my-custom-server',
 *   version: '1.0.0',
 *   tools: [weatherTool]
 * });
 *
 * // Use in query
 * const result = query({
 *   prompt: "What's the weather in Tokyo?",
 *   options: {
 *     mcpServers: {
 *       'my-custom-server': myServer
 *     }
 *   }
 * });
 * ```
 */
export declare function createSdkMcpServer(options: SdkMcpServerOptions): SdkMcpServerResult;
export {};
//# sourceMappingURL=create-sdk-mcp-server.d.ts.map