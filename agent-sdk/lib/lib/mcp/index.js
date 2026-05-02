"use strict";
/**
 * MCP (Model Context Protocol) Integration
 *
 * This module provides utilities for creating and managing SDK MCP servers
 * that can be integrated with the CLI via the control protocol.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SdkControlServerTransport = exports.tool = exports.createSdkMcpServer = void 0;
var create_sdk_mcp_server_1 = require("./create-sdk-mcp-server");
Object.defineProperty(exports, "createSdkMcpServer", { enumerable: true, get: function () { return create_sdk_mcp_server_1.createSdkMcpServer; } });
Object.defineProperty(exports, "tool", { enumerable: true, get: function () { return create_sdk_mcp_server_1.tool; } });
var sdk_control_server_transport_1 = require("./sdk-control-server-transport");
Object.defineProperty(exports, "SdkControlServerTransport", { enumerable: true, get: function () { return sdk_control_server_transport_1.SdkControlServerTransport; } });
//# sourceMappingURL=index.js.map