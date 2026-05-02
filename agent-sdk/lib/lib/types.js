"use strict";
/**
 * Genie Agent SDK Types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXIT_REASONS = exports.HOOK_EVENTS = void 0;
// ============= Constants =============
exports.HOOK_EVENTS = [
    'PreToolUse',
    'PostToolUse',
    'PostToolUseFailure',
    'Notification',
    'UserPromptSubmit',
    'SessionStart',
    'SessionEnd',
    'Stop',
    'SubagentStart',
    'SubagentStop',
    'PreCompact',
    'PermissionRequest',
];
exports.EXIT_REASONS = [
    'user_exit',
    'interrupt',
    'error',
    'end_turn',
    'max_turns',
    'max_budget_usd',
];
//# sourceMappingURL=types.js.map