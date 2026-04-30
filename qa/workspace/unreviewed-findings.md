# QA Heartbeat — Unreviewed Findings (2026-04-30)

## Scope
Heartbeat audit with no pending events/projects. Verified latest change in `agents` repo and ran typecheck + tests.

## Findings

### 1) `tsc --noEmit` currently fails (CRITICAL)
**Evidence:** `shared/lib/index.ts` reports duplicate re-exported members.
- Errors observed:
  - `shared/lib/index.ts(13,1): TS2308: Module './iteration-monitor.js' has already exported a member named 'IterationRecord'.`
  - `shared/lib/index.ts(15,1): TS2308: Module './iteration-monitor.js' has already exported a member named 'IterationRecord'.`
  - `shared/lib/index.ts(16,1): TS2308: Module './task-validator.js' has already exported a member named 'ValidationResult'.`

**Impact:** Typecheck is red; this can block downstream builds/CI or mask real regressions.

**Next step suggestion:** Inspect `shared/lib/index.ts` and remove/alias duplicate exports, or make re-exports explicit to resolve ambiguity.

### 2) `vitest --run` tests pass but process exits non-zero due to permission error (IMPORTANT env)
**Evidence:** All tests passed (536), but vitest throws:
- `EACCES: permission denied, open '/app/agents/node_modules/.vite/vitest/results.json'`

**Impact:** Even with passing tests, CI would fail if it relies on exit code.

**Next step suggestion:** Fix permissions/ownership on `/app/agents/node_modules/.vite/` or configure vitest cache/results output to a writable location.

### 3) Recent change verified: metrics design doc edit (MINOR)
**Evidence:** `shared/may-agent-docs/design/agent-metrics.md` updated with cadence/phase guidance and implementation notes. Content looks coherent; no code impact.
