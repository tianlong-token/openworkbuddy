/**
 * Genie Agent SDK for JavaScript/TypeScript
 *
 * @example
 * ```typescript
 * import { query } from '@tencent-ai/genie-agent-sdk';
 *
 * const q = query({
 *   prompt: 'List all files in the current directory',
 *   options: { permissionMode: 'acceptEdits' }
 * });
 *
 * for await (const message of q) {
 *   console.log(message);
 * }
 * ```
 */
export { query } from './query';
export { Query } from './query';
export { createSession as unstable_v2_createSession, resumeSession as unstable_v2_resumeSession, prompt as unstable_v2_prompt, } from './session';
export { authenticate as unstable_v2_authenticate, logout as unstable_v2_logout } from './auth';
export type { AuthenticateOptions, AuthEnvironment, LogoutOptions } from './auth';
export { createSdkMcpServer, tool } from './mcp';
export type { SdkMcpServerOptions, SdkMcpServerResult, SdkMcpToolDefinition, AnyZodRawShape, InferShape, ToolHandler, } from './mcp';
export { HOOK_EVENTS, EXIT_REASONS } from './types';
export { AbortError, CLIStartupError, ExecutionError } from './errors';
export { installMarketplace, removeMarketplace, installPlugin, enablePlugin, disablePlugin, } from './plugin';
export type { InstallMarketplaceOptions, RemoveMarketplaceOptions, InstallPluginOptions, SettingsOperationResult, } from './plugin';
export type { Options, SessionOptions } from './types';
export type { PermissionMode, PermissionBehavior, PermissionResult, PermissionUpdate, CanUseTool, CanUseToolOptions, } from './types';
export type { HookEvent, HookCallback, HookCallbackMatcher, HookInput, HookJSONOutput, SyncHookJSONOutput, AsyncHookJSONOutput, BaseHookInput, PreToolUseHookInput, PostToolUseHookInput, PostToolUseFailureHookInput, NotificationHookInput, UserPromptSubmitHookInput, SessionStartHookInput, SessionEndHookInput, StopHookInput, SubagentStartHookInput, SubagentStopHookInput, PreCompactHookInput, PermissionRequestHookInput, } from './types';
export type { Message, SystemMessage, UserMessage, AssistantMessage, PartialAssistantMessage, ResultMessage, CompactBoundaryMessage, StatusMessage, ToolProgressMessage, ErrorMessage, TopicMessage, FileHistorySnapshotMessage, PermissionDenial, } from './types';
export type { ContentBlock, TextContentBlock, ToolUseContentBlock, ToolResultContentBlock, ImageContentBlock, ImageMediaType, Base64ImageSource, UrlImageSource, ThinkingContentBlock, } from './types';
export type { SlashCommand, ModelInfo, AccountInfo, McpServerStatus, RawLanguageModel, AvailableCommand, } from './types';
export type { SubscriptionChannel, ControlSubscribeRequest, ControlSubscribeResponse, ControlUnsubscribeRequest, ControlUnsubscribeResponse, ControlNotificationMessage, CommandsNotificationData, } from './types';
export type { ThinkingConfig, Effort } from './types';
export type { OutputFormat, JsonSchemaOutputFormat } from './types';
export type { RawMessageStreamEvent } from './types';
export type { McpServerConfig, McpStdioServerConfig, McpSSEServerConfig, McpHttpServerConfig, McpSdkServerConfig, } from './types';
export type { AgentDefinition } from './types';
export type { AskUserQuestionOption, AskUserQuestionQuestion, AskUserQuestionInput, ToolInputMap, KnownToolName, } from './types';
export type { SandboxSettings } from './types';
export type { Session } from './types';
//# sourceMappingURL=index.d.ts.map