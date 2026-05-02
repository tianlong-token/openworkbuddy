"use strict";
/**
 * Errors
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationError = exports.CLIStartupError = exports.ExecutionError = exports.AbortError = void 0;
/**
 * Error thrown when an operation is aborted.
 */
class AbortError extends Error {
    constructor(message = 'Operation aborted') {
        super(message);
        this.name = 'AbortError';
    }
}
exports.AbortError = AbortError;
/**
 * Error thrown when execution fails (e.g., authentication error, API error).
 * Contains the errors array from the ResultMessage.
 */
class ExecutionError extends Error {
    constructor(errors, subtype) {
        const message = errors.length > 0 ? errors[0] : 'Execution failed';
        super(message);
        this.name = 'ExecutionError';
        this.errors = errors;
        this.subtype = subtype;
    }
}
exports.ExecutionError = ExecutionError;
/**
 * Error thrown when CLI process crashes or fails during startup.
 * Contains stderr output and exit code for diagnostics.
 */
class CLIStartupError extends Error {
    constructor(message, stderr = '', exitCode = null) {
        super(message);
        this.name = 'CLIStartupError';
        this.stderr = stderr;
        this.exitCode = exitCode;
    }
}
exports.CLIStartupError = CLIStartupError;
/**
 * Error thrown when authentication fails.
 * @unstable This API is experimental and may change in future versions.
 */
class AuthenticationError extends Error {
    constructor(type, message) {
        super(message);
        this.name = 'AuthenticationError';
        this.type = type;
    }
}
exports.AuthenticationError = AuthenticationError;
//# sourceMappingURL=errors.js.map