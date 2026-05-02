# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0-alpha] - 2026-05-02

### Added
- **Session Management**: `DefaultSessionManager` with state machine (`idle` → `working` → `completed`)
- **Session CLI**: `workbuddy sessions` command to list active sessions
- **TodoWrite Persistence**: Todos now persist to `.workbuddy/todos/todos.json`
- **TodoWrite CLI**: `workbuddy todos` command with 6 subcommands (`list`, `add`, `complete`, `cancel`, `delete`, `clear`)
- **Skill Tool**: Real skill-to-skill invocation via `runtime.runSkill()`
- **Agent Tool**: Real sub-agent dispatch using existing `AgentLoop` instance
- **E2E Tests**: 21 end-to-end integration tests covering skill loading, search, tools, sessions, memory, and error handling
- **GitHub Actions CI**: Multi-Node version matrix (18/20/22) in `.github/workflows/ci.yml`

### Changed
- Tool count from 11 → 12 (added Task placeholder in schema)
- Test count from 68 → 89 (7 test files)
- Updated `README.md`, `STATUS.md`, `ROADMAP.md` to reflect v0.2.0-alpha state

### Fixed
- `.env.example` API key leaked (replaced with placeholder)
- E2E test skills directory path resolution

## [0.1.0] - 2026-05-02

### Added
- **147 Pre-installed Skills**: Covering programming, writing, research, data analysis
- **11 Tool Executors**: Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch, Agent, Skill, TodoWrite
- **Agent Loop**: LLM ↔ Tool call cycle with up to 20 turns
- **Memory System**: `InMemoryStore` and `FileMemoryStore` with session-based querying
- **CLI Commands**: `list`, `search`, `info`, `run`, `chat`, `config`
- **LLM Integration**: OpenAI-compatible API (tested with DeepSeek v4-flash)
- **Skill Loader**: YAML frontmatter parsing, multi-field search
- **Skill Script Runner**: Secure execution via `spawn()` (not `exec`)
- **Configuration System**: Environment variable loading with `.env` auto-loading
- **Multi-agent Orchestration**: Fork / Linear / DAG / Team modes (framework complete)
- **Security Fixes**: Path traversal protection, command injection prevention, regex fix for Grep
- **68 Unit Tests**: Covering all core modules
- **Open-source Infrastructure**: `.gitignore`, `LICENSE` (MIT), `.env.example`, `start.bat`, `start.sh`
- **Documentation**: 18 development docs in `docs/development/`

[Unreleased]: https://github.com/your-org/workbuddy/compare/v0.2.0-alpha...HEAD
[0.2.0-alpha]: https://github.com/your-org/workbuddy/compare/v0.1.0...v0.2.0-alpha
[0.1.0]: https://github.com/your-org/workbuddy/releases/tag/v0.1.0
