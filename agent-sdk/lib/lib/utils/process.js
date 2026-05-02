"use strict";
/**
 * Process utilities for safe I/O operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeToStderr = writeToStderr;
const CHUNK_SIZE = 2000;
/**
 * Write data to stderr in chunks to avoid buffer overflow.
 */
function writeToStderr(data) {
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        process.stderr.write(data.substring(i, i + CHUNK_SIZE));
    }
}
//# sourceMappingURL=process.js.map