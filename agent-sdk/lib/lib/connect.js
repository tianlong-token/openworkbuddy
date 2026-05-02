"use strict";
/**
 * CLI Connection Module
 *
 * Session lock utilities to prevent concurrent resume of the same session.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquireSessionLock = acquireSessionLock;
exports.releaseSessionLock = releaseSessionLock;
/**
 * Active session IDs to prevent concurrent resume of same session.
 */
const activeSessionIds = new Set();
/**
 * Acquire a lock for a session ID to prevent concurrent resume.
 *
 * @param sessionId - The session ID to lock.
 * @returns true if lock acquired, false if session is already in use.
 * @internal
 */
function acquireSessionLock(sessionId) {
    if (activeSessionIds.has(sessionId)) {
        return false;
    }
    activeSessionIds.add(sessionId);
    return true;
}
/**
 * Release a session lock.
 *
 * @param sessionId - The session ID to unlock.
 * @internal
 */
function releaseSessionLock(sessionId) {
    activeSessionIds.delete(sessionId);
}
//# sourceMappingURL=connect.js.map