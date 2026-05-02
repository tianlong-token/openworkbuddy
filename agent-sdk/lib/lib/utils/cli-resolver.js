"use strict";
/**
 * CLI Resolver
 *
 * Resolves the path to the CodeBuddy CLI.
 * Supports multiple resolution strategies:
 * 1. Environment variable (CODEBUDDY_CODE_PATH)
 * 2. Bundled CLI in package's cli/ directory
 * 3. Monorepo development path (fallback)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLINotFoundError = void 0;
exports.resolveCLIPath = resolveCLIPath;
exports.tryCLIPath = tryCLIPath;
exports.clearCLIPathCache = clearCLIPathCache;
exports.resolveCLIVersion = resolveCLIVersion;
exports.clearCLIVersionCache = clearCLIVersionCache;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
/**
 * Cached CLI path to avoid repeated filesystem operations.
 */
let cachedCLIPath = null;
/**
 * Cached CLI version to avoid repeated filesystem operations.
 */
let cachedCLIVersion = null;
/**
 * Binary name per platform.
 */
const BINARY_NAMES = {
    win32: 'codebuddy.exe',
    darwin: 'codebuddy',
    linux: 'codebuddy',
};
/**
 * Error thrown when CLI cannot be found.
 */
class CLINotFoundError extends Error {
    constructor(message, platform, arch) {
        super(message);
        this.platform = platform;
        this.arch = arch;
        this.name = 'CLINotFoundError';
    }
}
exports.CLINotFoundError = CLINotFoundError;
/**
 * Try to resolve CLI path from bundled cli/ directory.
 * The SDK package bundles the CLI in its cli/ directory.
 */
function resolveFromBundled() {
    // The bundled CLI is at: package-root/cli/bin/codebuddy
    // __dirname is lib/utils, so we go up to package root
    const bundledBinPath = (0, path_1.resolve)(__dirname, '../../cli/bin/codebuddy');
    if ((0, fs_1.existsSync)(bundledBinPath)) {
        return bundledBinPath;
    }
    return null;
}
/**
 * Try to resolve CLI path from monorepo development structure.
 */
function resolveFromMonorepo() {
    // Try relative to this package (agent-sdk-js -> agent-cli)
    // First try the bin script (for Node.js execution)
    const binScriptPath = (0, path_1.resolve)(__dirname, '../../../agent-cli/bin/codebuddy');
    if ((0, fs_1.existsSync)(binScriptPath)) {
        return binScriptPath;
    }
    // Fall back to looking for compiled binary in dist
    const binaryName = BINARY_NAMES[(0, os_1.platform)()] || 'codebuddy';
    const distPath = (0, path_1.resolve)(__dirname, '../../../agent-cli/dist', binaryName);
    if ((0, fs_1.existsSync)(distPath)) {
        return distPath;
    }
    return null;
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
function resolveCLIPath() {
    // Return cached path if available
    if (cachedCLIPath !== null) {
        return cachedCLIPath;
    }
    const currentPlatform = (0, os_1.platform)();
    const currentArch = process.arch;
    // 1. Environment variable takes precedence
    const envPath = process.env.CODEBUDDY_CODE_PATH;
    if (envPath) {
        if ((0, fs_1.existsSync)(envPath)) {
            cachedCLIPath = envPath;
            return cachedCLIPath;
        }
        // Warn but continue to try other methods
        console.warn(`Warning: CODEBUDDY_CODE_PATH is set to "${envPath}" but file does not exist. ` +
            'Falling back to other resolution methods.');
    }
    // 2. Try bundled CLI
    const bundledPath = resolveFromBundled();
    if (bundledPath) {
        cachedCLIPath = bundledPath;
        return cachedCLIPath;
    }
    // 3. Try monorepo development path
    const monorepoPath = resolveFromMonorepo();
    if (monorepoPath) {
        cachedCLIPath = monorepoPath;
        return cachedCLIPath;
    }
    // 4. Nothing found - throw helpful error
    throw new CLINotFoundError('CodeBuddy CLI not found.\n\n' +
        'Possible solutions:\n' +
        '  1. Reinstall the SDK package:\n' +
        '     npm install @tencent-ai/agent-sdk\n\n' +
        '  2. Set CODEBUDDY_CODE_PATH environment variable to the CLI path\n', currentPlatform, currentArch);
}
/**
 * Check if CLI is available without throwing.
 *
 * @returns The CLI path if found, null otherwise
 */
function tryCLIPath() {
    try {
        return resolveCLIPath();
    }
    catch (_a) {
        return null;
    }
}
/**
 * Clear the cached CLI path.
 * Useful for testing or when the CLI location may have changed.
 */
function clearCLIPathCache() {
    cachedCLIPath = null;
}
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
async function resolveCLIVersion(cliPath) {
    var _a, _b, _c;
    // Return cached version if available
    if (cachedCLIVersion !== null) {
        return cachedCLIVersion;
    }
    try {
        const resolvedPath = cliPath !== null && cliPath !== void 0 ? cliPath : resolveCLIPath();
        const cliDir = (0, path_1.dirname)(resolvedPath);
        const parentDir = (0, path_1.dirname)(cliDir);
        // 1. Try metadata.json (for binary builds)
        // Binary is at: .../out/<platform>/codebuddy, metadata.json is at .../out/metadata.json
        const metadataPath = (0, path_1.resolve)(parentDir, 'metadata.json');
        if ((0, fs_1.existsSync)(metadataPath)) {
            const metadata = JSON.parse(await (0, promises_1.readFile)(metadataPath, 'utf-8'));
            // Extract version from tag like "@tencent-ai/codebuddy-code@2.41.6" or with suffixes
            const tag = metadata.tag || '';
            const match = tag.match(/@(\d+\.\d+\.\d+)/);
            if (match) {
                cachedCLIVersion = match[1];
                return match[1];
            }
        }
        // 2. Try package.json (for Node.js development environment)
        // CLI binary is typically at: .../bin/codebuddy or .../dist/codebuddy
        let packageJsonPath = (0, path_1.resolve)(parentDir, 'package.json');
        if (!(0, fs_1.existsSync)(packageJsonPath)) {
            // Try two levels up (for dist/codebuddy structure)
            packageJsonPath = (0, path_1.resolve)((0, path_1.dirname)(parentDir), 'package.json');
        }
        if ((0, fs_1.existsSync)(packageJsonPath)) {
            const packageJson = JSON.parse(await (0, promises_1.readFile)(packageJsonPath, 'utf-8'));
            // Use publishConfig.customPackage.version if available (published version)
            const version = (_c = (_b = (_a = packageJson.publishConfig) === null || _a === void 0 ? void 0 : _a.customPackage) === null || _b === void 0 ? void 0 : _b.version) !== null && _c !== void 0 ? _c : packageJson.version;
            if (version && version !== '0.0.0') {
                cachedCLIVersion = version;
                return version;
            }
        }
    }
    catch (_d) {
        // Ignore errors and return unknown
    }
    cachedCLIVersion = 'unknown';
    return 'unknown';
}
/**
 * Clear the cached CLI version.
 * Useful for testing or when the CLI may have been updated.
 */
function clearCLIVersionCache() {
    cachedCLIVersion = null;
}
//# sourceMappingURL=cli-resolver.js.map