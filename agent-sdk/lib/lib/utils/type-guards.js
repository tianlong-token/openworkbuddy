"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMessage = isMessage;
function isMessage(message) {
    if (typeof message !== 'object' || message === null) {
        return false;
    }
    const type = message.type;
    return (type === 'system' ||
        type === 'user' ||
        type === 'assistant' ||
        type === 'stream_event' ||
        type === 'result' ||
        type === 'tool_progress' ||
        type === 'error' ||
        type === 'topic' ||
        type === 'image' ||
        type === 'file-history-snapshot');
}
//# sourceMappingURL=type-guards.js.map