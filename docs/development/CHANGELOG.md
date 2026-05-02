# Changelog

All notable changes to WorkBuddy Runtime will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Memory → AgentLoop Integration**: Auto-save conversation history after each loop completion
- **Memory Context Loading**: Auto-load related memory entries at conversation start
- **New Tests**: 10 additional unit tests for agent-loop and memory-manager modules (48 total)
- **Proxy-Box Decision Document**: `docs/development/PROXY-BOX-DECISION.md` with 3方案 analysis

### Changed
- **Proxy-Box**: Removed compiled proprietary code, added placeholder README and updated package.json

### Fixed
- **Security**: Path traversal vulnerability in Read/Write/Edit tools — all paths now validated against working directory
- **Security**: Grep tool now uses proper regex matching instead of substring search
- **Security**: WebSearch URLs now resolved to absolute paths
- **Correctness**: WebSearch `numResults` parameter now matches schema definition (was `count`)
- **Correctness**: Array type validation in tool-router — `typeof []` now correctly identified as `'array'`
- **Compatibility**: Config path resolution works in both CommonJS and ES module environments
- **Robustness**: `parseInt`/`parseFloat` in config now validate for NaN before applying
- **Robustness**: `WORKBUDDY_ALLOWED_TOOLS` environment variable values now trimmed

---

## [0.1.0] — 2026-05-02

Initial release of WorkBuddy Runtime.

### Added
- **WorkBuddyRuntime** — Main runtime class with skill loading, tool execution, and session management
- **11 Tool Executors**:
  - `Read` — File/directory reading with offset/limit support
  - `Write` — File writing with automatic parent directory creation
  - `Edit` — Exact string replacement with uniqueness validation
  - `Bash` — Shell command execution with timeout (120s default)
  - `Glob` — File pattern matching using native Node.js `glob`
  - `Grep` — Regex-based file content search
  - `WebFetch` — URL content fetching with HTML stripping
  - `WebSearch` — Web search via DuckDuckGo HTML
  - `Agent` — Sub-agent dispatch (structured placeholder)
  - `TodoWrite` — Structured task list management
  - `Skill` — Skill invocation (structured placeholder)
- **LLM Provider** — OpenAI-compatible API wrapper with function calling support
- **Agent Loop** — Multi-turn conversation with automatic tool calling (max turns configurable)
- **Memory Store** — In-memory and file-based persistent memory
  - `InMemoryStore` — Fast, no persistence
  - `FileMemoryStore` — Disk-based JSON storage
- **Orchestrator** — Task orchestration with 4 modes:
  - `linear` — Sequential execution
  - `fork` — Parallel root tasks
  - `dag` — Dependency-aware execution
  - `team` — Role-based assignment
- **Skill Loader** — Load, parse, and validate skills from filesystem
  - 147 generic skills (Tencent-coupled removed)
  - YAML frontmatter parsing
  - Skill validation and warnings
- **CLI** — Command-line interface:
  - `list` — List all skills
  - `search <query>` — Search skills
  - `info <slug>` — Show skill details
  - `run <slug> [message]` — Execute skill with LLM
  - `chat` — Interactive chat mode
  - `config` — Show configuration
- **Configuration** — Environment variable based config with defaults
  - `WORKBUDDY_SKILLS_DIR`
  - `WORKBUDDY_LLM_API_URL`, `WORKBUDDY_LLM_API_KEY`, `WORKBUDDY_LLM_MODEL`
  - `WORKBUDDY_MEMORY_STORE`, `WORKBUDDY_LOG_LEVEL`
  - `WORKBUDDY_ALLOWED_TOOLS`
- **Cross-Platform Support** — Windows/Linux/macOS compatible
  - No shell command dependencies (no `find`/`grep`/`curl`)
  - Native Node.js `glob` and `fetch` used

### Known Issues
- Agent executor returns placeholder — full session management integration needed
- Skill executor returns placeholder — full AgentLoop integration needed
- TodoWrite uses in-memory store — not persisted across sessions
- Memory Store API backend not implemented
- Task tool registered but not implemented
- No session TTL/cleanup — sessions map grows indefinitely
- No LLM API retry logic or timeout handling

### Planned for v0.2.0
- Memory → AgentLoop integration (auto-save conversation history)
- Full Agent executor with session spawning
- Full Skill executor with AgentLoop integration
- Proxy-box sandbox isolation
- Session TTL and cleanup
- LLM API retry and timeout handling
- CLI `--json` and `--session` flags
- API Memory Store backend

### Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `glob` | ^10.4.5 | File pattern matching |
| `cheerio` | ^1.2.0 | HTML parsing |
| `yaml` | ^2.4.0 | YAML frontmatter parsing |
| `zod` | ^3.23.0 | Runtime validation |

### Dev Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.4.0 | Type checking |
| `tsx` | ^4.7.0 | TypeScript execution |
| `vitest` | ^1.5.0 | Unit testing |
| `@types/node` | ^25.6.0 | Node.js type definitions |

### Test Coverage
- 38 unit tests across 3 test files
- All tests passing (`npx vitest run`)
- Coverage: tool-executors (19), agent-loop (10), llm-provider (9)
