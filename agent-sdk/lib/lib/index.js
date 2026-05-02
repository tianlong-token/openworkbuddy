"use strict";
/**
 * Genie Agent SDK for JavaScript/TypeScript
 *
 * @example
 * ```typescript
 * import { query } from '@tencent-ai/genie-agent-sdk';
 *
 * const q = query({
 *   prompt: 'List all files in the current directory',
 *   options: { permissionMode: 'acceptEdits' }
 * });
 *
 * for await (const message of q) {
 *   console.log(message);
 * }
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.disablePlugin = exports.enablePlugin = exports.installPlugin = exports.removeMarketplace = exports.installMarketplace = exports.ExecutionError = exports.CLIStartupError = exports.AbortError = exports.EXIT_REASONS = exports.HOOK_EVENTS = exports.tool = exports.createSdkMcpServer = exports.unstable_v2_logout = exports.unstable_v2_authenticate = exports.unstable_v2_resumeSession = exports.unstable_v2_createSession = exports.Query = exports.query = void 0;
// ============= Main API =============
var query_1 = require("./query");
Object.defineProperty(exports, "query", { enumerable: true, get: function () { return query_1.query; } });
var query_2 = require("./query");
Object.defineProperty(exports, "Query", { enumerable: true, get: function () { return query_2.Query; } });
// V2 API (unstable)
var session_1 = require("./session");
Object.defineProperty(exports, "unstable_v2_createSession", { enumerable: true, get: function () { return session_1.createSession; } });
Object.defineProperty(exports, "unstable_v2_resumeSession", { enumerable: true, get: function () { return session_1.resumeSession; } });
Object.defineProperty(exports, "unstable_v2_prompt", { enumerable: true, get: function () { return session_1.prompt; } });
// Authentication API (unstable)
var auth_1 = require("./auth");
Object.defineProperty(exports, "unstable_v2_authenticate", { enumerable: true, get: function () { return auth_1.authenticate; } });
Object.defineProperty(exports, "unstable_v2_logout", { enumerable: true, get: function () { return auth_1.logout; } });
// ============= MCP Server API =============
var mcp_1 = require("./mcp");
Object.defineProperty(exports, "createSdkMcpServer", { enumerable: true, get: function () { return mcp_1.createSdkMcpServer; } });
Object.defineProperty(exports, "tool", { enumerable: true, get: function () { return mcp_1.tool; } });
// ============= Constants =============
var types_1 = require("./types");
Object.defineProperty(exports, "HOOK_EVENTS", { enumerable: true, get: function () { return types_1.HOOK_EVENTS; } });
Object.defineProperty(exports, "EXIT_REASONS", { enumerable: true, get: function () { return types_1.EXIT_REASONS; } });
// ============= Errors =============
var errors_1 = require("./errors");
Object.defineProperty(exports, "AbortError", { enumerable: true, get: function () { return errors_1.AbortError; } });
Object.defineProperty(exports, "CLIStartupError", { enumerable: true, get: function () { return errors_1.CLIStartupError; } });
Object.defineProperty(exports, "ExecutionError", { enumerable: true, get: function () { return errors_1.ExecutionError; } });
// ============= Plugin API =============
var plugin_1 = require("./plugin");
Object.defineProperty(exports, "installMarketplace", { enumerable: true, get: function () { return plugin_1.installMarketplace; } });
Object.defineProperty(exports, "removeMarketplace", { enumerable: true, get: function () { return plugin_1.removeMarketplace; } });
Object.defineProperty(exports, "installPlugin", { enumerable: true, get: function () { return plugin_1.installPlugin; } });
Object.defineProperty(exports, "enablePlugin", { enumerable: true, get: function () { return plugin_1.enablePlugin; } });
Object.defineProperty(exports, "disablePlugin", { enumerable: true, get: function () { return plugin_1.disablePlugin; } });
//# sourceMappingURL=index.js.map