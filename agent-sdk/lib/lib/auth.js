"use strict";
/**
 * Authentication API (Unstable)
 *
 * Standalone authentication function for interactive login.
 * @experimental This API is unstable and may change in future versions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.logout = logout;
const errors_1 = require("./errors");
const transport_1 = require("./transport");
/**
 * Initiate authentication flow.
 *
 * @param options Authentication options including onAuthUrl callback
 * @returns Authentication response with userinfo on success
 * @throws AuthenticationError on failure
 * @experimental This API is unstable and may change in future versions.
 *
 * @example
 * ```typescript
 * import { unstable_authenticate } from '@anthropic/agent-sdk';
 *
 * const result = await unstable_authenticate({
 *     onAuthUrl: (authState) => {
 *         console.log('Please login:', authState.authUrl);
 *         open(authState.authUrl);
 *     }
 * });
 *
 * console.log('Logged in as:', result.userinfo.userName);
 * ```
 */
async function authenticate(options) {
    var _a, _b, _c, _d;
    const { environment, endpoint, methodId = 'external', onAuthUrl, timeout = 300000, pathToCodebuddyCode, env, } = options;
    const transport = (0, transport_1.createTransport)({
        executablePath: pathToCodebuddyCode,
        env,
    });
    transport.start();
    // Send initialize request with environment info and check if already authenticated
    const initResponse = await transport.sendControlRequest({
        subtype: 'initialize',
        environment,
        endpoint,
    });
    // If already authenticated, return existing userinfo
    if (((_a = initResponse.account) === null || _a === void 0 ? void 0 : _a.userId) && ((_b = initResponse.account) === null || _b === void 0 ? void 0 : _b.token)) {
        transport.close();
        return {
            userinfo: {
                userId: initResponse.account.userId,
                userName: (_c = initResponse.account.userName) !== null && _c !== void 0 ? _c : '',
                userNickname: (_d = initResponse.account.userNickname) !== null && _d !== void 0 ? _d : '',
                token: initResponse.account.token,
                enterpriseId: initResponse.account.enterpriseId,
                enterprise: initResponse.account.enterprise,
            },
        };
    }
    // Not authenticated, start login flow
    return new Promise((resolve, reject) => {
        let settled = false; // Track if promise is already resolved/rejected
        const timeoutId = setTimeout(() => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            reject(new errors_1.AuthenticationError('timeout', 'Authentication timed out'));
        }, timeout);
        let authUrlCallback;
        let authResultCallback;
        const cleanup = () => {
            clearTimeout(timeoutId);
            authUrlCallback = undefined;
            authResultCallback = undefined;
            transport.close();
        };
        // Set up callback handlers
        authUrlCallback = async (authState) => {
            await onAuthUrl(authState);
        };
        authResultCallback = (success, userinfo, error) => {
            var _a, _b;
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            if (success && userinfo) {
                resolve({ userinfo });
            }
            else {
                const errorType = ((_a = error === null || error === void 0 ? void 0 : error.type) !== null && _a !== void 0 ? _a : 'auth_failed');
                reject(new errors_1.AuthenticationError(errorType, (_b = error === null || error === void 0 ? void 0 : error.message) !== null && _b !== void 0 ? _b : 'Authentication failed'));
            }
        };
        // Handle incoming control requests via transport-level handler
        // (control requests are routed directly in handleLine, not via messages())
        transport.onControlRequest(request => {
            try {
                const { subtype } = request.request;
                if (subtype === 'auth_url_callback') {
                    const { authState } = request.request;
                    if (authUrlCallback) {
                        // eslint-disable-next-line no-void
                        void Promise.resolve(authUrlCallback(authState)).catch(() => { });
                    }
                    transport.sendControlResponse(request.request_id, { received: true });
                }
                else if (subtype === 'auth_result_callback') {
                    const { success, userinfo, error } = request.request;
                    // Send response before cleanup to avoid "Transport closed" error
                    transport.sendControlResponse(request.request_id, { handled: true });
                    if (authResultCallback) {
                        authResultCallback(success, userinfo, error);
                    }
                }
            }
            catch (err) {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                reject(err);
            }
        });
        // Send authenticate request (fire-and-forget, auth flow uses callbacks)
        transport.sendControlRequestNoWait({
            subtype: 'authenticate',
            methodId,
            environment,
            endpoint,
        });
    });
}
/**
 * Logout and clear cached authentication token.
 *
 * This clears the cached token for the specified environment/endpoint,
 * so that the next call to `authenticate()` will require a new login.
 *
 * @param options Logout options specifying which environment to logout from
 * @experimental This API is unstable and may change in future versions.
 *
 * @example
 * ```typescript
 * import { unstable_v2_authenticate, unstable_v2_logout } from '@anthropic/agent-sdk';
 *
 * // Login
 * const result = await unstable_v2_authenticate({
 *     environment: 'external',
 *     onAuthUrl: (authState) => console.log('Login:', authState.authUrl),
 * });
 *
 * // Logout
 * await unstable_v2_logout({ environment: 'external' });
 *
 * // Login as different user
 * const newUser = await unstable_v2_authenticate({
 *     environment: 'external',
 *     onAuthUrl: (authState) => console.log('Login:', authState.authUrl),
 * });
 * ```
 */
async function logout(options = {}) {
    const { environment, endpoint, pathToCodebuddyCode, env } = options;
    const transport = (0, transport_1.createTransport)({
        executablePath: pathToCodebuddyCode,
        env,
    });
    transport.start();
    try {
        await transport.sendControlRequest({
            subtype: 'logout',
            environment,
            endpoint,
        });
    }
    finally {
        transport.close();
    }
}
//# sourceMappingURL=auth.js.map