"use strict";
/**
 * Environment variable utilities.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEnvTruthy = isEnvTruthy;
/**
 * Check if an environment variable value is truthy.
 * Accepts: '1', 'true', 'yes', 'on' (case-insensitive)
 */
function isEnvTruthy(envVar) {
    if (!envVar) {
        return false;
    }
    if (typeof envVar === 'boolean') {
        return envVar;
    }
    const normalizedValue = envVar.toLowerCase().trim();
    return ['1', 'true', 'yes', 'on'].includes(normalizedValue);
}
//# sourceMappingURL=env-utils.js.map