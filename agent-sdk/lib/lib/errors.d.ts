/**
 * Errors
 */
/**
 * Error thrown when an operation is aborted.
 */
export declare class AbortError extends Error {
    constructor(message?: string);
}
/**
 * Error thrown when execution fails (e.g., authentication error, API error).
 * Contains the errors array from the ResultMessage.
 */
export declare class ExecutionError extends Error {
    readonly errors: string[];
    readonly subtype: string;
    constructor(errors: string[], subtype: string);
}
/**
 * Error thrown when CLI process crashes or fails during startup.
 * Contains stderr output and exit code for diagnostics.
 */
export declare class CLIStartupError extends Error {
    readonly stderr: string;
    readonly exitCode: number | null;
    constructor(message: string, stderr?: string, exitCode?: number | null);
}
/**
 * Authentication error types.
 * @unstable This API is experimental and may change in future versions.
 */
export type AuthenticationErrorType = 'timeout' | 'cancelled' | 'network_error' | 'invalid_method' | 'auth_failed';
/**
 * Error thrown when authentication fails.
 * @unstable This API is experimental and may change in future versions.
 */
export declare class AuthenticationError extends Error {
    readonly type: AuthenticationErrorType;
    constructor(type: AuthenticationErrorType, message: string);
}
//# sourceMappingURL=errors.d.ts.map