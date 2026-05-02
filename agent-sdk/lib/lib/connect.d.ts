/**
 * CLI Connection Module
 *
 * Session lock utilities to prevent concurrent resume of the same session.
 */
/**
 * Acquire a lock for a session ID to prevent concurrent resume.
 *
 * @param sessionId - The session ID to lock.
 * @returns true if lock acquired, false if session is already in use.
 * @internal
 */
export declare function acquireSessionLock(sessionId: string): boolean;
/**
 * Release a session lock.
 *
 * @param sessionId - The session ID to unlock.
 * @internal
 */
export declare function releaseSessionLock(sessionId: string): void;
//# sourceMappingURL=connect.d.ts.map