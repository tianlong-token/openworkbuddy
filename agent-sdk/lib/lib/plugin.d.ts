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
/**
 * Marketplace source configuration (GitHub only)
 */
export interface MarketplaceSource {
    source: 'github';
    repo: string;
}
/**
 * Marketplace configuration item
 */
export interface MarketplaceConfigItem {
    source: MarketplaceSource;
    autoUpdate?: boolean;
}
/**
 * Options for installing a marketplace
 */
export interface InstallMarketplaceOptions {
    /** Marketplace name (identifier) */
    name: string;
    /** GitHub repository in format "owner/repo" */
    repo: string;
    /** Enable auto-update (default: true) */
    autoUpdate?: boolean;
}
/**
 * Options for removing a marketplace
 */
export interface RemoveMarketplaceOptions {
    /** Marketplace name to remove */
    name: string;
    /** Also remove all plugins from this marketplace (default: true) */
    removePlugins?: boolean;
}
/**
 * Options for installing a plugin
 */
export interface InstallPluginOptions {
    /** Plugin name */
    name: string;
    /** Marketplace name where the plugin is from */
    marketplace: string;
}
/**
 * Result of a settings operation
 */
export interface SettingsOperationResult {
    success: boolean;
    message: string;
}
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
export declare function installMarketplace(options: InstallMarketplaceOptions): Promise<SettingsOperationResult>;
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
export declare function removeMarketplace(options: RemoveMarketplaceOptions): Promise<SettingsOperationResult>;
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
export declare function installPlugin(options: InstallPluginOptions): Promise<SettingsOperationResult>;
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
export declare function enablePlugin(name: string, marketplace: string): Promise<SettingsOperationResult>;
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
export declare function disablePlugin(name: string, marketplace: string): Promise<SettingsOperationResult>;
//# sourceMappingURL=plugin.d.ts.map