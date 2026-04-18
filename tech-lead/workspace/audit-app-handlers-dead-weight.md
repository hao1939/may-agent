# Audit: src/app/ Handler Dead Weight

**Date**: 2026-04-13  
**Lens**: C (Dead Weight)  
**Scope**: All 15 files in `src/app/`  
**Objective**: Identify orphaned, unreachable, or unjustified code in the application layer.

---

## File Inventory

| File | Lines | Role | Consumers |
|------|-------|------|-----------|
| `may.ts` | ~940 | Main entry point / orchestrator | Everything imports from or is registered by this |
| `event-bus.ts` | ~120 | Event pub/sub backbone | 7 internal consumers |
| `agent-loader.ts` | ~100 | Agent config loader | 3 consumers (may.ts, lib/index.ts, lib/tools/coding.ts) |
| `chat-session.ts` | 407 | Interactive chat REPL | 2 consumers (may.ts, manager.ts) |
| `cron.ts` | ~100 | Cron scheduler | 7 consumers across lib/ |
| `cli-send.ts` | ~80 | CLI message sender | 1 consumer (may.ts) |
| `bundle-mode.ts` | 66 | Compiled binary detection | 2 consumers (binary-entry.ts, lib/detached.ts) |
| `binary-entry.ts` | 33 | Compiled binary entry point | 0 src/ consumers (only package.json `bundle` script) |
| `cli/metrics.ts` | 240+ | Performance dashboard CLI | **0 consumers** — standalone script |
| `cli/cron-task.sh` | 30 | Shell trigger for agent tasks | **0 code consumers** — external CLI tool |
| `ui/console.ts` | 104 | Stdout renderer | 1 consumer (may.ts, flag-gated `--console`) |
| `ui/socket.ts` | 336 | Unix socket UI | 1 consumer (may.ts, flag-gated `--socket`) |
| `ui/telegram.ts` | 348 | Telegram bot UI | 1 consumer (may.ts, flag-gated `--telegram`) |
| `ui/web.ts` | 732 | Web dashboard + API server | 1 consumer (may.ts, flag-gated `--web`) |
| `ui/web-static/index.html` | 2012 | SPA dashboard frontend | Served by web.ts |

---

## Findings

### F-1: `cli/metrics.ts` — Unreferenced standalone script (LOW)

**Evidence**: Zero imports in any `.ts` file. Only reference is the sibling `cron-task.sh`. Never called from may.ts or any automated path.  
**Size**: 240+ lines of dashboard rendering code.  
**Risk**: It reads `bun:sqlite` with a `require()` fallback to JSON files — dual-path complexity. If DB schema changes, this silently breaks with no test coverage.  
**Recommendation**: Either integrate into `web.ts` API (which already has `/api/stats` doing similar aggregation) or add a test. As-is, it's invisible dead weight.

### F-2: `ui/web.ts` — 732 lines, growing monolith (MEDIUM)

**Evidence**: 15 API handler functions inlined in a single file. `handleBenchmarks` alone is ~60 lines, `handleBenchmarkCompare` another ~40, `handleBenchmarkPrompts` ~30. The session tree query (`WITH RECURSIVE tree`) duplicates the pattern in `lib/requests.ts` (different tables, but same CTE shape).  
**Risk**: This is the largest file in `src/app/` and has no test coverage. Every new dashboard feature adds another handler here.  
**Recommendation**: Not urgent — it works. But if a new handler is needed, consider extracting API handlers into `ui/web-api/` modules. Not worth refactoring unprompted.

### F-3: `binary-entry.ts` + `bundle-mode.ts` — Compiled binary support (LOW)

**Evidence**: `binary-entry.ts` has zero in-source imports — only referenced by `package.json` `bundle` script. `bundle-mode.ts` has 2 consumers.  
**Status**: **Not dead weight.** These serve the `bun build --compile` path. The compiled binary is a real deployment target. `binary-entry.ts` normalizes argv so may.ts's `process.argv.slice(2)` works in both modes. Both are small and correct.  
**Recommendation**: No action.

### F-4: `cli/cron-task.sh` — External-only shell script (INFO)

**Evidence**: No code references. Used as an external CLI tool (`./run/cli/cron-task.sh`) for triggering agent sessions via socket. Depends on `socat` and `python3`.  
**Status**: Useful for human operators. Not dead weight, but fragile — `socat`/`python3` are runtime deps not documented anywhere.  
**Recommendation**: Document runtime dependencies or note that `cli-send.ts` (via `bun src/app/may.ts --message`) does the same thing without external deps.

### F-5: Flag-gated UI modules — All justified (OK)

**Evidence**: `console.ts` (104 lines), `socket.ts` (336 lines), `telegram.ts` (348 lines) are all:
- Imported in may.ts
- Gated behind `--console`, `--socket`, `--telegram` flags respectively
- Actively used in production (socket is the primary IPC mechanism)  
**Status**: Clean. No dead weight.

---

## Summary

| ID | Severity | File | Issue | Action |
|----|----------|------|-------|--------|
| F-1 | LOW | `cli/metrics.ts` | 240+ lines, zero consumers, untested, duplicates web.ts logic | Integrate into web API or delete |
| F-2 | MEDIUM | `ui/web.ts` | 732-line monolith, no tests, growing handler count | Extract if/when adding new handlers |
| F-3 | LOW | `binary-entry.ts` | Zero in-source imports | No action — serves compiled binary path |
| F-4 | INFO | `cli/cron-task.sh` | Undocumented external deps (socat, python3) | Document or note cli-send.ts alternative |
| F-5 | OK | `ui/*.ts` | All flag-gated, all consumed | No action |

**Bottom line**: The app layer is lean. The only real dead weight candidate is `cli/metrics.ts` (F-1), which is a standalone 240-line dashboard that nothing calls and that duplicates aggregation already available in `web.ts`'s `/api/stats` endpoint. The web.ts monolith (F-2) is a growth risk, not a current problem.
