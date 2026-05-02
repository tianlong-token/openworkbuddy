"use strict";
/**
 * Transport Layer
 *
 * Abstract interface for communication with CLI.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessTransport = void 0;
exports.createTransport = createTransport;
const process_transport_1 = require("./process-transport");
/**
 * Create a transport that communicates with CLI via spawned process.
 */
function createTransport(options = {}) {
    return new process_transport_1.ProcessTransport(options);
}
// Re-export ProcessTransport
var process_transport_2 = require("./process-transport");
Object.defineProperty(exports, "ProcessTransport", { enumerable: true, get: function () { return process_transport_2.ProcessTransport; } });
//# sourceMappingURL=index.js.map