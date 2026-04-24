# Lens C: manager.ts Dead Weight Audit (2443 LOC)

*Audited 2026-04-16 · File: `src/lib/manager.ts`*

---

## Summary

manager.ts has **9 dead re-exports** (symbols exported for backward compat but with zero external src consumers — only some have test-only consumers) and **~10 class methods** that are only exercised by tests, never by production src code. All node imports and local imports are actually used. The dead weight is predominantly in the re-export proxy layer (lines 35–113) which was created during the manager decomposition to preserve import paths.

---

## Finding 1: Dead Re-exports — Zero External `src/` Consumers (Severity: MEDIUM)

The following symbols are re-exported from manager.ts but have **zero** consumers in `src/**/*.ts` (excluding manager.ts itself and the source module):

| Re-export | Source Module | Test consumers? | Verdict |
|-----------|--------------|----------------|---------|
| `getAgentDir` | manager-utils.js | 0 test files | **Dead** — no consumer anywhere |
| `INFRA_RETRY_MAX` | manager-utils.js | 1 test (manager-infra-retry.test.ts) | **Test-only** |
| `isRetryableInfraError` | manager-retry.js | 0 (test imports from manager-retry directly) | **Dead re-export** |
| `runAgentWithRetry` | manager-retry.js | 0 (test imports from manager-retry directly) | **Dead re-export** |
| `buildTrace` | manager-trace.js | 0 test files | **Dead** — no consumer anywhere |
| `signToolOutput` | manager-receipts.js | 0 src (test uses `manager.signToolOutput()` method) | **Dead re-export** |
| `verifyToolOutput` | manager-receipts.js | 0 (test uses `manager.verifyToolOutput()` method) | **Dead re-export** |
| `createVerifyReceiptTool` | manager-receipts.js | 0 (test uses `manager.createVerifyReceiptTool()` method) | **Dead re-export** |
| `getOpUsage` | manager-receipts.js | 0 src (test uses `manager.getOpUsage()` method) | **Dead re-export** |

**Evidence**: `scripts/code-search.sh <symbol> --path 'src/**/*.ts' -l` returned 0 hits (excluding manager.ts and source module) for each.

**Impact**: 20 lines of exports (lines 35–44, 94, 97, 106–113) that serve no purpose. Tests that consume these symbols import them from the source module directly (e.g., `manager-retry.ts`, `manager-receipts.js`), not via the manager.ts re-export.

**Recommendation**: Remove dead re-exports. Keep only re-exports that have actual `src/` consumers: `generateId` (2), `truncateForPrompt` (1), `computeToolArgsKey` (1), `isToolError` (1), `STATE_CHANGING_TOOLS` (1), `TOOL_PIVOT_LIMIT` (1), `classifyError` (4), `wrapToolsWithReceipts` (1). The test importing `INFRA_RETRY_MAX` from manager.ts should be updated to import from manager-utils.ts directly.

---

## Finding 2: Class Methods With Zero `src/` Consumers (Severity: LOW)

These SubagentManager methods have **0 consumers in `src/**/*.ts`** — they exist only for the test suite (and potentially the external ChatSession/API boundary):

| Method | Line | src consumers | test consumers | Notes |
|--------|------|--------------|---------------|-------|
| `followUp()` | 2018 | 0 | 1 | Sends follow-up message to active session |
| `getKnowledgePath()` | 2139 | 0 | 1 | Returns agent knowledge dir |
| `getWorkspacePath()` | 2145 | 0 | 1 | Returns agent workspace dir |
| `getWorkflowDir()` | 2153 | 0 | 1 | Returns agent workflow dir |
| `getOutputPath()` | 2162 | 0 | 1 | Returns session output dir |
| `reconcileHealth()` | 2218 | 0 | 1 | Runs health reconciliation |
| `signToolOutput()` | 2224 | 0 | 1 | Wrapper: delegates to manager-receipts |
| `verifyToolOutput()` | 2228 | 0 | 1 | Wrapper: delegates to manager-receipts |
| `createVerifyReceiptTool()` | 2232 | 0 | 1 | Wrapper: delegates to manager-receipts |
| `getOpUsage()` | 2236 | 0 | 1 | Wrapper: delegates to manager-receipts |

