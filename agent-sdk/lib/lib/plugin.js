"use strict";
/**
 * CodeBuddy Plugin Manager
 *
 * Provides programmatic access to manage marketplaces and plugins
 * by directly manipulating ~/.codebuddy/settings.json
 *
 * @example
 * ```typescript
 * import { installMarketplace, installPlugin, enablePlugin } from '@genie/agent-sdk-js';
 *
 * // Install a marketplace
 * await installMarketplace({
 *   name: 'claude-plugins-official',
 *   repo: 'anthropics/claude-plugins-official',
 * });
 *
 * // Install and enable a plugin
 * await installPlugin({
 *   name: 'typescript-lsp',
 *   marketplace: 'claude-plugins-official',
 * });
 * ```
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.installMarketplace = installMarketplace;
exports.removeMarketplace = removeMarketplace;
exports.installPlugin = installPlugin;
exports.enablePlugin = enablePlugin;
exports.disablePlugin = disablePlugin;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
// ============= Internal Helpers =============
const USER_DATA_DIR_NAME = '.codebuddy';
function getCodebuddyDir() {
    return path.join(os.homedir(), USER_DATA_DIR_NAME);
}
function getSettingsPath() {
    return path.join(getCodebuddyDir(), 'settings.json');
}
function getKnownMarketplacesPath() {
    return path.join(getCodebuddyDir(), 'plugins', 'known_marketplaces.json');
}
function ensureSettingsDir() {
    const settingsDir = path.dirname(getSettingsPath());
    if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true });
    }
}
function readSettings() {
    const settingsPath = getSettingsPath();
    if (!fs.existsSync(settingsPath)) {
        return {};
    }
    try {
        const content = fs.readFileSync(settingsPath, 'utf-8');
        return JSON.parse(content);
    }
    catch (_a) {
        return {};
    }
}
function writeSettings(settings) {
    ensureSettingsDir();
    const settingsPath = getSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}
function readKnownMarketplaces() {
    const filePath = getKnownMarketplacesPath();
    if (!fs.existsSync(filePath)) {
        return {};
    }
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
    catch (_a) {
        return {};
    }
}
function writeKnownMarketplaces(data) {
    const filePath = getKnownMarketplacesPath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
function getPluginId(name, marketplace) {
    return `${name}@${marketplace}`;
}
// ============= Marketplace API =============
/**
 * Install a marketplace by adding it to extraKnownMarketplaces
 *
 * @param options - Installation options
 * @returns Operation result
 *
 * @example
 * ```typescript
 * await installMarketplace({
 *   name: 'claude-plugins-official',
 *   repo: 'anthropics/claude-plugins-official',
 * });
 * ```
 */
async function installMarketplace(options) {
    const { name, repo, autoUpdate = true } = options;
    if (!name || !repo) {
        return {
            success: false,
            message: 'Marketplace name and repo are required',
        };
    }
    if (!repo.includes('/')) {
        return {
            success: false,
            message: 'Repo must be in format "owner/repo"',
        };
    }
    const settings = readSettings();
    if (!settings.extraKnownMarketplaces) {
        settings.extraKnownMarketplaces = {};
    }
    if (settings.extraKnownMarketplaces[name]) {
        return {
            success: false,
            message: `Marketplace "${name}" already exists`,
        };
    }
    settings.extraKnownMarketplaces[name] = {
        source: {
            source: 'github',
            repo,
        },
        autoUpdate,
    };
    writeSettings(settings);
    return {
        success: true,
        message: `Marketplace "${name}" installed successfully`,
    };
}
/**
 * Remove a marketplace from settings and known_marketplaces.json
 *
 * @param options - Removal options
 * @returns Operation result
 *
 * @example
 * ```typescript
 * await removeMarketplace({ name: 'team-marketplace' });
 * ```
 */
async function removeMarketplace(options) {
    var _a;
    const { name, removePlugins = true } = options;
    if (!name) {
        return {
            success: false,
            message: 'Marketplace name is required',
        };
    }
    const settings = readSettings();
    const knownMarketplaces = readKnownMarketplaces();
    // Check if marketplace exists in either location
    const inSettings = (_a = settings.extraKnownMarketplaces) === null || _a === void 0 ? void 0 : _a[name];
    const inKnown = knownMarketplaces[name];
    if (!inSettings && !inKnown) {
        return {
            success: false,
            message: `Marketplace "${name}" not found`,
        };
    }
    // Remove from settings.json
    if (settings.extraKnownMarketplaces && settings.extraKnownMarketplaces[name]) {
        delete settings.extraKnownMarketplaces[name];
        if (Object.keys(settings.extraKnownMarketplaces).length === 0) {
            delete settings.extraKnownMarketplaces;
        }
    }
    // Remove plugins from settings if requested
    if (removePlugins && settings.enabledPlugins) {
        const pluginIds = Object.keys(settings.enabledPlugins);
        for (const pluginId of pluginIds) {
            if (pluginId.endsWith(`@${name}`)) {
                delete settings.enabledPlugins[pluginId];
            }
        }
        if (Object.keys(settings.enabledPlugins).length === 0) {
            delete settings.enabledPlugins;
        }
    }
    writeSettings(settings);
    // Remove from known_marketplaces.json
    if (knownMarketplaces[name]) {
        delete knownMarketplaces[name];
        writeKnownMarketplaces(knownMarketplaces);
    }
    return {
        success: true,
        message: `Marketplace "${name}" removed successfully`,
    };
}
// ============= Plugin API =============
/**
 * Install and enable a plugin
 *
 * @param options - Installation options
 * @returns Operation result
 *
 * @example
 * ```typescript
 * await installPlugin({
 *   name: 'typescript-lsp',
 *   marketplace: 'claude-plugins-official',
 * });
 * ```
 */
async function installPlugin(options) {
    const { name, marketplace } = options;
    if (!name || !marketplace) {
        return {
            success: false,
            message: 'Plugin name and marketplace are required',
        };
    }
    const pluginId = getPluginId(name, marketplace);
    const settings = readSettings();
    if (!settings.enabledPlugins) {
        settings.enabledPlugins = {};
    }
    settings.enabledPlugins[pluginId] = true;
    writeSettings(settings);
    return {
        success: true,
        message: `Plugin "${pluginId}" installed and enabled successfully`,
    };
}
/**
 * Enable a plugin
 *
 * @param name - Plugin name
 * @param marketplace - Marketplace name
 * @returns Operation result
 *
 * @example
 * ```typescript
 * await enablePlugin('typescript-lsp', 'claude-plugins-official');
 * ```
 */
async function enablePlugin(name, marketplace) {
    return installPlugin({ name, marketplace });
}
/**
 * Disable a plugin
 *
 * @param name - Plugin name
 * @param marketplace - Marketplace name
 * @returns Operation result
 *
 * @example
 * ```typescript
 * await disablePlugin('typescript-lsp', 'claude-plugins-official');
 * ```
 */
async function disablePlugin(name, marketplace) {
    if (!name || !marketplace) {
        return {
            success: false,
            message: 'Plugin name and marketplace are required',
        };
    }
    const pluginId = getPluginId(name, marketplace);
    const settings = readSettings();
    if (!settings.enabledPlugins) {
        settings.enabledPlugins = {};
    }
    settings.enabledPlugins[pluginId] = false;
    writeSettings(settings);
    return {
        success: true,
        message: `Plugin "${pluginId}" disabled successfully`,
    };
}
//# sourceMappingURL=plugin.js.map