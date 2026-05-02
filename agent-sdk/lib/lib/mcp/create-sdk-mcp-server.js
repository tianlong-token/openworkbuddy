"use strict";
/**
 * createSdkMcpServer - Create an SDK MCP Server
 *
 * This function creates an MCP server that can be integrated into the SDK
 * and used with the CLI via the control protocol.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tool = tool;
exports.createSdkMcpServer = createSdkMcpServer;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
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
function tool(name, description, inputSchema, handler) {
    return {
        name,
        description,
        inputSchema,
        handler,
    };
}
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
function createSdkMcpServer(options) {
    var _a;
    // Create MCP server instance
    const server = new mcp_js_1.McpServer({
        name: options.name,
        version: (_a = options.version) !== null && _a !== void 0 ? _a : '1.0.0',
    }, {
        capabilities: {
            tools: options.tools ? {} : undefined,
        },
    });
    // Register tools
    if (options.tools) {
        for (const toolDef of options.tools) {
            // Type assertion is needed because:
            // 1. MCP SDK's ToolCallback uses z.objectOutputType<Args, ZodTypeAny> for args inference
            // 2. We use InferShape<Schema> which is structurally equivalent but TypeScript cannot verify
            // 3. The 'extra' parameter type differs (RequestHandlerExtra vs unknown)
            // At runtime, both produce the same shape, so this is safe.
            server.registerTool(toolDef.name, {
                description: toolDef.description,
                inputSchema: toolDef.inputSchema,
            }, toolDef.handler);
        }
    }
    // Return server info
    return {
        type: 'sdk',
        name: options.name,
        instance: server,
    };
}
//# sourceMappingURL=create-sdk-mcp-server.js.map