**Total**: ~70 lines of code for methods with no production callers.

**Caveat**: These may be part of the public API surface consumed by `src/app/chat-session.ts` or the web API indirectly (via ChatSession's `manager` property). `getKnowledgePath`, `getWorkspacePath`, `getWorkflowDir`, `getOutputPath` look like they were designed for the agents tool or external tooling. `signToolOutput` and `getOpUsage` are thin wrappers that just delegate to `manager-receipts.ts` functions — the class methods add no logic.

**Recommendation**: Mark as low priority. The path-getter methods (`getKnowledgePath` etc.) are a reasonable API surface to maintain. The thin wrappers (`signToolOutput`, `getOpUsage`) could be removed if tests import the free functions directly.

---

## Finding 3: Redundant Re-export Layer Pattern (Severity: INFORMATIONAL)

manager.ts acts as a **proxy module** — it re-exports symbols from 4 extracted modules:
- `manager-utils.ts` (8 values + 4 types)
- `manager-retry.ts` (2 values)
- `classify-error.ts` (1 value)
- `manager-trace.ts` (1 value)
- `manager-receipts.ts` (5 values)

This was created during the manager decomposition (see `agents/may/workspace/brief-decompose-manager.md` constraint: "Any function/type currently exported from manager.ts must still be importable from the same path"). However, the **actual consumer split** shows most imports bypass manager.ts:

- `src/lib/index.ts` re-exports `SubagentManager`, `generateId`, `truncateForPrompt` from manager.ts — these are the only ones that truly need the proxy
- Tests import `SubagentManager` from manager.ts but utility symbols from source modules
- No src file imports `isRetryableInfraError`, `buildTrace`, etc. via manager.ts

**Recommendation**: The backward-compat re-export layer can be pruned to just `SubagentManager` + the 6 symbols that have actual src consumers (Finding 1). This removes ~17 lines and eliminates the dual-import-path confusion.

---

## Finding 4: No Unused Imports Detected (Severity: NONE — Non-Finding)

All imports in manager.ts are actively used:
- `dirname`: 3 uses, `relative`: 3 uses
- `readIdentity`: 2 uses (import + call)
- `routeKnowledge`, `routeFewShotExamples`: each used in `buildSessionContext`
- `CompactionOptions`: used in type annotation
- All guard imports (`createFinishGuard`, etc.): used in `composeGuards` call

---

## Finding 5: No Unreachable Code Paths Detected (Severity: NONE — Non-Finding)

No dead `if(false)` blocks, no early-return-shadowed code, no commented-out function bodies were found. The file is large (2443 LOC) but all code paths are reachable.

---

## Severity Summary

| # | Finding | Severity | Est. Dead Lines |
|---|---------|----------|----------------|
| F-1 | Dead re-exports (9 symbols) | MEDIUM | ~20 |
| F-2 | Test-only class methods (10 methods) | LOW | ~70 |
| F-3 | Redundant proxy layer pattern | INFO | ~17 (overlap with F-1) |
| F-4 | No unused imports | NONE | 0 |
| F-5 | No unreachable code | NONE | 0 |

**Total dead weight**: ~90 lines (~3.7% of file). The file's size problem (2443 LOC) is not due to dead code — it's due to the god-object pattern documented in Lens A (6+ responsibilities in one class).

---

## Follow-up Actions (Do NOT fix in this session)

1. **Clean re-exports**: Remove 9 dead re-exports from lines 35–113. Update the one test (`manager-infra-retry.test.ts`) that imports `INFRA_RETRY_MAX` via manager.ts.
2. **Consider removing thin wrappers**: `signToolOutput()` and `getOpUsage()` on SubagentManager just delegate to free functions — tests could import those directly.
3. **Reference**: Prior audit `audit-manager-utils-architecture.md` already flagged `getAgentDir` and `INFRA_RETRY_MAX` as potentially dead from the manager-utils side. This confirms they're dead from the manager.ts re-export side too.
