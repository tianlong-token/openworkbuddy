/**
 * Authentication API (Unstable)
 *
 * Standalone authentication function for interactive login.
 * @experimental This API is unstable and may change in future versions.
 */
import type { AuthenticateParams, AuthenticateResponse, AuthEnvironment } from './types';
export interface AuthenticateOptions extends AuthenticateParams {
    /** Path to codebuddy-code executable */
    pathToCodebuddyCode?: string;
    /** Environment variables */
    env?: Record<string, string>;
}
export type { AuthEnvironment };
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
export declare function authenticate(options: AuthenticateOptions): Promise<AuthenticateResponse>;
/**
 * Options for the logout function.
 * @experimental This API is unstable and may change in future versions.
 */
export interface LogoutOptions {
    /** Predefined environment (mutually exclusive with endpoint) */
    environment?: AuthEnvironment;
    /** Custom endpoint URL for selfhosted environment (mutually exclusive with environment) */
    endpoint?: string;
    /** Path to codebuddy-code executable */
    pathToCodebuddyCode?: string;
    /** Environment variables */
    env?: Record<string, string>;
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
export declare function logout(options?: LogoutOptions): Promise<void>;
//# sourceMappingURL=auth.d.ts.map