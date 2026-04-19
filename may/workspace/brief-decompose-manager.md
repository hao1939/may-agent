# Brief: Decompose manager.ts

**Priority**: P1 (from Hao)
**Owner**: tech-lead
**Status**: Ready

## Problem
`src/lib/manager.ts` is 2,774 lines — one massive file containing the entire SubagentManager class plus utility functions. This makes it fragile, hard to navigate, and risky to modify. It's the backbone of the delegation system and needs to be maintainable.

## Goal
Extract logical modules from manager.ts into separate files. Keep manager.ts as the orchestrator that imports and composes them. Target: manager.ts should be ~800-1000 lines after extraction.

## Proposed Extractions (ordered by independence — do easiest first)

### 1. `src/lib/manager-utils.ts` (~200 lines)
Standalone utility functions + shared interfaces:
- `generateId()`, `formatDuration()`, `extractLastAssistantText()`, `formatMemoryTimestamp()`
- `isProcessAlive()`, `truncateForPrompt()`, `isToolError()`, `computeToolArgsKey()`
- Interfaces: `RegisteredAgent`, `ActiveSession`, `RunOptions`, `SubagentManagerOptions`
- These have zero coupling to SubagentManager — pure functions.

### 2. `src/lib/manager-trace.ts` (~180 lines)
Session graph tracing:
- `trace()`, `buildTraceFromSession()`, `buildTraceFromWorkflowRun()`
- `buildWorkflowNode()`, `findPathToTarget()`
- These only read state (registry, sessions) — can become methods on a helper class or standalone functions that take manager state as input.

### 3. `src/lib/manager-health.ts` (~170 lines)
Health monitoring:
- `health()`, `auditHealth()`, `reconcileHealth()`
- Read-only view of manager state.

### 4. `src/lib/manager-receipts.ts` (~235 lines)
HMAC tool receipt signing:
- `signToolOutput()`, `verifyToolOutput()`
- `createVerifyReceiptTool()`, `wrapToolsWithReceipts()`
- `getOpUsage()`
- Self-contained crypto module.

### 5. `src/lib/manager-retry.ts` (~115 lines)
Infrastructure retry logic:
- `isRetryableInfraError()`, `runAgentWithRetry()`
- Encapsulates retry policy.

## Architecture Pattern
Two valid approaches — pick whichever works cleaner:

**Option A: Helper classes** — Each module exports a class that receives `SubagentManager` (or a subset of its state) in constructor. Manager instantiates them and delegates.

**Option B: Standalone functions** — Each module exports functions that take the specific state they need as parameters. Manager calls them.

Option B is simpler and more testable. Prefer it unless coupling is too tight.

## Constraints
- **Zero behavior change.** Every existing test must pass unchanged.
- **Re-exports from manager.ts.** Any function/type currently exported from manager.ts must still be importable from the same path (add `export { X } from "./manager-utils.js"` in manager.ts).
- **One extraction at a time.** Do one module, run `tsc --noEmit && npx vitest --run`, confirm all green, then do the next.
- **Don't touch session lifecycle or run() yet.** Those are the most coupled parts — leave them in manager.ts for now. Getting the independent pieces out first makes future extractions easier.

## Tests
Existing test files that exercise this code:
- `test/manager-infra-retry.test.ts`
- `test/health-api.test.ts`, `test/health-check.test.ts`
- `test/session-graph.test.ts`, `test/session-tree.test.ts`
- `test/tool-receipts.test.ts`
- `test/manager-methods.test.ts`, `test/manager-input.test.ts`
- `test/delegation-metrics.test.ts`
- `test/session-count.test.ts`, `test/session-exists.test.ts`

All 1240 tests must pass after each extraction.

## Success Criteria
- manager.ts reduced to <1200 lines
- 4+ modules extracted
- All tests pass
- No import path changes for consumers (re-exports in place)
