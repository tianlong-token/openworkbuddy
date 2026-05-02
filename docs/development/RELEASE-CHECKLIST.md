# Release Checklist — v0.1.0

> Date: 2026-05-02 | Status: In Progress

---

## ✅ Pre-Release Verification

### Compilation & Testing
- [x] TypeScript compilation passes (0 errors)
- [x] All unit tests pass (48 tests across 4 files)
- [x] CLI commands work correctly:
  - [x] `list` — shows 147 skills
  - [x] `info <slug>` — shows skill details
  - [x] `search <query>` — returns matching skills
  - [x] `config` — shows configuration
  - [x] `run <slug>` — handles missing LLM gracefully
  - [x] `run <non-existent>` — shows available skills

### Code Quality
- [x] No `any` type abuse in critical paths
- [x] Consistent 2-space indentation and semicolons
- [x] No hardcoded paths/URLs (except test fixtures)
- [x] Error handling for missing parameters, file not found, timeouts
- [x] Timeout controls (Bash 120s, LLM 30s)
- [x] Return values conform to `ToolResult` interface

### Security
- [x] Path traversal prevention in Read/Write/Edit tools
- [x] Regex validation in Grep tool
- [x] URL resolution in WebSearch tool
- [x] No command injection vulnerabilities
- [x] No hardcoded secrets or API keys

### Cross-Platform
- [x] Windows/Linux/macOS compatible
- [x] No shell command dependencies (uses native Node.js APIs)
- [x] Native `glob` and `fetch` used instead of external commands
- [x] Config path resolution works in CommonJS environments

### Proxy-Box
- [x] Compiled proprietary code removed
- [x] Package.json updated to placeholder version
- [x] README.md added with current status
- [x] Test files preserved in extra/test/

---

## ✅ Documentation

- [x] `docs/development/TECH-SPEC.md` — Technical specification
- [x] `docs/development/API-REFERENCE.md` — Complete API documentation
- [x] `docs/development/CHANGELOG.md` — Version history
- [x] `docs/development/CODE-REVIEW.md` — Code review report
- [x] `docs/development/COLLABORATION-REVIEW.md` — Collaboration review
- [x] `docs/development/PROXY-BOX-DECISION.md` — Proxy-box decision document
- [x] `docs/development/TASK-ASSIGNMENT.md` — Task assignment and progress

---

## 📦 Package Configuration

### runtime/package.json
```json
{
  "name": "@workbuddy/runtime",
  "version": "0.1.0",
  "description": "WorkBuddy runtime engine",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "workbuddy": "dist/cli.js"
  }
}
```

- [x] Version is 0.1.0
- [x] Main entry point correct
- [x] Types declaration correct
- [x] CLI binary registered

### Dependencies
| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `glob` | ^10.4.5 | File pattern matching | ✅ |
| `cheerio` | ^1.2.0 | HTML parsing | ✅ |
| `yaml` | ^2.4.0 | YAML frontmatter | ✅ |
| `zod` | ^3.23.0 | Runtime validation | ✅ |

### Dev Dependencies
| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| `typescript` | ^5.4.0 | Type checking | ✅ |
| `tsx` | ^4.7.0 | TypeScript execution | ✅ |
| `vitest` | ^1.5.0 | Unit testing | ✅ |
| `@types/node` | ^25.6.0 | Node.js types | ✅ |

---

## 📝 Files to Include/Exclude

### Include in npm package
- `dist/**/*` — Compiled JavaScript
- `src/**/*` — Source code (for debugging)
- `package.json` — Package metadata
- `tsconfig.json` — TypeScript configuration
- `vitest.config.ts` — Test configuration
- `README.md` — Package readme

### Exclude from npm package
- `.planning/` — GSD planning files
- `node_modules/` — Dependencies
- `*.spec.ts` — Test files
- `dist/**/*.map` — Source maps (optional)

---

## 🚀 Release Steps

1. [x] Final code review
2. [x] All tests pass
3. [x] Documentation complete
4. [ ] Create .npmignore
5. [ ] Run `npm pack` to verify package contents
6. [ ] Update CHANGELOG.md with release date
7. [ ] Commit changes
8. [ ] Tag release v0.1.0
9. [ ] Publish to npm (if desired)

---

## 📊 Metrics

| Metric | Value |
|--------|-------|
| Skills | 147 |
| Tools | 11 (8 implemented + 3 placeholders) |
| Unit Tests | 48 |
| Test Files | 4 |
| Source Files | 12 |
| Documentation Files | 7 |
| Lines of Code | ~2,500 |

---

## ⚠️ Known Issues

| Issue | Severity | Status |
|-------|----------|--------|
| Agent executor returns placeholder | Low | Planned for v0.2.0 |
| Skill executor returns placeholder | Low | Planned for v0.2.0 |
| TodoWrite uses in-memory store | Low | Planned for v0.2.0 |
| Memory API backend not implemented | Low | Planned for v0.2.0 |
| Task tool registered but not implemented | Low | Planned for v0.2.0 |
| No session TTL/cleanup | Medium | Planned for v0.2.0 |
| No LLM API retry logic | Medium | Planned for v0.2.0 |

---

## ✅ Sign-off

- [ ] Architect review complete
- [ ] Executor review complete
- [ ] Final integration test complete
- [ ] Release approved

---

*Release checklist for WorkBuddy Runtime v0.1.0*
