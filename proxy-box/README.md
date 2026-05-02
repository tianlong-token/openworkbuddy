# Proxy-Box (Placeholder)

> This is a placeholder for the sandbox proxy service.
> The original implementation depends on proprietary packages (`@genie/agent-sdk-js`).
> Future versions will include an open-source alternative.

## Current Status

| Component | Status |
|-----------|--------|
| Sandbox Execution | ❌ Not available |
| Session Routing | ⚠️ Tests available, no implementation |
| MCP SDK Integration | ⚠️ Package available, not wired up |
| Test Files | ✅ 6 test files in `extra/test/` |

## Running Tests

The test files in `extra/test/` are standalone TypeScript tests that can be run with `tsx`:

```bash
# Run all tests
npx tsx extra/test/*.spec.ts

# Run individual tests
npx tsx extra/test/validate-session-id.spec.ts
npx tsx extra/test/session-router.spec.ts
npx tsx extra/test/idle-gate-session.spec.ts
npx tsx extra/test/env-multi-session.spec.ts
npx tsx extra/test/dynamic-session-facade.spec.ts
npx tsx extra/test/bound-session-handle.spec.ts
```

## Future Plans

See `docs/development/PROXY-BOX-DECISION.md` for the detailed decision document.

### Planned Implementation
- Lightweight sandbox using Node.js `vm` module + `child_process`
- File system access restrictions via path validation
- Timeout control and resource limits
- MCP SDK integration for tool proxying

### Alternative Approaches
- Integrate with open-source sandbox solutions (e.g., `firejail`, `bubblewrap`)
- Use container-based isolation (Docker)
- Implement WASM-based sandbox

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.18.0 | HTTP server |
| `ws` | ^8.16.0 | WebSocket support |
| `@modelcontextprotocol/sdk` | ^1.0.0 | MCP protocol |

## License

Same as WorkBuddy main project.
