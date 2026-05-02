/**
 * CLI Resolver
 *
 * Resolves the path to the CodeBuddy CLI.
 * Supports multiple resolution strategies:
 * 1. Environment variable (CODEBUDDY_CODE_PATH)
 * 2. Bundled CLI in package's cli/ directory
 * 3. Monorepo development path (fallback)
 */
/**
 * Error thrown when CLI cannot be found.
 */
export declare class CLINotFoundError extends Error {
    readonly platform: string;
    readonly arch: string;
    constructor(message: string, platform: string, arch: string);
}
/**
 * Resolve the path to the CodeBuddy CLI.
 *
 * Resolution order:
 * 1. CODEBUDDY_CODE_PATH environment variable
 * 2. Bundled CLI in package's cli/ directory
 * 3. Monorepo development path
 *
 * @returns The absolute path to the CLI
 * @throws CLINotFoundError if the CLI cannot be found
 */
export declare function resolveCLIPath(): string;
/**
 * Check if CLI is available without throwing.
 *
 * @returns The CLI path if found, null otherwise
 */
export declare function tryCLIPath(): string | null;
/**
 * Clear the cached CLI path.
 * Useful for testing or when the CLI location may have changed.
 */
export declare function clearCLIPathCache(): void;
/**
 * Resolve the version of the CodeBuddy CLI.
 *
 * Attempts to read version from multiple sources:
 * 1. metadata.json (for binary builds from goreleaser)
 * 2. package.json (for Node.js development environment)
 *
 * @param cliPath Optional CLI path. If not provided, will resolve using resolveCLIPath().
 * @returns Promise that resolves to the CLI version string, or 'unknown' if not found
 */
export declare function resolveCLIVersion(cliPath?: string): Promise<string>;
/**
 * Clear the cached CLI version.
 * Useful for testing or when the CLI may have been updated.
 */
export declare function clearCLIVersionCache(): void;
//# sourceMappingURL=cli-resolver.d.ts.map